import {CaseAwareSpellcheckEnhancer} from "./plugin";

export default class ProgressBar {
	private plugin: CaseAwareSpellcheckEnhancer;
	private statusBarItem: HTMLElement;
	private progressBar: HTMLElement;
	private progressValue: HTMLElement;
	private progressText: HTMLElement;
	private currentProgress: number = 0;
	private targetProgress: number = 0;
	private animationFrame: number | null = null;
	private lastUpdate: number = 0;
	private MIN_UPDATE_INTERVAL = 50; // Minimum time (ms) between updates

	constructor(plugin: CaseAwareSpellcheckEnhancer) {
		this.plugin = plugin;
		if (plugin.settings.progressBarEnabled){
			this.initializeProgressBar();
		}
	}

	private initializeProgressBar() {
		this.statusBarItem = this.plugin.addStatusBarItem();
		this.statusBarItem.addClass('enhancer-progress-bar-container');

		this.progressBar = this.statusBarItem.createEl('div', { cls: 'enhancer-progress-bar' });
		this.progressValue = this.progressBar.createEl('div', { cls: 'enhancer-progress-value' });
		this.progressText = this.progressBar.createEl('div', { cls: 'enhancer-progress-text' });
	}

	private animateProgress() {
		const now = Date.now();
		if (now - this.lastUpdate < this.MIN_UPDATE_INTERVAL) {
			// Skip update if too soon
			this.animationFrame = requestAnimationFrame(() => this.animateProgress());
			return;
		}

		if (this.currentProgress !== this.targetProgress) {
			const diff = this.targetProgress - this.currentProgress;
			const step = diff * 0.1; // Take 10% of the remaining distance

			this.currentProgress += step;
			const displayProgress = Math.round(this.currentProgress * 10) / 10;

			this.progressValue.style.width = `${displayProgress}%`;
			this.progressText.setText(`${displayProgress.toFixed(1)}%`);

			this.lastUpdate = now;

			if (Math.abs(this.targetProgress - this.currentProgress) > 0.1) {
				this.animationFrame = requestAnimationFrame(() => this.animateProgress());
			} else {
				this.currentProgress = this.targetProgress;
				this.progressValue.style.width = `${this.targetProgress}%`;
				this.progressText.setText(`${this.targetProgress.toFixed(1)}%`);
				this.animationFrame = null;
			}
		}
	}

	async toggleProgressBar(value: boolean) {
		this.plugin.settings.progressBarEnabled = value;
		await this.plugin.saveSettings();

		if (value) {
			this.initializeProgressBar();
		} else {
			this.unload();
		}
	}

	public setProgress(value: number) {
		if (!this.plugin.settings.progressBarEnabled) return;
		// Ensure value is between 0 and 100
		this.targetProgress = Math.min(100, Math.max(0, value));

		// Start animation if not already running
		if (!this.animationFrame) {
			this.animateProgress();
		}
	}

	// Reset progress - call this before starting your process
	public resetProgress() {
		if (!this.plugin.settings.progressBarEnabled) return;

		this.currentProgress = 0;
		this.targetProgress = 0;
		this.progressValue.style.width = '0%';
		this.progressText.setText('0.0%');
		if (this.animationFrame) {
			cancelAnimationFrame(this.animationFrame);
			this.animationFrame = null;
		}
	}

	public unload(): void {
		this.statusBarItem?.remove();
		this.progressBar?.remove();
		this.progressValue?.remove();
		this.progressText?.remove();
		if (this.animationFrame) {
			cancelAnimationFrame(this.animationFrame);
			this.animationFrame = null;
		}
	}

}
