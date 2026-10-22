import { App, BasesEntryGroup, BasesPropertyId, BasesViewConfig, TFile, parsePropertyId, setIcon } from 'obsidian';
import { isMarkdown, renameGroupValue } from '../../bulk';
import { ConfirmModal } from '../../modals';
import { SelectionState } from './selection';

// Not a user-facing option: stores the keys of collapsed groups in the view config.
const CFG_COLLAPSED = 'collapsedGroups';
const NO_VALUE_KEY = '__no_value__';

/** What group headers need from the view that renders them. */
export interface GroupHost {
	readonly app: App;
	readonly config: BasesViewConfig;
	readonly allProperties: BasesPropertyId[];
	/** Re-renders the view, e.g. to cancel an inline rename. */
	onDataUpdated(): void;
}

export interface GroupHeaderOptions {
	/** The note property to rename, or null if the group can't be renamed. */
	groupProp: string | null;
	collapsed: boolean;
	onSelectGroup: () => void;
}

/** Stable id for a group, used to remember collapsed groups. */
export function groupKeyId(group: BasesEntryGroup): string {
	return group.hasKey() && group.key ? group.key.toString() : NO_VALUE_KEY;
}

/**
 * Renders a group header (collapse chevron, title, count, select button) into
 * `groupEl` and returns the select button so its state can be synced later.
 */
export function renderGroupHeader(
	host: GroupHost,
	groupEl: HTMLElement,
	group: BasesEntryGroup,
	opts: GroupHeaderOptions,
): HTMLButtonElement {
	const groupId = groupKeyId(group);
	groupEl.toggleClass('is-collapsed', opts.collapsed);

	const headerEl = groupEl.createDiv('bases-plus-group-header');
	const collapseEl = headerEl.createDiv({ cls: 'bases-plus-group-collapse clickable-icon' });
	setIcon(collapseEl, 'lucide-chevron-down');
	collapseEl.setAttr('aria-label', 'Collapse or expand group');
	collapseEl.addEventListener('click', () => toggleCollapsed(host.config, groupEl, groupId));

	const titleEl = headerEl.createDiv('bases-plus-group-title');
	if (group.hasKey() && group.key) group.key.renderTo(titleEl, host.app.renderContext);
	else titleEl.setText('No value');
	if (opts.groupProp) makeRenamable(host, titleEl, group, opts.groupProp, groupId);

	headerEl.createDiv({ cls: 'bases-plus-group-count', text: String(group.entries.length) });

	const button = headerEl.createEl('button', { cls: 'bases-plus-group-select' });
	button.addEventListener('click', opts.onSelectGroup);
	return button;
}

/** Updates a group's select button label and icon from the current selection. */
export function syncGroupButton(button: HTMLButtonElement, files: TFile[], selection: SelectionState): void {
	const n = selection.countIn(files);
	const all = selection.active && n === files.length;
	button.empty();
	setIcon(
		button.createSpan('bases-plus-toolbar-icon'),
		all ? 'lucide-square-check' : n > 0 ? 'lucide-square-minus' : 'lucide-square',
	);
	button.createSpan({ text: all ? 'Deselect group' : 'Select group' });
	button.toggleClass('is-active', n > 0);
}

// ------------------------------------------------------------- collapse

export function getCollapsed(config: BasesViewConfig): Set<string> {
	const raw = config.get(CFG_COLLAPSED);
	return new Set(Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string') : []);
}

function setCollapsed(config: BasesViewConfig, keys: Set<string>): void {
	config.set(CFG_COLLAPSED, keys.size > 0 ? [...keys] : null);
}

function toggleCollapsed(config: BasesViewConfig, groupEl: HTMLElement, groupId: string): void {
	const keys = getCollapsed(config);
	if (keys.has(groupId)) keys.delete(groupId);
	else keys.add(groupId);
	groupEl.toggleClass('is-collapsed', keys.has(groupId));
	setCollapsed(config, keys);
}

// --------------------------------------------------------------- rename

/**
 * The note property the view is grouped by, or null if it isn't a plain note
 * property (formulas and file properties can't be renamed). The API has no
 * getter for this, so read the raw view config, then fall back to finding the
 * note property whose value matches every group key.
 */
export function getGroupByProperty(host: GroupHost, groups: BasesEntryGroup[]): string | null {
	const raw = host.config.get('groupBy') as { property?: unknown } | string | null | undefined;
	const configured = typeof raw === 'string' ? raw : typeof raw?.property === 'string' ? raw.property : null;
	if (configured) {
		const id = (configured.includes('.') ? configured : `note.${configured}`) as BasesPropertyId;
		const { type, name } = parsePropertyId(id);
		return type === 'note' ? name : null;
	}

	const keyed = groups.filter((g) => g.hasKey() && g.key);
	for (const id of host.allProperties) {
		const { type, name } = parsePropertyId(id);
		if (type !== 'note') continue;
		const matches = keyed.every((g) =>
			g.entries.every((e) => {
				const v = e.getValue(id);
				return v !== null && g.key !== undefined && v.looseEquals(g.key);
			}),
		);
		if (matches) return name;
	}
	return null;
}

/** Lets the group title be clicked and edited inline to rename the group's value in every note. */
function makeRenamable(host: GroupHost, titleEl: HTMLElement, group: BasesEntryGroup, prop: string, groupId: string): void {
	const files = group.entries.map((e) => e.file).filter(isMarkdown);
	if (files.length === 0) return;

	const hasKey = group.hasKey() && group.key !== undefined;
	// Prefer the raw frontmatter text ("[[Link]]" rather than the rendered "Link").
	const first = files[0];
	const rawFirst: unknown = first ? host.app.metadataCache.getFileCache(first)?.frontmatter?.[prop] : undefined;
	const oldText = !hasKey
		? null
		: typeof rawFirst === 'string' || typeof rawFirst === 'number' || typeof rawFirst === 'boolean'
			? String(rawFirst)
			: (group.key?.toString() ?? '');

	titleEl.addClass('is-renamable');
	titleEl.setAttr('aria-label', hasKey ? `Click to rename "${prop}" in this group` : `Click to set "${prop}" for this group`);

	titleEl.addEventListener('click', (evt) => {
		evt.preventDefault();
		if (titleEl.querySelector('input')) return;

		titleEl.empty();
		const input = titleEl.createEl('input', { type: 'text', cls: 'bases-plus-group-rename' });
		input.value = oldText ?? '';
		input.placeholder = prop;
		input.focus();
		input.select();

		let finished = false;
		const finish = (commit: boolean) => {
			if (finished) return;
			finished = true;
			const next = input.value.trim();
			if (!commit || next === '' || next === oldText) {
				host.onDataUpdated();
				return;
			}
			confirmRename(host, files, prop, oldText, next, groupId);
		};
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.isComposing) {
				e.preventDefault();
				finish(true);
			} else if (e.key === 'Escape') {
				e.preventDefault();
				e.stopPropagation();
				finish(false);
			}
		});
		input.addEventListener('blur', () => finish(true));
	});
}

function confirmRename(
	host: GroupHost,
	files: TFile[],
	prop: string,
	oldText: string | null,
	next: string,
	groupId: string,
): void {
	const n = files.length;
	const notes = `${n} ${n === 1 ? 'note' : 'notes'}`;
	new ConfirmModal(
		host.app,
		oldText === null ? `Set "${prop}" for ${notes}?` : `Rename group in ${notes}?`,
		oldText === null
			? `"${prop}" will be set to "${next}" in every note in this group.`
			: `"${prop}" will change from "${oldText}" to "${next}" in every note in this group.`,
		oldText === null ? 'Set' : 'Rename',
		(ok) => {
			if (!ok) {
				host.onDataUpdated();
				return;
			}
			// Keep a collapsed group collapsed under its new name.
			const keys = getCollapsed(host.config);
			if (keys.delete(groupId)) {
				keys.add(next);
				setCollapsed(host.config, keys);
			}
			void renameGroupValue(host.app, files, prop, oldText, next);
		},
	).open();
}
