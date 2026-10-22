import { App, PluginSettingTab, SettingDefinitionItem } from 'obsidian';
import type BasesPlusPlugin from './main';

export interface BasesPlusSettings {
	groupHeaderSize: number;
	selectButtonPlacement: 'toolbar' | 'view';
}

export const DEFAULT_SETTINGS: BasesPlusSettings = {
	groupHeaderSize: 16,
	selectButtonPlacement: 'toolbar',
};

// Uses the declarative settings API (Obsidian 1.13+), so settings show up in settings search.
export class BasesPlusSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private plugin: BasesPlusPlugin,
	) {
		super(app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'Group header size',
				desc: 'Font size of group headers in Cards Plus views, in pixels.',
				aliases: ['font', 'heading', 'group'],
				control: {
					type: 'slider',
					key: 'groupHeaderSize',
					min: 10,
					max: 40,
					step: 1,
					defaultValue: DEFAULT_SETTINGS.groupHeaderSize,
					displayFormat: (v) => `${v}px`,
				},
			},
			{
				name: 'Select button placement',
				desc: 'Where the Select button appears in Cards Plus views. "Bases toolbar" puts it next to Sort, Group and Filter; if the toolbar can\'t be found, it falls back to a row above the cards. The "Toggle select mode" command works either way.',
				aliases: ['select mode', 'multi select', 'toolbar'],
				control: {
					type: 'dropdown',
					key: 'selectButtonPlacement',
					defaultValue: DEFAULT_SETTINGS.selectButtonPlacement,
					options: {
						toolbar: 'Bases toolbar',
						view: 'Row above the cards',
					},
				},
			},
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		await super.setControlValue(key, value);
		this.plugin.applySettings();
	}
}
