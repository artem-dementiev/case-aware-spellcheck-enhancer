import {App, Notice, PluginSettingTab, Setting} from 'obsidian'
import {CaseAwareSpellcheckEnhancer} from "./plugin";
import {FormatStyle} from "./enums";
import {SystemDictionaryPathModal} from "./modals";
import {PLUGIN_NAME} from "./constants";

export interface CaseAwareSpellcheckEnhancerSettings {
	dictionaryPath: string;
	refreshInterval: number; // In seconds
	formatStyles: FormatStyle[];
	selectedDictionaries: string[]; // List of selected dictionaries (e.g., ['en', 'fr'])
	allowedExtensions: string;
}

export const DEFAULT_SETTINGS: CaseAwareSpellcheckEnhancerSettings = {
	dictionaryPath: "",
	refreshInterval: 30, // Default to 30 seconds
	formatStyles: [FormatStyle.CamelCase, FormatStyle.PascalCase], // Preselect some styles
	selectedDictionaries: ['en'],
	allowedExtensions: ".md,.txt"
};

export class CaseAwareSpellcheckEnhancerSettingTab extends PluginSettingTab {
	plugin: CaseAwareSpellcheckEnhancer;

	constructor(app: App, plugin: CaseAwareSpellcheckEnhancer) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: `${PLUGIN_NAME} Plugin Settings` });

		containerEl.createEl('h3', { text: 'Spell checking dictionaries' });
		const dictionaries = [
			{ code: 'en', name: 'English' },
			{ code: 'uk', name: 'Ukrainian' },
			{ code: 'ru', name: 'Russian' },
			{ code: 'fr', name: 'French' },
			{ code: 'de', name: 'German' }
		];

		dictionaries.forEach(dict => {
			const isChecked = this.plugin.settings.selectedDictionaries.includes(dict.code);

			// Create a checkbox for each dictionary
			new Setting(containerEl)
				.setName(dict.name)
				.addToggle(toggle => {
					toggle
						.setValue(isChecked)
						.onChange(async (value) => {
							// Update the selected dictionaries array
							if (value) {
								this.plugin.settings.selectedDictionaries.push(dict.code);
							} else {
								this.plugin.settings.selectedDictionaries = this.plugin.settings.selectedDictionaries.filter(code => code !== dict.code);
							}

							// Save settings and reload dictionaries
							await this.plugin.saveSettings();
							await this.plugin.loadSelectedDictionaries();
						});
				});
		});

		containerEl.createEl('h3', { text: 'System dictionary' });
		// Dictionary Path Setting (with modal window to select file)
		new Setting(containerEl)
			.setName('System Dictionary Path')
			.setDesc('Path to the system spellcheck dictionary file')
			.addButton(button => button
				.setButtonText("Select Dictionary File")
				.onClick(async () => {
					await this.openFilePicker();
				}));

		new Setting(containerEl)
			.setName('System Dictionary Path (View mode)')
			.setDesc('Path to the system spellcheck dictionary file')
			.addText(text => text.setValue(this.plugin.settings.dictionaryPath).setDisabled(true));

		containerEl.createEl('h3', { text: 'Miscellaneous' });
		new Setting(containerEl)
			.setName('Allowed File Extensions')
			.setDesc('Comma-separated list of file extensions (e.g., .md, .txt) in which the plugin should operate')
			.addText(text => text
				.setPlaceholder('Enter file extensions')
				.setValue(this.plugin.settings.allowedExtensions)
				.onChange(async (value) => {
					this.plugin.settings.allowedExtensions = value;
					await this.plugin.saveSettings();
					this.plugin.updateAllowedExtensions();
				}));

		new Setting(containerEl)
			.setName('Refresh Interval (seconds)')
			.setDesc('Time between content checks in seconds. New value will be used for a new active file or after restart')
			.addText(text => text
				.setPlaceholder('Enter time in seconds')
				.setValue(this.plugin.settings.refreshInterval.toString())
				.onChange(async (value) => {
					const interval = parseInt(value);
					if (!isNaN(interval) && interval > 0) {
						this.plugin.settings.refreshInterval = interval;
						await this.plugin.saveSettings();
					} else {
						new Notice("Please enter a valid number for the refresh interval.");
					}
				}));

		containerEl.createEl('h3', { text: 'Format Styles' });
		Object.values(FormatStyle).forEach((style) => {
			new Setting(containerEl)
				.setName(style)
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.formatStyles.includes(style as FormatStyle))
					.onChange(async (value) => {
						if (value) {
							this.plugin.settings.formatStyles.push(style as FormatStyle);
						} else {
							this.plugin.settings.formatStyles = this.plugin.settings.formatStyles.filter((s: FormatStyle) => s !== style);
						}
						await this.plugin.saveSettings();
					}));
		});

	}

	// Open a modal to select the dictionary path
	async openFilePicker() {
		new SystemDictionaryPathModal(this.app, async (selectedPath: string) => {
			if (selectedPath) {
				let isValid = await this.plugin.onDictionaryPathChange(selectedPath);
				if (isValid) {
					this.plugin.settings.dictionaryPath = selectedPath;
					this.plugin.saveSettings();
					new Notice(`Dictionary path set to: ${selectedPath}`);
				} else {
					// a user has already been notified
				}

			}
		}).open();
	}
}
