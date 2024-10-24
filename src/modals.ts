import {App, Modal, Notice} from "obsidian";

export class SystemDictionaryPathModal extends Modal {
	onSubmit: (path: string) => void;

	constructor(app: App, onSubmit: (path: string) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const {contentEl} = this;

		contentEl.createEl('h2', {text: 'Select System Dictionary File'});

		// Create file input
		const fileInput = contentEl.createEl('input', {
			type: 'file',
			// @ts-ignore
			accept: ".txt" // Limiting to text files
		});

		// Create a submit button
		const submitButton = contentEl.createEl('button', {text: 'Submit'});

		// On submit button click, fetch the selected file path
		submitButton.onclick = () => {
			const file = fileInput.files?.[0]; // Access selected file
			if (file) {
				// @ts-ignore
				const filePath = file.path || file.name; // Use path if available
				this.onSubmit(filePath);
				this.close();
			} else {
				new Notice("No file selected. Please select a system dictionary file.");
			}
		};
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}
