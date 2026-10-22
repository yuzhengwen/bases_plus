import { BasesView, HoverParent, HoverPopover, Menu, QueryController, TFile, parsePropertyId } from 'obsidian';
import type BasesPlusPlugin from '../../main';
import { BulkActions, BulkActionsHost } from './bulk-actions';
import { CardHost, renderCard } from './card';
import { GroupHost, getCollapsed, getGroupByProperty, groupKeyId, renderGroupHeader, syncGroupButton } from './groups';
import { CardsPlusViewType, applyLayout, readRenderSettings } from './options';
import { SelectionState } from './selection';
import { NativeSelectButton, renderSelectBar } from './toolbar';

/**
 * The Cards Plus Bases view. This class wires the pieces together; rendering
 * and behavior live in the sibling modules (card, groups, toolbar, …).
 */
export class CardsPlusView extends BasesView implements HoverParent, CardHost, GroupHost, BulkActionsHost {
	readonly type = CardsPlusViewType;
	hoverPopover: HoverPopover | null = null;
	readonly selection = new SelectionState();

	private rootEl: HTMLElement;
	private barEl: HTMLElement;
	private scrollEl: HTMLElement;
	private cardEls = new Map<string, HTMLElement>();
	private groupButtons: { files: TFile[]; button: HTMLButtonElement }[] = [];
	private nativeSelect: NativeSelectButton;
	private actions = new BulkActions(this);

	constructor(
		controller: QueryController,
		parentEl: HTMLElement,
		private plugin: BasesPlusPlugin,
	) {
		super(controller);
		plugin.views.add(this);
		this.rootEl = parentEl.createDiv('bases-plus-view');
		this.barEl = this.rootEl.createDiv('bases-plus-toolbar');
		this.scrollEl = this.rootEl.createDiv('bases-plus-scroll');
		this.nativeSelect = new NativeSelectButton(this.rootEl, () => this.toggleSelectMode());

		this.registerDomEvent(activeDocument, 'keydown', (evt) => {
			if (!this.selection.active || evt.key !== 'Escape') return;
			const target = evt.target as Node | null;
			if (target === activeDocument.body || (target && this.rootEl.contains(target))) {
				this.setSelectMode(false);
			}
		});

		this.renderBar();
	}

	onunload(): void {
		this.nativeSelect.remove();
		this.plugin.views.delete(this);
	}

	public onDataUpdated(): void {
		const settings = readRenderSettings(this.config);
		applyLayout(this.rootEl, this.config);

		const scrollTop = this.scrollEl.scrollTop;
		this.scrollEl.empty();
		this.cardEls.clear();
		this.groupButtons = [];

		const groups = this.data.groupedData;
		const isGrouped = groups.some((g) => g.hasKey());
		const groupProp = isGrouped ? getGroupByProperty(this, groups) : null;
		const collapsed = getCollapsed(this.config);
		const files: TFile[] = [];

		for (const group of groups) {
			if (group.entries.length === 0) continue;
			const groupEl = this.scrollEl.createDiv('bases-plus-group');

			if (isGrouped) {
				const groupFiles = group.entries.map((e) => e.file);
				const button = renderGroupHeader(this, groupEl, group, {
					groupProp,
					collapsed: collapsed.has(groupKeyId(group)),
					onSelectGroup: () => {
						this.selection.toggleAll(groupFiles);
						this.refreshSelectionUI();
					},
				});
				this.groupButtons.push({ files: groupFiles, button });
			}

			const gridEl = groupEl.createDiv('bases-plus-grid');
			for (const entry of group.entries) {
				files.push(entry.file);
				this.cardEls.set(entry.file.path, renderCard(this, gridEl, entry, settings));
			}
		}

		if (files.length === 0) {
			this.scrollEl.createDiv({ cls: 'bases-plus-empty', text: 'No results.' });
		}

		this.selection.setFiles(files);
		this.scrollEl.scrollTop = scrollTop;
		this.refreshSelectionUI();
	}

	// ------------------------------------------- used by the plugin (commands, settings)

	public toggleSelectMode(): void {
		this.setSelectMode(!this.selection.active);
	}

	/** True if this view is visible inside `container` (used to find the view a command targets). */
	public isShownIn(container: HTMLElement): boolean {
		return container.contains(this.rootEl) && this.rootEl.isShown();
	}

	/** Re-renders the bar, e.g. after the Select button placement setting changes. */
	public refreshToolbar(): void {
		this.renderBar();
	}

	// ------------------------------------------------------ CardHost

	public selectCard(file: TFile, range: boolean): void {
		this.selection.toggle(file, range);
		this.refreshSelectionUI();
	}

	public showCardMenu(evt: MouseEvent, file: TFile): void {
		evt.preventDefault();
		const menu = new Menu();
		const { selection } = this;

		if (selection.active && selection.has(file.path) && selection.size > 1) {
			this.actions.addMenuItems(menu);
			this.app.workspace.trigger('files-menu', menu, this.selectedFiles(), 'bases-plus');
		} else {
			menu.addItem((item) =>
				item
					.setTitle(selection.active ? 'Toggle selection' : 'Select')
					.setIcon('lucide-check-square')
					.onClick(() => {
						if (!selection.active) selection.setActive(true);
						this.selectCard(file, false);
					}),
			);
			menu.addSeparator();
			this.app.workspace.trigger('file-menu', menu, file, 'bases-plus');
		}
		menu.showAtMouseEvent(evt);
	}

	// ------------------------------------------------ BulkActionsHost

	public selectedFiles(): TFile[] {
		return this.selection.selectedFiles();
	}

	public knownPropertyNames(): string[] {
		const names = new Set<string>();
		for (const id of this.allProperties) {
			const { type, name } = parsePropertyId(id);
			if (type === 'note') names.add(name);
		}
		return [...names].sort((a, b) => a.localeCompare(b));
	}

	public onFilesDeleted(): void {
		this.selection.clear();
		this.refreshSelectionUI();
	}

	// ----------------------------------------------------- selection UI

	private setSelectMode(on: boolean): void {
		this.selection.setActive(on);
		this.refreshSelectionUI();
	}

	/** Syncs card outlines, group buttons and the bar with the current selection. */
	private refreshSelectionUI(): void {
		this.rootEl.toggleClass('is-select-mode', this.selection.active);
		for (const [path, el] of this.cardEls) el.toggleClass('is-selected', this.selection.has(path));
		for (const { files, button } of this.groupButtons) syncGroupButton(button, files, this.selection);
		this.renderBar();
	}

	private renderBar(): void {
		const wantNative = this.plugin.settings.selectButtonPlacement === 'toolbar';
		const hasNativeButton = wantNative && this.nativeSelect.show(this.selection.active);
		if (!hasNativeButton) this.nativeSelect.remove();

		renderSelectBar(this.barEl, {
			selection: this.selection,
			actions: this.actions,
			hasNativeButton,
			setSelectMode: (on) => this.setSelectMode(on),
			onSelectionChange: () => this.refreshSelectionUI(),
		});
	}
}
