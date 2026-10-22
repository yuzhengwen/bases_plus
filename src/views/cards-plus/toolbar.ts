import { setIcon } from 'obsidian';
import { BulkActions } from './bulk-actions';
import { SelectionState } from './selection';

/**
 * The "Select" item in the Bases toolbar (next to Sort, Group, Filter…).
 * There is no API for this, so it is inserted into the toolbar's DOM and
 * re-inserted if Obsidian rebuilds the toolbar.
 */
export class NativeSelectButton {
	private itemEl: HTMLElement | null = null;
	private observer: MutationObserver | null = null;
	private active = false;

	/**
	 * @param viewEl An element inside the base; the toolbar is looked up from there.
	 * @param onClick Called when the button is clicked or activated by keyboard.
	 */
	constructor(
		private viewEl: HTMLElement,
		private onClick: () => void,
	) {}

	/** Shows the button with the given active state. Returns false if no toolbar was found. */
	show(active: boolean): boolean {
		this.active = active;
		const toolbar = this.findToolbar();
		if (!toolbar) return false;

		const item = this.itemEl ?? this.create();
		if (item.parentElement !== toolbar) {
			// After "Properties", before "Search" and "New".
			toolbar.insertBefore(item, toolbar.querySelector(':scope > .bases-toolbar-search'));

			this.observer?.disconnect();
			this.observer = new MutationObserver(() => {
				if (this.itemEl && this.itemEl.parentElement !== toolbar) this.show(this.active);
			});
			this.observer.observe(toolbar, { childList: true });
		}

		item.querySelector('.text-icon-button')?.toggleClass('is-active', active);
		return true;
	}

	remove(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.itemEl?.remove();
		this.itemEl = null;
	}

	private create(): HTMLElement {
		const item = createDiv('bases-toolbar-item bases-plus-select-menu');
		const button = item.createDiv({ cls: 'text-icon-button tappable', attr: { tabindex: '0', role: 'button' } });
		setIcon(button.createSpan('text-button-icon'), 'lucide-check-square');
		button.createSpan({ cls: 'text-button-label', text: 'Select' });
		button.addEventListener('click', this.onClick);
		button.addEventListener('keydown', (evt) => {
			if (evt.key === 'Enter' || evt.key === ' ') {
				evt.preventDefault();
				this.onClick();
			}
		});
		this.itemEl = item;
		return item;
	}

	// The Bases toolbar belongs to the nearest enclosing base (a tab or an embed).
	private findToolbar(): HTMLElement | null {
		for (let el = this.viewEl.parentElement; el; el = el.parentElement) {
			const toolbar = el.querySelector<HTMLElement>('.bases-toolbar');
			if (toolbar) return toolbar;
			if (el.hasClass('workspace-leaf-content')) break;
		}
		return null;
	}
}

export interface SelectBarOptions {
	selection: SelectionState;
	actions: BulkActions;
	/** True if the Select button is in the Bases toolbar, so the bar can hide outside select mode. */
	hasNativeButton: boolean;
	setSelectMode: (on: boolean) => void;
	/** Called after the selection changed from inside the bar. */
	onSelectionChange: () => void;
}

/**
 * Renders the bar above the cards: the bulk-action bar in select mode,
 * otherwise a Select button (or nothing, if that button is in the Bases toolbar).
 */
export function renderSelectBar(bar: HTMLElement, opts: SelectBarOptions): void {
	const { selection, actions } = opts;
	bar.empty();

	if (!selection.active) {
		bar.toggleClass('is-hidden', opts.hasNativeButton);
		if (!opts.hasNativeButton) {
			bar.createDiv('bases-plus-toolbar-spacer');
			barButton(bar, 'lucide-check-square', 'Select', () => opts.setSelectMode(true));
		}
		return;
	}

	bar.removeClass('is-hidden');
	renderSelectAllToggle(bar, selection, opts.onSelectionChange);
	bar.createDiv({ cls: 'bases-plus-toolbar-count', text: `${selection.size} selected` });
	bar.createDiv('bases-plus-toolbar-spacer');

	const none = selection.size === 0;
	barButton(bar, 'lucide-tag', 'Add tags', () => actions.addTags(), none);
	barButton(bar, 'lucide-pencil', 'Set property', () => actions.setProperty(), none);
	barButton(bar, 'lucide-eraser', 'Remove properties', () => actions.removeProperties(), none);
	barButton(bar, 'lucide-trash-2', 'Delete', () => actions.delete(), none).addClass('is-danger');
	barButton(bar, 'lucide-x', 'Done', () => opts.setSelectMode(false));
}

/** A "Select all" checkbox; shows a partial state when only some cards are selected. */
function renderSelectAllToggle(parent: HTMLElement, selection: SelectionState, onChange: () => void): void {
	const labelEl = parent.createEl('label', { cls: 'bases-plus-select-toggle' });
	const checkbox = labelEl.createEl('input', { type: 'checkbox' });
	labelEl.createSpan({ text: 'Select all' });

	const files = selection.files;
	const n = selection.countIn(files);
	checkbox.checked = n > 0 && n === files.length;
	checkbox.indeterminate = n > 0 && n < files.length;

	checkbox.addEventListener('change', () => {
		selection.toggleAll(files);
		onChange();
	});
}

function barButton(
	parent: HTMLElement,
	icon: string,
	label: string,
	onClick: () => void,
	disabled = false,
): HTMLButtonElement {
	const btn = parent.createEl('button', { cls: 'bases-plus-toolbar-button' });
	setIcon(btn.createSpan('bases-plus-toolbar-icon'), icon);
	btn.createSpan({ cls: 'bases-plus-toolbar-label', text: label });
	btn.setAttr('aria-label', label);
	btn.disabled = disabled;
	btn.addEventListener('click', onClick);
	return btn;
}
