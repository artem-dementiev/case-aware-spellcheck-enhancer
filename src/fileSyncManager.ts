import {detectFileEncodingByPlatform} from "./utilities";
import * as iconv from 'iconv-lite';
import * as fs from "fs";

export class FileSyncManager {
	private dictionaryLock: Promise<void> = Promise.resolve();
	private readonly fileToLock: string;

	constructor(fileToLock: string) {
		this.fileToLock = fileToLock;
	}

	// Method to acquire the lock and execute the provided function sequentially
	async withFileLock<T>(fn: () => Promise<T>): Promise<T> {
		// Create a new lock that starts after the current one
		let releaseLock: () => void;
		const newLock = new Promise<void>((resolve) => (releaseLock = resolve));

		// Chain the new lock to the current lock
		const previousLock = this.dictionaryLock;
		this.dictionaryLock = newLock;

		// Wait for the previous lock to finish
		await previousLock;

		try {
			// Execute the provided function within the lock
			return await fn();
		} finally {
			// Release the lock for the next queued function
			releaseLock!();
		}
	}

	async readFile(): Promise<string> {
		const encoding = detectFileEncodingByPlatform();
		const fileBuffer = await fs.promises.readFile(this.fileToLock);
		return iconv.decode(fileBuffer, encoding);
	}

	async readFileWithLock(): Promise<string> {
		return this.withFileLock(async () => {
			const encoding = detectFileEncodingByPlatform();
			const fileBuffer = await fs.promises.readFile(this.fileToLock);
			return iconv.decode(fileBuffer, encoding);
		});
	}

	async writeFile(content: string): Promise<void> {
		const encoding = detectFileEncodingByPlatform();
		const encodedContent = iconv.encode(content, encoding);
		await fs.promises.writeFile(this.fileToLock, encodedContent);
	}

	async writeFileWithLock(content: string): Promise<void> {
		await this.withFileLock(async () => {
			const encoding = detectFileEncodingByPlatform();
			const encodedContent = iconv.encode(content, encoding);
			await fs.promises.writeFile(this.fileToLock, encodedContent);
		});
	}
}
