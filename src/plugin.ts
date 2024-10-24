import {Notice, Plugin, TFile} from "obsidian";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import * as iconv from 'iconv-lite';
// @ts-ignore
import nspell from "nspell";
import {FormatStyle} from "./enums";
import {CaseAwareSpellcheckEnhancerSettings, CaseAwareSpellcheckEnhancerSettingTab, DEFAULT_SETTINGS} from "./settings";
import {
	detectFileEncodingByPlatform,
	loadDictionary,
	splitCamelCase,
	splitKebabCase,
	splitPascalCase,
	splitScreamingSnakeCase,
	splitSnakeCase
} from "./utilities";
import {PLUGIN_FOLDER_NAME, PLUGIN_NAME} from "./constants";

export class CaseAwareSpellcheckEnhancer extends Plugin {
	settings: CaseAwareSpellcheckEnhancerSettings;
	private dictionaryCache: Set<string> = new Set(); // Cache to store words from the dictionary
	private dictionaryPathLock = false; // Mutex-like lock to ensure synchronization
	private intervalId: number | null = null;
	private activeFile: TFile | null = null;
	private parsedAllowedExtensions: string[] = [];
	private spellCheckers: nspell[] = [];

	async onload() {
		console.log(`Loading ${PLUGIN_NAME} Plugin`);

		await this.loadSettings();
		this.updateAllowedExtensions();
		// Load the selected spellcheck dictionaries
		await this.loadSelectedDictionaries();

		this.setDefaultDictionaryPath();
		await this.onDictionaryPathChange(this.settings.dictionaryPath);

		this.registerSpellcheckHook();

		this.addSettingTab(new CaseAwareSpellcheckEnhancerSettingTab(this.app, this));
	}

	async onDictionaryPathChange(dictionaryPath: string): Promise<boolean> {
		let isValid = this.validateDictionaryPath(dictionaryPath);
		if (isValid) {
			await this.loadDictionaryIntoCache();
		}
		return isValid;
	}

	onunload() {
		console.log(`Unloading ${PLUGIN_NAME} Plugin`);
		this.stopRefreshInterval();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
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
				console.error(`Failed to load ${lang} dictionary:`, err);
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

	validateDictionaryPath(dictionaryPath: string): boolean {
		if (!dictionaryPath) {
			new Notice(`System dictionary path is not set. Please set it in the plugin settings.`);
			return false;
		}
		try {
			if (dictionaryPath.endsWith(".dic") || dictionaryPath.endsWith(".txt")) {
				// Check if file exists and is writable
				fs.accessSync(dictionaryPath, fs.constants.W_OK);
				console.log(`System dictionary file at ${dictionaryPath} is writable.`);
				return true;
			} else {
				new Notice(`Expected file extension for system dictionary is .dic (Windows) and .txt (Other OS).`);
				return false;
			}
		} catch (err) {
			new Notice(`Cannot access system dictionary at: ${dictionaryPath}. Please check permissions.`);
			return false;
		}
	}

	// Function to load the dictionary into memory (cache)
	async loadDictionaryIntoCache() {
		if (this.settings.dictionaryPath) {
			try {
				const content = await this.readDictionaryFile();
				const words = content.split('\n').filter(Boolean);
				this.dictionaryCache = new Set(words);
				console.log("System dictionary loaded into cache.");
			} catch (error) {
				console.error("Failed to load system dictionary into cache:", error);
			}
		}
	}

	// Function to read the dictionary file (synchronized)
	async readDictionaryFile(): Promise<string> {
		return new Promise((resolve, reject) => {
			// Lock mechanism to prevent simultaneous reads
			const interval = setInterval(() => {
				if (!this.dictionaryPathLock) {
					this.dictionaryPathLock = true; // Acquire lock
					clearInterval(interval);

					// Read the dictionary file
					fs.readFile(this.settings.dictionaryPath, 'utf8', (err, data) => {
						this.dictionaryPathLock = false; // Release lock
						if (err) {
							reject(err);
						} else {
							resolve(data);
						}
					});
				}
			}, 50); // Polling interval to wait for the lock
		});
	}

	registerSpellcheckHook() {
		this.app.workspace.on('file-open', this.handleFileSwitch.bind(this));

		// Start the interval if the file is already open at load time
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
			const lines = content.split('\n');

			for (let line of lines) {
				const words = line.match(/[a-zA-ZÄäÖöÜüßéèêëàâùûçÀÂÈÉÊËÎÏÔÛÙÇА-ЯЁа-яёҐЄІЇґєіїъ]+(?:[-'_][a-zA-ZÄäÖöÜüßéèêëàâùûçÀÂÈÉÊËÎÏÔÛÙÇА-ЯЁа-яёҐЄІЇґєіїъ]+)*/g) || []
				words.forEach(word => {
					if (this.isWordMisspelled(word) && this.wordIsNotInDictionary(word)) {
						// Try splitting the word based on the format styles
						this.settings.formatStyles.forEach((format: FormatStyle) => {
							const splitWords = this.getSplitWordsBasedOnFormat(word, format);
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
			}
		});
	}

	// Check if the word is already in the dictionary (cache lookup)
	wordIsNotInDictionary(word: string): boolean {
		return !this.dictionaryCache.has(word);
	}

	isWordMisspelled(word: string): boolean {
		if (!this.spellCheckers.length) {
			console.warn("No spellcheckers loaded.");
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

	// Function to get split words based on selected format style
	getSplitWordsBasedOnFormat(word: string, format: FormatStyle): string[] {
		let splitWords: string[] = [];

		switch (format) {
			case FormatStyle.CamelCase:
				splitWords = [...splitWords, ...splitCamelCase(word)];
				break;
			case FormatStyle.PascalCase:
				splitWords = [...splitWords, ...splitPascalCase(word)];
				break;
			case FormatStyle.SnakeCase:
				splitWords = [...splitWords, ...splitSnakeCase(word)];
				break;
			case FormatStyle.KebabCase:
				splitWords = [...splitWords, ...splitKebabCase(word)];
				break;
			case FormatStyle.ScreamingSnakeCase:
				splitWords = [...splitWords, ...splitScreamingSnakeCase(word)];
				break;
		}

		return splitWords;
	}

	// Function to add a word to the dictionary (synchronized and cached)
	async addWordToDictionary(word: string) {
		if (this.dictionaryCache.has(word)) {
			// console.log(`"${word}" is already in the dictionary cache.`);
			return;
		}

		return new Promise((resolve, reject) => {
			const interval = setInterval(async () => {
				if (!this.dictionaryPathLock) {
					this.dictionaryPathLock = true; // Acquire lock
					clearInterval(interval);

					// Re-check if the word is in the cache after acquiring lock to avoid race conditions
					if (this.dictionaryCache.has(word)) {
						// console.log(`"${word}" is already in the dictionary (after re-checking).`);
						this.dictionaryPathLock = false; // Release lock
						resolve(false); // No need to add again
						return;
					}

					try {
						// if a user has added some word manually
						// Remove "checksum_v1 = " line and add word to the file
						await this.removeChecksumAndAddWord.call(this, word);

						this.dictionaryCache.add(word);
						resolve(true);
					} catch (error) {
						this.dictionaryPathLock = false; // Release lock
						reject(error);
					} finally {
						this.dictionaryPathLock = false; // Release lock in case of error or success
					}
				}
			}, 50); // Polling interval to wait for the lock
		});
	}

	async removeChecksumAndAddWord(word: string): Promise<void> {
		try {
			const filePath = this.settings.dictionaryPath;

			const fileBuffer = await fs.promises.readFile(filePath);
			const encoding = detectFileEncodingByPlatform();
			const fileContent = iconv.decode(fileBuffer, encoding);

			const lines = fileContent.split('\n');

			const checksumIndex = lines.findIndex(line => line.startsWith("checksum_v1 = "));

			if (checksumIndex !== -1) {
				lines.splice(checksumIndex, 1); // Remove the checksum line
			}

			if (!lines.includes(word)) {
				lines.push(word);
			}

			// Write the updated content back to the file
			const updatedContent = lines.join('\n');
			const encodedContent = iconv.encode(updatedContent, encoding);
			await fs.promises.writeFile(filePath, encodedContent);
			console.log(`Added "${word}" to the dictionary as it can be split into valid words.`);
		} catch (error) {
			console.error('Error processing dictionary file:', error);
			throw error;
		}
	}

}
