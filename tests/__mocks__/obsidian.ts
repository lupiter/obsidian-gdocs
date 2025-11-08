// Mock Obsidian module for testing
export class App {}

export class Plugin {
	app: App;
	constructor(app: App, manifest: any) {
		this.app = app;
	}
	addCommand(command: any) {}
	addRibbonIcon(icon: string, title: string, callback: Function) {}
	addSettingTab(tab: any) {}
	registerEvent(event: any) {}
	registerDomEvent(el: any, type: string, callback: Function) {}
	registerInterval(interval: number) {}
	loadData(): Promise<any> {
		return Promise.resolve({});
	}
	saveData(data: any): Promise<void> {
		return Promise.resolve();
	}
}

export class PluginSettingTab {
	app: App;
	plugin: any;
	constructor(app: App, plugin: any) {
		this.app = app;
		this.plugin = plugin;
	}
	display(): void {}
	hide(): void {}
}

export class Modal {
	app: App;
	contentEl: HTMLElement;
	constructor(app: App) {
		this.app = app;
		this.contentEl = document.createElement('div');
	}
	open() {}
	close() {}
	onOpen() {}
	onClose() {}
}

export class Menu {
	addItem(callback: (item: MenuItem) => void) {}
	showAtMouseEvent(event: MouseEvent) {}
}

export class MenuItem {
	setTitle(title: string) {
		return this;
	}
	setIcon(icon: string) {
		return this;
	}
	onClick(callback: Function) {
		return this;
	}
}

export class Setting {
	constructor(containerEl: HTMLElement) {}
	setName(name: string) {
		return this;
	}
	setDesc(desc: string) {
		return this;
	}
	addText(callback: Function) {
		return this;
	}
	addToggle(callback: Function) {
		return this;
	}
	addDropdown(callback: Function) {
		return this;
	}
	addButton(callback: Function) {
		return this;
	}
}

export class Notice {
	constructor(message: string, timeout?: number) {}
}

export class TFile {
	name: string = '';
	basename: string = '';
	extension: string = '';
	path: string = '';
	parent: TFolder | null = null;
}

export class TFolder {
	name: string = '';
	path: string = '';
	children: Array<TFile | TFolder> = [];
	parent: TFolder | null = null;
}

export class Vault {
	getAbstractFileByPath(path: string): TFile | TFolder | null {
		return null;
	}
	read(file: TFile): Promise<string> {
		return Promise.resolve('');
	}
	modify(file: TFile, content: string): Promise<void> {
		return Promise.resolve();
	}
	create(path: string, content: string): Promise<TFile> {
		return Promise.resolve(new TFile());
	}
	delete(file: TFile): Promise<void> {
		return Promise.resolve();
	}
	getAllLoadedFiles(): Array<TFile | TFolder> {
		return [];
	}
}

export class MarkdownView {
	file: TFile | null = null;
}

export class Editor {
	getSelection(): string {
		return '';
	}
	replaceSelection(text: string) {}
}
