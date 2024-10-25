import * as os from "os";
import * as path from "path";
// @ts-ignore
import nspell from "nspell";

import {DICTIONARY_URLS} from "./constants";
import {FormatStyle} from "./enums";


// Function to load dictionaries using fetch (browser-compatible)
export async function loadDictionary(language: string, spellcheckDictionariesFolder: string): Promise<nspell> {
	// @ts-ignore
	const dict = DICTIONARY_URLS[language];
	if (!dict) {
		throw new Error(`Unsupported language: ${language}`);
	}
	const affPath = path.join(spellcheckDictionariesFolder, `${language}.aff`);
	const dicPath = path.join(spellcheckDictionariesFolder, `${language}.dic`);
	try {
		// Check if the dictionary files exist in the plugin folder
		const affExists = await this.app.vault.adapter.exists(affPath);
		const dicExists = await this.app.vault.adapter.exists(dicPath);

		let affixData: string;
		let dictionaryData: string;

		if (affExists && dicExists) {
			// Load from local files if they exist
			console.log(`Loading ${language} dictionary from local files.`);
			affixData = await this.app.vault.adapter.read(affPath);
			dictionaryData = await this.app.vault.adapter.read(dicPath);
		} else {
			// Download the dictionary files if they don't exist
			console.log(`Downloading ${language} dictionary...`);
			const [affResponse, dicResponse] = await Promise.all([
				fetch(dict.aff),
				fetch(dict.dic),
			]);

			affixData = await affResponse.text();
			dictionaryData = await dicResponse.text();

			// Save the downloaded files to the plugin folder for future use
			await this.app.vault.adapter.write(affPath, affixData);
			await this.app.vault.adapter.write(dicPath, dictionaryData);
		}

		console.log(`Loaded ${language} dictionary.`);
		return nspell({ aff: affixData, dic: dictionaryData });
	} catch (error) {
		console.error(`Failed to load ${language} dictionary:`, error);
		throw error;
	}
}

export function detectFileEncodingByPlatform(): string {
	if (os.platform() === 'win32') {
		// Windows typically uses UTF-16 LE for dictionary files
		return 'utf16-le';
	} else {
		// Linux/macOS use UTF-8 by default
		return 'utf8';
	}
}

// Function to get split words based on selected format style
export function getSplitWordsBasedOnFormat(word: string, format: FormatStyle): string[] {
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

// Utility functions for format-style parsing
export function splitCamelCase(word: string): string[] {
	return word.split(/(?:(?<=[a-zäöüéèêëàâùûçґєіїёъ])(?=[A-ZÄÖÜÉÈÊËÀÂÙÛÇҐЄІЇЁА-ЯЁ])|(?<=[A-ZÄÖÜÉÈÊËÀÂÙÛÇҐЄІЇЁ])(?=[А-ЯЁа-яё])|(?<=[А-ЯЁа-яё])(?=[A-ZÄÖÜÉÈÊËÀÂÙÛÇa-zäöüéèêëàâùûç])|(?<=[а-яёґєії])(?=[А-ЯЁ]))/g);
}

export function splitSnakeCase(word: string): string[] {
	return word.split('_');
}

export function splitKebabCase(word: string): string[] {
	return word.split('-');
}

export function splitPascalCase(word: string): string[] {
	return word.split(/(?:(?<=[a-zäöüéèêëàâùûçґєіїёъ])(?=[A-ZÄÖÜÉÈÊËÀÂÙÛÇҐЄІЇЁА-ЯЁ])|(?<=[A-ZÄÖÜÉÈÊËÀÂÙÛÇҐЄІЇЁ])(?=[А-ЯЁа-яё])|(?<=[А-ЯЁа-яё])(?=[A-ZÄÖÜÉÈÊËÀÂÙÛÇa-zäöüéèêëàâùûç])|(?<=[а-яёґєії])(?=[А-ЯЁ]))/g);
}

export function splitScreamingSnakeCase(word: string): string[] {
	return word.split('_');
}
