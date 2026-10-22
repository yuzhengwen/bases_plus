import { TFile } from 'obsidian';

/**
 * Select-mode state, without any DOM. Selection is tracked by path so it
 * survives re-renders (Bases recreates its entries on every update).
 */
export class SelectionState {
	active = false;
	/** Files in display order, used for Shift-click ranges and "Select all". */
	files: TFile[] = [];
	private selected = new Set<string>();
	private lastClickedPath: string | null = null;

	get size(): number {
		return this.selected.size;
	}

	has(path: string): boolean {
		return this.selected.has(path);
	}

	setActive(on: boolean): void {
		this.active = on;
		if (!on) this.clear();
	}

	clear(): void {
		this.selected.clear();
		this.lastClickedPath = null;
	}

	/** Updates the displayed files and drops selections for files no longer shown. */
	setFiles(files: TFile[]): void {
		this.files = files;
		const present = new Set(files.map((f) => f.path));
		for (const path of this.selected) if (!present.has(path)) this.selected.delete(path);
	}

	/** Toggles one file, or with `range` adds everything between the last clicked file and this one. */
	toggle(file: TFile, range: boolean): void {
		const from = range && this.lastClickedPath ? this.files.findIndex((f) => f.path === this.lastClickedPath) : -1;
		const to = this.files.findIndex((f) => f.path === file.path);
		if (from !== -1 && to !== -1) {
			const [start, end] = from < to ? [from, to] : [to, from];
			for (const f of this.files.slice(start, end + 1)) this.selected.add(f.path);
		} else if (this.selected.has(file.path)) {
			this.selected.delete(file.path);
		} else {
			this.selected.add(file.path);
		}
		this.lastClickedPath = file.path;
	}

	/** Selects all of `files`, or clears them if they are all selected already. Turns select mode on. */
	toggleAll(files: TFile[]): void {
		const allSelected = this.active && this.countIn(files) === files.length;
		for (const f of files) {
			if (allSelected) this.selected.delete(f.path);
			else this.selected.add(f.path);
		}
		this.active = true;
	}

	countIn(files: TFile[]): number {
		return files.filter((f) => this.selected.has(f.path)).length;
	}

	selectedFiles(): TFile[] {
		return this.files.filter((f) => this.selected.has(f.path));
	}
}
