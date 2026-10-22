import { AbstractInputSuggest, App, Modal, Setting, TFile } from 'obsidian';
import { collectPropertyCounts, parseTagInput } from './bulk';

class PropertyNameSuggest extends AbstractInputSuggest<string> {
	constructor(
		app: App,
		private inputEl: HTMLInputElement,
		private names: string[],
	) {
		super(app, inputEl);
	}

	protected getSuggestions(query: string): string[] {
		const q = query.toLowerCase();
		return this.names.filter((n) => n.toLowerCase().includes(q));
	}

	renderSuggestion(name: string, el: HTMLElement): void {
		el.setText(name);
	}

	selectSuggestion(name: string): void {
		this.setValue(name);
		this.inputEl.dispatchEvent(new Event('input'));
		this.close();
	}
}

function submitOnEnter(inputEl: HTMLInputElement, submit: () => void): void {
	inputEl.addEventListener('keydown', (evt) => {
		if (evt.key === 'Enter' && !evt.isComposing) {
			evt.preventDefault();
			submit();
		}
	});
}

export class ConfirmModal extends Modal {
	private confirmed = false;

	constructor(
		app: App,
		private heading: string,
		private message: string,
		private ctaText: string,
		private onResult: (confirmed: boolean) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(this.heading);
		this.contentEl.createEl('p', { text: this.message });
		new Setting(this.contentEl)
			.addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((b) =>
				b
					.setButtonText(this.ctaText)
					.setDestructive()
					.onClick(() => {
						this.confirmed = true;
						this.close();
					}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
		this.onResult(this.confirmed);
	}
}

export class AddTagsModal extends Modal {
	constructor(
		app: App,
		private count: number,
		private onSubmit: (tags: string[]) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(`Add tags to ${this.count} ${this.count === 1 ? 'note' : 'notes'}`);
		let input = '';
		const submit = () => {
			const tags = parseTagInput(input);
			if (tags.length === 0) return;
			this.close();
			this.onSubmit(tags);
		};

		new Setting(this.contentEl)
			.setName('Tags')
			.setDesc('Separate with commas or spaces. Tags a note already has are skipped.')
			.addText((text) => {
				text.setPlaceholder('project, status/active').onChange((v) => (input = v));
				submitOnEnter(text.inputEl, submit);
				window.setTimeout(() => text.inputEl.focus(), 0);
			});

		new Setting(this.contentEl)
			.addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((b) => b.setButtonText('Add tags').setCta().onClick(submit));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

type PropertyKind = 'text' | 'list' | 'number' | 'checkbox' | 'date' | 'datetime';

const KIND_LABELS: Record<PropertyKind, string> = {
	text: 'Text',
	list: 'List',
	number: 'Number',
	checkbox: 'Checkbox',
	date: 'Date',
	datetime: 'Date & time',
};

// Guesses the property type from values it already has in the selected notes.
function inferKind(app: App, files: TFile[], key: string): PropertyKind | null {
	for (const file of files) {
		const value: unknown = app.metadataCache.getFileCache(file)?.frontmatter?.[key];
		if (value === undefined || value === null) continue;
		if (Array.isArray(value)) return 'list';
		if (typeof value === 'number') return 'number';
		if (typeof value === 'boolean') return 'checkbox';
		if (typeof value === 'string') {
			if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'date';
			if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return 'datetime';
			return 'text';
		}
	}
	return null;
}

export class SetPropertyModal extends Modal {
	private key = '';
	private kind: PropertyKind = 'text';
	private rawValue = '';
	private boolValue = true;
	private valueContainer!: HTMLElement;
	private errorEl!: HTMLElement;

	constructor(
		app: App,
		private files: TFile[],
		private knownNames: string[],
		private onSubmit: (key: string, value: unknown) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(`Set property on ${this.files.length} ${this.files.length === 1 ? 'note' : 'notes'}`);
		this.contentEl.createEl('p', {
			cls: 'setting-item-description',
			text: 'Existing values of this property are overwritten.',
		});

		let kindDropdownSet: (kind: PropertyKind) => void = () => {};

		new Setting(this.contentEl).setName('Property').addText((text) => {
			text.setPlaceholder('status').onChange((v) => {
				this.key = v.trim();
				const inferred = inferKind(this.app, this.files, this.key);
				if (inferred && inferred !== this.kind) kindDropdownSet(inferred);
			});
			new PropertyNameSuggest(this.app, text.inputEl, this.knownNames);
			window.setTimeout(() => text.inputEl.focus(), 0);
		});

		new Setting(this.contentEl).setName('Type').addDropdown((dd) => {
			dd.addOptions(KIND_LABELS)
				.setValue(this.kind)
				.onChange((v) => {
					this.kind = v as PropertyKind;
					this.renderValueInput();
				});
			kindDropdownSet = (kind) => {
				dd.setValue(kind);
				this.kind = kind;
				this.renderValueInput();
			};
		});

		this.valueContainer = this.contentEl.createDiv();
		this.renderValueInput();
		this.errorEl = this.contentEl.createDiv('bases-plus-modal-error');

		new Setting(this.contentEl)
			.addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((b) => b.setButtonText('Set property').setCta().onClick(() => this.submit()));
	}

	private renderValueInput(): void {
		this.valueContainer.empty();
		const setting = new Setting(this.valueContainer).setName('Value');

		if (this.kind === 'checkbox') {
			setting.addToggle((t) => t.setValue(this.boolValue).onChange((v) => (this.boolValue = v)));
			return;
		}

		setting.addText((text) => {
			const inputType = { number: 'number', date: 'date', datetime: 'datetime-local' }[this.kind as string];
			if (inputType) text.inputEl.type = inputType;
			if (this.kind === 'list') text.setPlaceholder('a, b, c');
			text.setValue(this.rawValue).onChange((v) => (this.rawValue = v));
			submitOnEnter(text.inputEl, () => this.submit());
		});
	}

	private parseValue(): { ok: true; value: unknown } | { ok: false; error: string } {
		const raw = this.rawValue.trim();
		switch (this.kind) {
			case 'checkbox':
				return { ok: true, value: this.boolValue };
			case 'number': {
				const n = Number(raw);
				if (raw === '' || !Number.isFinite(n)) return { ok: false, error: 'Enter a valid number.' };
				return { ok: true, value: n };
			}
			case 'list':
				return {
					ok: true,
					value: raw
						.split(',')
						.map((s) => s.trim())
						.filter((s) => s.length > 0),
				};
			case 'date':
			case 'datetime':
				if (!raw) return { ok: false, error: 'Pick a date.' };
				return { ok: true, value: raw };
			default:
				return { ok: true, value: raw };
		}
	}

	private submit(): void {
		if (!this.key) {
			this.errorEl.setText('Enter a property name.');
			return;
		}
		const parsed = this.parseValue();
		if (!parsed.ok) {
			this.errorEl.setText(parsed.error);
			return;
		}
		this.close();
		this.onSubmit(this.key, parsed.value);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export class RemovePropertiesModal extends Modal {
	constructor(
		app: App,
		private files: TFile[],
		private onSubmit: (keys: string[]) => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle(`Remove properties from ${this.files.length} ${this.files.length === 1 ? 'note' : 'notes'}`);
		const counts = collectPropertyCounts(this.app, this.files);

		if (counts.size === 0) {
			this.contentEl.createEl('p', { text: 'The selected notes have no properties.' });
			new Setting(this.contentEl).addButton((b) => b.setButtonText('Close').onClick(() => this.close()));
			return;
		}

		const chosen = new Set<string>();
		let removeButton: { setDisabled(d: boolean): unknown } | null = null;

		const listEl = this.contentEl.createDiv('bases-plus-property-list');
		const sorted = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
		for (const [key, count] of sorted) {
			new Setting(listEl)
				.setName(key)
				.setDesc(`In ${count} of ${this.files.length}`)
				.addToggle((t) =>
					t.onChange((on) => {
						if (on) chosen.add(key);
						else chosen.delete(key);
						removeButton?.setDisabled(chosen.size === 0);
					}),
				);
		}

		new Setting(this.contentEl)
			.addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()))
			.addButton((b) => {
				removeButton = b;
				b.setButtonText('Remove')
					.setDestructive()
					.setDisabled(true)
					.onClick(() => {
						if (chosen.size === 0) return;
						this.close();
						this.onSubmit([...chosen]);
					});
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
