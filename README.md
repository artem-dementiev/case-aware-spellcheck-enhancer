# Case-Aware Spellcheck Enhancer
## Overview

If you spend most of your time in the editing view and find yourself annoyed by the red spellcheck underline,
you might find this plugin useful since it will automatically add words written in a certain format to a system dictionary, so that Obsidian won't underline them the next time you launch it.

When working in **Obsidian**, I tend to use naming conventions, including `camelCase`, `PascalCase`, and others.
The spellcheck feature often marks these words with a red underline, making it distracting to read and edit notes.

Although spellcheck can be disabled in the **Obsidian settings**, that’s not a suitable solution for me.
To avoid manually adding these words to the system dictionary.
I’ve developed a plugin that **automatically scans the active file** and adds words written in specific formats
(e.g., `camelCase`, `PascalCase`) to the system dictionary.
This is done only if each individual internal word is valid according to [dictionaries](https://github.com/wooorm/dictionaries).

After the next launch of **Obsidian**, the words in these formats will no longer be underlined by the spellchecker.

---

## Features

- **Automatic dictionary updates**: Adds words in supported formats to the system dictionary if they consist of valid sub-words.
- **Supported languages**:
	- English
	- French
	- German
	- Ukrainian
	- Russian
- **Supported naming conventions**:
	- `camelCase`
	- `PascalCase`
	- `snake_case`
	- `kebab-case`
	- `SCREAMING_SNAKE_CASE`

> **Note**: Obsidian doesn’t underline the last three formats, but they are included as a precaution for future compatibility.

---

## Installation

1. **Download the Plugin**:
	- Go to the plugin’s [GitHub releases page](https://github.com/artem-dementiev/case-aware-spellcheck-enhancer/releases) and download the latest `.zip` file.

2. **Unzip the Plugin**:
	- Extract the contents of the `.zip` file to your `.obsidian/plugins` folder in your vault.

3. **Enable the Plugin**:
	- Open Obsidian, go to **Settings** > **Community plugins** > **Manage**, and enable the **CamelCase Dictionary Helper** plugin.

4. **Restart Obsidian**:
	- Restart the application for the changes to take effect.

---

## How It Works

1. **Naming conventions**:
	- The plugin scans your notes and identifies words in the following formats:
		- `camelCase`
		- `PascalCase`
		- `snake_case`
		- `kebab-case`
		- `SCREAMING_SNAKE_CASE`

2. **Spellcheck Validation**:
	- For each word found in these formats, the plugin checks if the individual sub-words (e.g., `camel` and `Case` in `camelCase`) are valid according to the selected language dictionary.
	- If all sub-words are valid, the entire word is added to the **system dictionary**.

3. **Supported Languages**:
	- The plugin supports **5 languages**: English, French, German, Ukrainian, and Russian. These dictionaries are sourced from [dictionaries by wooorm](https://github.com/wooorm/dictionaries).

4. **System Dictionary Update**:
	- After the system dictionary is updated, **Obsidian** no longer underlines those words during spellcheck.

---

## Developer Notes

- **Adding New Language Support**:
  To add support for a new language, you need to:
	- **Extend `DICTIONARY_URLS`**: Add the appropriate URL for the new language’s dictionary.
	- **Update Regex**: Modify the regex patterns in the `splitCamelCase`, `splitPascalCase`, and `runSpellcheckOnNotes` methods to support new formats.

---

## Contributions

Feel free to submit pull requests or open issues on the plugin’s GitHub page for suggestions, bugs, or new features.
