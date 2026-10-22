import { App, BasesEntry, BasesPropertyId, BasesViewConfig, HoverParent, Keymap, TFile } from 'obsidian';
import { renderCover } from './cover';
import { RenderSettings } from './options';
import { SelectionState } from './selection';

/** What a card needs from the view that renders it. */
export interface CardHost extends HoverParent {
	readonly app: App;
	readonly config: BasesViewConfig;
	readonly selection: SelectionState;
	/** Called when a card is clicked in select mode. */
	selectCard(file: TFile, range: boolean): void;
	showCardMenu(evt: MouseEvent, file: TFile): void;
}

/** Renders one card and returns its element. */
export function renderCard(host: CardHost, gridEl: HTMLElement, entry: BasesEntry, settings: RenderSettings): HTMLElement {
	const { app } = host;
	const file = entry.file;
	const cardEl = gridEl.createDiv('bases-plus-card');

	if (settings.imageProp) {
		renderCover(app, cardEl, entry, settings.imageProp, settings.imageFallbackProp, settings.imageFit);
	}

	const bodyEl = cardEl.createDiv('bases-plus-card-body');
	const titleProp = renderTitle(host, bodyEl, entry, settings.titleProp);

	for (const propId of settings.order) {
		// Don't repeat whatever the title already shows.
		if (propId === titleProp) continue;

		const value = entry.getValue(propId);
		if (!value || !value.isTruthy()) continue;

		const propEl = bodyEl.createDiv('bases-plus-card-property');
		if (settings.showLabels) {
			propEl.createDiv({ cls: 'bases-plus-card-label', text: host.config.getDisplayName(propId) });
		}
		value.renderTo(propEl.createDiv('bases-plus-card-value'), app.renderContext);
	}

	cardEl.addEventListener('click', (evt) => {
		if (host.selection.active) {
			evt.preventDefault();
			host.selectCard(file, evt.shiftKey);
			return;
		}
		// Let links and tags rendered inside property values handle their own clicks.
		const target = evt.target as HTMLElement;
		if (target.closest('a, .tag, .internal-link, .external-link, input, button')) return;

		evt.preventDefault();
		void app.workspace.openLinkText(file.path, '', Keymap.isModEvent(evt));
	});
	cardEl.addEventListener('auxclick', (evt) => {
		if (evt.button !== 1 || host.selection.active) return;
		evt.preventDefault();
		void app.workspace.openLinkText(file.path, '', 'tab');
	});
	cardEl.addEventListener('contextmenu', (evt) => host.showCardMenu(evt, file));

	return cardEl;
}

/** Renders the card title and returns the property it shows. */
function renderTitle(
	host: CardHost,
	bodyEl: HTMLElement,
	entry: BasesEntry,
	titleProp: BasesPropertyId | null,
): BasesPropertyId {
	const { app } = host;
	const file = entry.file;
	const titleEl = bodyEl.createDiv('bases-plus-card-title');

	// Fall back to the file name when the title property is empty for this note.
	const value = titleProp ? entry.getValue(titleProp) : null;
	let shown: BasesPropertyId = 'file.name';
	if (titleProp && value && value.isTruthy()) {
		value.renderTo(titleEl, app.renderContext);
		shown = titleProp;
	} else {
		titleEl.setText(file.basename);
	}
	titleEl.setAttr('title', titleEl.textContent ?? file.basename);

	titleEl.addEventListener('mouseover', (evt) => {
		if (host.selection.active) return;
		app.workspace.trigger('hover-link', {
			event: evt,
			source: 'bases',
			hoverParent: host,
			targetEl: titleEl,
			linktext: file.path,
		});
	});
	return shown;
}
