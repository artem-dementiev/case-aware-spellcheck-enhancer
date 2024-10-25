
// Dictionary URLs (fetch from a remote source and store locally)
export const DICTIONARY_URLS = {
	en: {
		aff: 'https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/en/index.aff',
		dic: 'https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/en/index.dic',
	},
	fr: {
		aff: 'https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/fr/index.aff',
		dic: 'https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/fr/index.dic',
	},
	de: {
		aff: 'https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/de/index.aff',
		dic: 'https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/de/index.dic',
	},
	uk: {
		aff: 'https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/uk/index.aff',
		dic: 'https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/uk/index.dic',
	},
	ru: {
		aff: 'https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/ru/index.aff',
		dic: 'https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/ru/index.dic',
	}
};

export enum LogLevel {
	Info = 'log',
	Warn = 'warn',
	Error = 'error'
}

export const PLUGIN_FOLDER_NAME = 'case-aware-spellcheck-enhancer';
export const PLUGIN_NAME = 'Case-Aware Spellcheck Enhancer';
