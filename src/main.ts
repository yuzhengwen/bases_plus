import { ItemView, Plugin } from 'obsidian';
import { BasesPlusSettingTab, BasesPlusSettings, DEFAULT_SETTINGS } from './settings';
import { CardsPlusView } from './views/cards-plus/CardsPlusView';
import { CardsPlusViewType, getCardsPlusOptions } from './views/cards-plus/options';

export default class BasesPlusPlugin extends Plugin {
	settings!: BasesPlusSettings;
	/** Open Cards Plus views, so commands and settings changes can reach them. */
	views = new Set<CardsPlusView>();

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new BasesPlusSettingTab(this.app, this));
		this.applySettings();

		// Tell Obsidian about the new Bases view type this plugin provides.
		// It shows up in the view picker of any .base file.
		this.registerBasesView(CardsPlusViewType, {
			name: 'Cards Plus',
			icon: 'lucide-layout-grid',
			factory: (controller, containerEl) => new CardsPlusView(controller, containerEl, this),
			options: getCardsPlusOptions,
		});

		this.addCommand({
			id: 'toggle-select-mode',
			name: 'Toggle select mode',
			checkCallback: (checking) => {
				const view = this.getActiveCardsView();
				if (!view) return false;
				if (!checking) view.toggleSelectMode();
				return true;
			},
		});
	}

	onunload() {
		activeDocument.body.style.removeProperty('--bases-plus-group-header-size');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, (await this.loadData()) as Partial<BasesPlusSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.applySettings();
	}

	// Global settings are exposed as CSS variables so every open view updates immediately.
	applySettings() {
		activeDocument.body.setCssProps({
			'--bases-plus-group-header-size': `${this.settings.groupHeaderSize}px`,
		});
		for (const view of this.views) view.refreshToolbar();
	}

	/** The Cards Plus view in the active tab (a .base file, or a note with an embedded base). */
	private getActiveCardsView(): CardsPlusView | null {
		const active = this.app.workspace.getActiveViewOfType(ItemView);
		if (!active) return null;
		for (const view of this.views) {
			if (view.isShownIn(active.containerEl)) return view;
		}
		return null;
	}
}
