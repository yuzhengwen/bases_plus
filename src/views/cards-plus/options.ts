import { BasesAllOptions, BasesPropertyId, BasesViewConfig } from 'obsidian';

export const CardsPlusViewType = 'bases-plus-cards';

// Keys under which view options are saved in the .base file.
const OPT_CARD_SIZE = 'cardSize';
const OPT_CARD_GAP = 'cardGap';
const OPT_TITLE = 'titleProperty';
const OPT_IMAGE = 'image';
const OPT_IMAGE_FALLBACK = 'imageFallback';
const OPT_IMAGE_FIT = 'imageFit';
const OPT_IMAGE_RATIO = 'imageAspectRatio';
const OPT_IMAGE_OVERLAY = 'imageFillsCard';
const OPT_TITLE_LINES = 'titleLines';
const OPT_SHOW_LABELS = 'showLabels';

const DEFAULT_CARD_SIZE = 200;
const DEFAULT_CARD_GAP = 12;
const DEFAULT_IMAGE_RATIO = 1;
const DEFAULT_TITLE_LINES = 2;

/** The options shown in the view's settings menu. */
export function getCardsPlusOptions(config: BasesViewConfig): BasesAllOptions[] {
	const noImage = () => !config.get(OPT_IMAGE);
	return [
		{
			type: 'slider',
			displayName: 'Card size',
			key: OPT_CARD_SIZE,
			default: DEFAULT_CARD_SIZE,
			min: 100,
			max: 600,
			step: 10,
		},
		{
			type: 'slider',
			displayName: 'Card gap',
			key: OPT_CARD_GAP,
			default: DEFAULT_CARD_GAP,
			min: 0,
			max: 48,
			step: 2,
		},
		{
			type: 'property',
			displayName: 'Title property',
			key: OPT_TITLE,
		},
		{
			type: 'property',
			displayName: 'Image property',
			key: OPT_IMAGE,
		},
		{
			// Used when the image property is empty, doesn't resolve, or fails to load.
			type: 'property',
			displayName: 'Fallback image property',
			key: OPT_IMAGE_FALLBACK,
			shouldHide: noImage,
		},
		{
			type: 'dropdown',
			displayName: 'Image fit',
			key: OPT_IMAGE_FIT,
			default: 'cover',
			options: { cover: 'Cover', contain: 'Contain' },
			shouldHide: noImage,
		},
		{
			type: 'slider',
			displayName: 'Image aspect ratio',
			key: OPT_IMAGE_RATIO,
			default: DEFAULT_IMAGE_RATIO,
			min: 0.25,
			max: 2.5,
			step: 0.05,
			shouldHide: noImage,
		},
		{
			// The image covers the whole card; title and properties slide in over it on hover.
			type: 'toggle',
			displayName: 'Image fills card (show info on hover)',
			key: OPT_IMAGE_OVERLAY,
			default: false,
			shouldHide: noImage,
		},
		{
			type: 'slider',
			displayName: 'Title lines (0 = no limit)',
			key: OPT_TITLE_LINES,
			default: DEFAULT_TITLE_LINES,
			min: 0,
			max: 6,
			step: 1,
		},
		{
			type: 'toggle',
			displayName: 'Show property labels',
			key: OPT_SHOW_LABELS,
			default: true,
		},
	];
}

/** Per-card rendering settings, read from the view config on every update. */
export interface RenderSettings {
	order: BasesPropertyId[];
	titleProp: BasesPropertyId | null;
	imageProp: BasesPropertyId | null;
	imageFallbackProp: BasesPropertyId | null;
	imageFit: 'cover' | 'contain';
	showLabels: boolean;
}

export function readRenderSettings(config: BasesViewConfig): RenderSettings {
	return {
		order: config.getOrder(),
		titleProp: config.getAsPropertyId(OPT_TITLE),
		imageProp: config.getAsPropertyId(OPT_IMAGE),
		imageFallbackProp: config.getAsPropertyId(OPT_IMAGE_FALLBACK),
		imageFit: config.get(OPT_IMAGE_FIT) === 'contain' ? 'contain' : 'cover',
		showLabels: config.get(OPT_SHOW_LABELS) !== false,
	};
}

/** Applies the size-related options as CSS variables on the view's root element. */
export function applyLayout(rootEl: HTMLElement, config: BasesViewConfig): void {
	const titleLines = numberOption(config, OPT_TITLE_LINES, DEFAULT_TITLE_LINES);
	rootEl.setCssProps({
		'--bases-plus-card-size': `${numberOption(config, OPT_CARD_SIZE, DEFAULT_CARD_SIZE)}px`,
		'--bases-plus-card-gap': `${numberOption(config, OPT_CARD_GAP, DEFAULT_CARD_GAP)}px`,
		'--bases-plus-image-ratio': String(numberOption(config, OPT_IMAGE_RATIO, DEFAULT_IMAGE_RATIO)),
		'--bases-plus-title-lines': String(Math.max(0, Math.round(titleLines))),
	});
	rootEl.toggleClass('has-title-clamp', titleLines > 0);
	rootEl.toggleClass('has-image-overlay', !!config.get(OPT_IMAGE) && config.get(OPT_IMAGE_OVERLAY) === true);
}

function numberOption(config: BasesViewConfig, key: string, fallback: number): number {
	const raw = config.get(key);
	const n = Number(raw);
	return raw === undefined || raw === null || !Number.isFinite(n) ? fallback : n;
}
