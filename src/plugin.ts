import {Notice, Plugin, TFile} from "obsidian";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
// @ts-ignore
import nspell from "nspell";
import {FormatStyle} from "./enums";
import {CaseAwareSpellcheckEnhancerSettings, CaseAwareSpellcheckEnhancerSettingTab, DEFAULT_SETTINGS} from "./settings";
import {getSplitWordsBasedOnFormat, loadDictionary} from "./utilities";
import {LogLevel, PLUGIN_FOLDER_NAME, PLUGIN_NAME} from "./constants";
import {FileSyncManager} from "./fileSyncManager";
import ProgressBar from "./progressBar";

export class CaseAwareSpellcheckEnhancer extends Plugin {
	settings: CaseAwareSpellcheckEnhancerSettings;
	private dictionaryCache: Set<string> = new Set(); // Cache to store words from the dictionary
	private dictionarySyncManager: FileSyncManager;
	private intervalId: number | null = null;
	private activeFile: TFile | null = null;
	private parsedAllowedExtensions: string[] = [];
	private spellCheckers: nspell[] = [];
	private progressBar: ProgressBar | null = null;

	getProgressBar(): ProgressBar {
		return <ProgressBar>this.progressBar;
	}

	log(message: string, level: LogLevel = LogLevel.Info, ...optionalParams: any[]) {
		if (this.settings.debugMode || level === LogLevel.Error) {
			switch (level) {
				case LogLevel.Warn:
					console.warn(message, ...optionalParams);
					break;
				case LogLevel.Error:
					console.error(message, ...optionalParams);
					break;
				default:
					console.info(message, ...optionalParams);
					break;
			}
		}
	}

	async onload() {
		console.log(`Loading ${PLUGIN_NAME}`);

		await this.loadSettings();
		this.initializeProgressBar();
		this.updateAllowedExtensions();
		// Load the selected spellcheck dictionaries
		await this.loadSelectedDictionaries();

		this.setDefaultDictionaryPath();
		await this.onDictionaryPathChange(this.settings.dictionaryPath);

		this.registerSpellcheckHook();

		this.addSettingTab(new CaseAwareSpellcheckEnhancerSettingTab(this.app, this));
	}

	onunload() {
		this.log(`Unloading ${PLUGIN_NAME}`);
		this.stopRefreshInterval();
		this.getProgressBar().unload();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private initializeProgressBar() {
		this.progressBar = new ProgressBar(this);
	}

	// Update parsed extensions when settings are loaded or changed
	updateAllowedExtensions() {
		this.parsedAllowedExtensions = this.settings.allowedExtensions
			.split(',')
			.map((ext: string) => ext.trim().toLowerCase()); // Parse and normalize extensions
	}

	async loadSelectedDictionaries() {
		this.spellCheckers = [];

		const dictionaryFolder = path.join(this.app.vault.configDir, 'plugins', PLUGIN_FOLDER_NAME, 'dictionaries');

		const folderExists = await this.app.vault.adapter.exists(dictionaryFolder);
		if (!folderExists) {
			await this.app.vault.adapter.mkdir(dictionaryFolder);
		}

		for (const lang of this.settings.selectedDictionaries) {
			try {
				const spellChecker = await loadDictionary(lang, dictionaryFolder);
				this.spellCheckers.push(spellChecker);
			} catch (err) {
				this.log(`Failed to load ${lang} dictionary:`, LogLevel.Error, err);
			}
		}
	}

	setDefaultDictionaryPath() {
		if (this.settings.dictionaryPath === "") {
			let platform = os.platform();
			if (platform === "linux") {
				const homeDir = os.homedir();
				this.settings.dictionaryPath = path.join(homeDir, ".config", "obsidian", "Custom Dictionary.txt");
			} else if (platform === "win32") {
				const userDir = os.homedir();
				this.settings.dictionaryPath = path.join(userDir, "AppData", "Roaming", "Microsoft", "Spelling", "neutral", "default.dic");
			} else {
				new Notice(`Your OS (${platform}) is not supported. Default dictionary path can not be set. Please set it manually in the plugin settings.`)
			}

			this.saveSettings();
			new Notice(`Default dictionary path set to: ${this.settings.dictionaryPath}`);
		}
	}

	async onDictionaryPathChange(dictionaryPath: string): Promise<boolean> {
		let isValid = this.validateDictionaryPath(dictionaryPath);
		if (isValid) {
			this.dictionarySyncManager = new FileSyncManager(dictionaryPath);
			await this.loadDictionaryIntoCache();
		}
		return isValid;
	}

	validateDictionaryPath(dictionaryPath: string): boolean {
		if (!dictionaryPath) {
			new Notice(`System dictionary path is not set. Please set it in the plugin settings.`);
			return false;
		}
		try {
			if (dictionaryPath.endsWith(".dic") || dictionaryPath.endsWith(".txt")) {
				// Check if file exists and is writable
				fs.accessSync(dictionaryPath, fs.constants.W_OK);
				this.log(`System dictionary file at ${dictionaryPath} is writable.`);
				return true;
			} else {
				new Notice(`Expected file extension for system dictionary is .dic (Windows) and .txt (Other OS).`);
				return false;
			}
		} catch (err) {
			this.log(`Cannot access system dictionary at: ${dictionaryPath}.`, LogLevel.Error);
			new Notice(`Cannot access system dictionary at: ${dictionaryPath}. Please check permissions.`);
			return false;
		}
	}

	// Function to load the dictionary into memory (cache)
	async loadDictionaryIntoCache() {
		if (this.settings.dictionaryPath && this.dictionarySyncManager != null) {
			try {
				const content = await this.dictionarySyncManager.readFile();
				const words = content.split('\n').filter(Boolean);
				this.dictionaryCache = new Set(words);
				this.log("System dictionary loaded into cache.");
			} catch (error) {
				this.log("Failed to load system dictionary into cache:", LogLevel.Error, error);
			}
		}
	}

	registerSpellcheckHook() {
		this.registerEvent(this.app.workspace.on('file-open', this.handleFileSwitch.bind(this)));
		const currentFile = this.app.workspace.getActiveFile();
		if (currentFile) {
			this.handleFileSwitch(currentFile);
		}
	}

	handleFileSwitch(file: TFile | null) {
		if (file !== null) {
			const fileExtension = file ? file.extension.toLowerCase() : '';

			// If switching to a new file, stop the previous interval
			this.stopRefreshInterval();

			// Check if the file extension is in the allowed list
			if (file && file !== this.activeFile && this.parsedAllowedExtensions.includes(`.${fileExtension}`)) {
				this.activeFile = file;

				// Start a new interval only for the active file with a valid extension
				this.intervalId = window.setInterval(() => {
					this.runSpellcheckOnNotes(file);
				}, this.settings.refreshInterval * 1000);
			}
		}
	}

	// Stop the refresh interval when needed (optional cleanup, e.g., during unload)
	stopRefreshInterval() {
		if (this.intervalId !== null) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	runSpellcheckOnNotes(file: TFile) {
		this.app.vault.read(file).then(content => {
			this.getProgressBar().resetProgress();
			let amountOfWords = 0;
			let index = 0;
			const lines = content.split('\n');
			const words_per_line = []
			for (let line of lines) {
				const words = line.match(/[a-zA-ZÄäÖöÜüßéèêëàâùûçÀÂÈÉÊËÎÏÔÛÙÇА-ЯЁа-яёҐЄІЇґєіїъ]+(?:[-'_][a-zA-ZÄäÖöÜüßéèêëàâùûçÀÂÈÉÊËÎÏÔÛÙÇА-ЯЁа-яёҐЄІЇґєіїъ]+)*/g) || []
				words_per_line.push(words);
				amountOfWords += words.length;
			}
			this.log(`Found ${amountOfWords} word/s.`);

			words_per_line.forEach((words) => {
				words.forEach((word) => {
					this.getProgressBar().setProgress((index = ++index) * 100 / amountOfWords);
					if (this.isWordMisspelled(word) && this.wordIsNotInDictionary(word)) {
						// Try splitting the word based on the format styles
						this.settings.formatStyles.forEach((format: FormatStyle) => {
							const splitWords = getSplitWordsBasedOnFormat(word, format);
							if (splitWords.length > 1) {
								// Check if all split words are spelled correctly

								const allSplitWordsCorrect = splitWords.every(splitWord => {
									return !this.isWordMisspelled(splitWord);
								});

								if (allSplitWordsCorrect) {
									this.addWordToDictionary(word);
								}
							}
						});
					}
				});
			})
		});
	}

	// Check if the word is already in the dictionary (cache lookup)
	wordIsNotInDictionary(word: string): boolean {
		return !this.dictionaryCache.has(word);
	}

	isWordMisspelled(word: string): boolean {
		if (!this.spellCheckers.length) {
			this.log("No spellcheckers loaded.", LogLevel.Warn);
			return false; // If no dictionaries are loaded, assume the word is correct
		}

		// Check if the word is correct in any loaded dictionary
		for (const spellChecker of this.spellCheckers) {

			if (spellChecker.correct(word)) {
				return false; // The word is correct in at least one dictionary
			}
		}

		// Word is not correct in any of the loaded dictionaries
		return true;
	}

	// Function to add a word to the dictionary (synchronized and cached)
	async addWordToDictionary(word: string) {
		return this.dictionarySyncManager.withFileLock(async () => {
			if (this.dictionaryCache.has(word)) {
				this.log(`"${word}" is already in the dictionary cache.`);
				return;
			}

			await this.removeChecksumAndAddWord(word);

			this.dictionaryCache.add(word);
		});
	}

	async removeChecksumAndAddWord(word: string): Promise<void> {
		try {
			const content = await this.dictionarySyncManager.readFile();

			const lines = content.split('\n');

			const checksumIndex = lines.findIndex(line => line.startsWith("checksum_v1 = "));

			if (checksumIndex !== -1) {
				lines.splice(checksumIndex, 1); // Remove the checksum line
			}

			if (!lines.includes(word)) {
				lines.push(word);
			}

			// Write the updated content back to the file
			await this.dictionarySyncManager.writeFile(lines.join('\n'));
			this.log(`Added "${word}" to the dictionary as it can be split into valid words.`);
		} catch (error) {
			this.log('Error processing dictionary file:', LogLevel.Error, error);
		}
	}

}
