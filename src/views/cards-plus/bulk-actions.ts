import { App, Menu, TFile } from 'obsidian';
import { addTags, deleteFiles, isMarkdown, removeProperties, setProperty } from '../../bulk';
import { AddTagsModal, ConfirmModal, RemovePropertiesModal, SetPropertyModal } from '../../modals';

/** What the bulk actions need from the view. */
export interface BulkActionsHost {
	readonly app: App;
	selectedFiles(): TFile[];
	/** Note property names offered as suggestions in "Set property". */
	knownPropertyNames(): string[];
	/** Called after the selected files were deleted. */
	onFilesDeleted(): void;
}

/** The bulk actions on selected cards: each opens its dialog, then runs the edit from `bulk.ts`. */
export class BulkActions {
	constructor(private host: BulkActionsHost) {}

	addTags(): void {
		const { app } = this.host;
		const files = this.host.selectedFiles();
		if (files.length === 0) return;
		new AddTagsModal(app, files.length, (tags) => void addTags(app, files, tags)).open();
	}

	setProperty(): void {
		const { app } = this.host;
		const files = this.host.selectedFiles();
		if (files.length === 0) return;
		new SetPropertyModal(app, files, this.host.knownPropertyNames(), (key, value) => {
			void setProperty(app, files, key, value);
		}).open();
	}

	removeProperties(): void {
		const { app } = this.host;
		const files = this.host.selectedFiles().filter(isMarkdown);
		if (files.length === 0) return;
		new RemovePropertiesModal(app, files, (keys) => void removeProperties(app, files, keys)).open();
	}

	delete(): void {
		const { app } = this.host;
		const files = this.host.selectedFiles();
		if (files.length === 0) return;
		const n = files.length;
		new ConfirmModal(
			app,
			`Delete ${n} ${n === 1 ? 'file' : 'files'}?`,
			'The files are moved to trash according to your "Deleted files" setting.',
			'Delete',
			(ok) => {
				if (!ok) return;
				void deleteFiles(app, files).then(() => this.host.onFilesDeleted());
			},
		).open();
	}

	/** Adds the bulk actions to a right-click menu. */
	addMenuItems(menu: Menu): void {
		const count = this.host.selectedFiles().length;
		menu.addItem((i) => i.setTitle('Add tags').setIcon('lucide-tag').onClick(() => this.addTags()));
		menu.addItem((i) => i.setTitle('Set property').setIcon('lucide-pencil').onClick(() => this.setProperty()));
		menu.addItem((i) =>
			i.setTitle('Remove properties').setIcon('lucide-eraser').onClick(() => this.removeProperties()),
		);
		menu.addItem((i) =>
			i.setTitle(`Delete ${count} files`).setIcon('lucide-trash-2').setWarning(true).onClick(() => this.delete()),
		);
		menu.addSeparator();
	}
}
