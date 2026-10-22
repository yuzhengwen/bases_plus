import { App, BasesEntry, BasesPropertyId } from 'obsidian';
import { CoverImage, resolveCoverImage } from '../../image';

/**
 * Renders the cover area of a card. Uses `imageProp`, or `fallbackProp` when
 * the main property is empty, doesn't resolve, or its image fails to load.
 */
export function renderCover(
	app: App,
	cardEl: HTMLElement,
	entry: BasesEntry,
	imageProp: BasesPropertyId,
	fallbackProp: BasesPropertyId | null,
	fit: 'cover' | 'contain',
): void {
	const coverEl = cardEl.createDiv('bases-plus-card-cover');
	coverEl.toggleClass('is-contain', fit === 'contain');

	const resolveFallback = () => (fallbackProp ? resolveCoverImage(app, entry, fallbackProp) : null);
	const primary = resolveCoverImage(app, entry, imageProp);
	showCover(coverEl, primary ?? resolveFallback(), primary ? resolveFallback : null);
}

/**
 * Shows an image or color in the cover. If an image fails to load and
 * `onError` is given, it falls back to whatever that returns (once).
 */
function showCover(coverEl: HTMLElement, cover: CoverImage | null, onError: (() => CoverImage | null) | null): void {
	if (!cover) {
		coverEl.addClass('is-empty');
		return;
	}
	if (cover.kind === 'color') {
		coverEl.setCssStyles({ backgroundColor: cover.color });
		return;
	}

	const img = coverEl.createEl('img', {
		attr: { src: cover.src, loading: 'lazy', decoding: 'async', draggable: 'false', alt: '' },
	});
	img.addEventListener('error', () => {
		img.remove();
		const next = onError?.();
		if (next && !(next.kind === 'url' && next.src === cover.src)) showCover(coverEl, next, null);
		else coverEl.addClass('is-empty');
	});
}
