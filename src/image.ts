import {
	App,
	BasesEntry,
	BasesPropertyId,
	TFile,
	Value,
	normalizePath,
	parseLinktext,
	parsePropertyId,
} from 'obsidian';

export type CoverImage = { kind: 'url'; src: string } | { kind: 'color'; color: string };

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'avif', 'ico', 'tif', 'tiff']);
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const CSS_COLOR_FN = /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch)\(.*\)$/i;
const WIKILINK = /^!?\[\[([^\]]+)\]\]$/;
const MD_LINK = /^!?\[[^\]]*\]\((.+)\)$/;
const EXTERNAL_URL = /^(?:https?|data|app|file):/i;

/**
 * Resolves the image property of an entry to something displayable.
 * Accepts the same inputs as the built-in Cards view: a link to a local
 * attachment, an external URL, or a color (hex or CSS color function).
 * For list values, the first item that resolves is used.
 */
export function resolveCoverImage(app: App, entry: BasesEntry, propId: BasesPropertyId): CoverImage | null {
	const sourcePath = entry.file.path;
	for (const candidate of readCandidates(app, entry, propId)) {
		const cover = resolveString(app, candidate, sourcePath);
		if (cover) return cover;
	}
	return null;
}

// Prefer the raw frontmatter value for note properties: it keeps the exact
// text the user typed ("[[img.png]]", "#ff0000"), which is unambiguous.
// Formula and file properties fall back to the evaluated Value.
function readCandidates(app: App, entry: BasesEntry, propId: BasesPropertyId): string[] {
	const { type, name } = parsePropertyId(propId);
	if (type === 'note') {
		const raw: unknown = app.metadataCache.getFileCache(entry.file)?.frontmatter?.[name];
		if (raw !== undefined && raw !== null) return flatten(raw);
	}

	const value = entry.getValue(propId);
	if (!value || !value.isTruthy()) return [];
	if (isListValue(value)) {
		const items: string[] = [];
		for (let i = 0; i < value.length(); i++) items.push(value.get(i).toString());
		return items;
	}
	return [value.toString()];
}

function flatten(raw: unknown): string[] {
	if (Array.isArray(raw)) return raw.flatMap(flatten);
	if (typeof raw === 'string') return [raw];
	return [];
}

// ListValue is only exposed as a type, so check its shape instead of instanceof.
function isListValue(value: Value): value is Value & { length(): number; get(i: number): Value } {
	const v = value as unknown as { length?: unknown; get?: unknown };
	return typeof v.length === 'function' && typeof v.get === 'function';
}

function resolveString(app: App, input: string, sourcePath: string): CoverImage | null {
	const text = input.trim();
	if (!text) return null;

	if (HEX_COLOR.test(text) || CSS_COLOR_FN.test(text)) return { kind: 'color', color: text };

	const wiki = WIKILINK.exec(text);
	if (wiki?.[1]) {
		const linktext = wiki[1].split('|')[0] ?? '';
		return resolveVaultPath(app, parseLinktext(linktext).path, sourcePath);
	}

	const md = MD_LINK.exec(text);
	if (md?.[1]) {
		// Strip an optional title ("url "title"") and angle brackets.
		const target = md[1].trim().replace(/\s+["'].*["']$/, '').replace(/^<(.*)>$/, '$1');
		if (EXTERNAL_URL.test(target)) return { kind: 'url', src: target };
		return resolveVaultPath(app, safeDecode(target), sourcePath);
	}

	if (EXTERNAL_URL.test(text)) return { kind: 'url', src: text };

	return resolveVaultPath(app, text, sourcePath);
}

function resolveVaultPath(app: App, path: string, sourcePath: string): CoverImage | null {
	if (!path) return null;
	const file =
		app.metadataCache.getFirstLinkpathDest(path, sourcePath) ??
		app.vault.getAbstractFileByPath(normalizePath(path));
	if (!(file instanceof TFile) || !IMAGE_EXTENSIONS.has(file.extension.toLowerCase())) return null;
	return { kind: 'url', src: app.vault.getResourcePath(file) };
}

function safeDecode(text: string): string {
	try {
		return decodeURI(text);
	} catch {
		return text;
	}
}
