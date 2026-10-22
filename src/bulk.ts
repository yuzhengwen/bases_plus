import { App, Notice, TFile } from 'obsidian';

// Bulk operations applied to the files selected in a Cards Plus view.

export function isMarkdown(file: TFile): boolean {
	return file.extension === 'md';
}

/** Splits user input like "#a, b c" into ["a", "b", "c"]. */
export function parseTagInput(input: string): string[] {
	const tags = input
		.split(/[,\s]+/)
		.map((t) => t.replace(/^#+/, '').trim())
		.filter((t) => t.length > 0);
	return [...new Set(tags)];
}

function normalizeTags(raw: unknown): string[] {
	if (raw === undefined || raw === null) return [];
	const list = Array.isArray(raw) ? raw : [raw];
	return list.flatMap((t) => (typeof t === 'string' ? parseTagInput(t) : typeof t === 'number' ? [String(t)] : []));
}

/** Adds tags to each file's `tags` property, skipping tags it already has (case-insensitive). */
export async function addTags(app: App, files: TFile[], tags: string[]): Promise<void> {
	await runBulk(files, 'Added tags to', (file) =>
		app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const existing = normalizeTags(fm.tags);
			const have = new Set(existing.map((t) => t.toLowerCase()));
			const missing = tags.filter((t) => !have.has(t.toLowerCase()));
			if (missing.length > 0) fm.tags = [...existing, ...missing];
		}),
	);
}

/** Sets `key` to `value` on each file, replacing any existing value. */
export async function setProperty(app: App, files: TFile[], key: string, value: unknown): Promise<void> {
	await runBulk(files, `Set "${key}" on`, (file) =>
		app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm[key] = value;
		}),
	);
}

export async function removeProperties(app: App, files: TFile[], keys: string[]): Promise<void> {
	await runBulk(files, 'Removed properties from', (file) =>
		app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			for (const key of keys) delete fm[key];
		}),
	);
}

/** Moves files to trash, following the user's "Deleted files" setting. */
export async function deleteFiles(app: App, files: TFile[]): Promise<void> {
	await runBulk(files, 'Deleted', (file) => app.fileManager.trashFile(file), true);
}

/** Counts how many of the files have each frontmatter key. */
export function collectPropertyCounts(app: App, files: TFile[]): Map<string, number> {
	const counts = new Map<string, number>();
	for (const file of files) {
		const fm = app.metadataCache.getFileCache(file)?.frontmatter;
		if (!fm) continue;
		for (const key of Object.keys(fm)) {
			if (key === 'position') continue;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
	}
	return counts;
}

async function runBulk(
	files: TFile[],
	verb: string,
	op: (file: TFile) => Promise<void>,
	allFileTypes = false,
): Promise<void> {
	const targets = allFileTypes ? files : files.filter(isMarkdown);
	const skipped = files.length - targets.length;
	let failed = 0;

	for (const file of targets) {
		try {
			await op(file);
		} catch (err) {
			failed++;
			console.error(`Bases Plus: failed on ${file.path}`, err);
		}
	}

	const done = targets.length - failed;
	let message = `${verb} ${done} ${done === 1 ? 'file' : 'files'}.`;
	if (skipped > 0) message += ` Skipped ${skipped} non-Markdown ${skipped === 1 ? 'file' : 'files'}.`;
	if (failed > 0) message += ` ${failed} failed (see console).`;
	new Notice(message);
}

/**
 * Renames a group: wherever `key` equals `oldText` (or, for lists, an item equals it),
 * replaces it with `newText`. Notes without the property get it set to `newText`
 * (used when renaming the "No value" group). Numbers and booleans keep their type
 * when the new text parses as one.
 */
export async function renameGroupValue(
	app: App,
	files: TFile[],
	key: string,
	oldText: string | null,
	newText: string,
): Promise<void> {
	await runBulk(files, `Renamed "${key}" in`, (file) =>
		app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const current = fm[key];
			if (current === undefined || current === null || current === '') {
				fm[key] = coerceLike(undefined, newText);
			} else if (Array.isArray(current)) {
				fm[key] = (current as unknown[]).map((item) => (oldText !== null && String(item) === oldText ? coerceLike(item, newText) : item));
			} else {
				fm[key] = coerceLike(current, newText);
			}
		}),
	);
}

function coerceLike(previous: unknown, text: string): unknown {
	if (typeof previous === 'number' && text.trim() !== '' && Number.isFinite(Number(text))) return Number(text);
	if (typeof previous === 'boolean' && (text === 'true' || text === 'false')) return text === 'true';
	return text;
}
