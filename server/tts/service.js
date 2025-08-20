import { createFishAudioTTS } from './fishAudio.js';
import { synthesizeChunkToFile as dummySynthesize, stitchSegments as dummyStitch } from './dummyTts.js';

export class TTSService {
	constructor(config) {
		this.config = config;
		this.fishAudio = null;
		this.useFishAudio = false;
		
		// Initialize Fish.Audio if API key is available
		if (config.fishAudioApiKey) {
			try {
				this.fishAudio = createFishAudioTTS(config.fishAudioApiKey);
				this.useFishAudio = true;
				console.log('[TTSService] Fish.Audio initialized');
			} catch (error) {
				console.error('[TTSService] Failed to initialize Fish.Audio:', error.message);
				this.useFishAudio = false;
				throw new Error(`Fish.Audio initialization failed: ${error.message}. Check your API key configuration.`);
			}
		} else {
			console.warn('[TTSService] No Fish.Audio API key configured - TTS will not work');
			throw new Error('Fish.Audio API key is required for TTS functionality. Please add "fishAudioApiKey" to your config.json file.');
		}
	}

	async synthesizeChunkToFile({ chunkText, voiceModelId, format = 'mp3', outputsDir, jobId, index }) {
		if (!this.useFishAudio || !this.fishAudio) {
			throw new Error('Fish.Audio is not available. Please check your API key configuration in config.json');
		}
		
		try {
			return await this.fishAudio.synthesizeChunkToFile({ 
				chunkText, voiceModelId, format, outputsDir, jobId, index 
			});
		} catch (error) {
			console.error('[TTSService] Fish.Audio synthesis failed:', error.message);
			
			// Provide specific error messages for common issues
			if (error.message.includes('401') || error.message.includes('Unauthorized')) {
				throw new Error(`Fish.Audio authentication failed. Please check your API key in config.json. Error: ${error.message}`);
			} else if (error.message.includes('404') || error.message.includes('Not Found')) {
				throw new Error(`Voice model "${voiceModelId}" not found. Please check your voice model configuration. Error: ${error.message}`);
			} else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
				throw new Error(`Fish.Audio rate limit exceeded. Please wait before trying again. Error: ${error.message}`);
			} else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
				throw new Error(`Fish.Audio server error. Please try again later. Error: ${error.message}`);
			} else {
				throw new Error(`Fish.Audio synthesis failed: ${error.message}. Please check your internet connection and API key.`);
			}
		}
	}

	async stitchSegments({ segmentFiles, outputsDir, jobId, format = 'mp3' }) {
		if (!this.useFishAudio || !this.fishAudio) {
			throw new Error('Fish.Audio is not available. Please check your API key configuration in config.json');
		}
		
		try {
			return await this.fishAudio.stitchSegments({ segmentFiles, outputsDir, jobId, format });
		} catch (error) {
			console.error('[TTSService] Fish.Audio stitching failed:', error.message);
			
			// Check if it's an ffmpeg issue
			if (error.message.includes('ffmpeg') || error.message.includes('FFmpeg')) {
				throw new Error(`Audio stitching failed: ${error.message}. Please ensure ffmpeg is installed on your system.`);
			} else {
				throw new Error(`Audio stitching failed: ${error.message}. Please check your file permissions and disk space.`);
			}
		}
	}

	async getAvailableVoices() {
		if (!this.useFishAudio || !this.fishAudio) {
			throw new Error('Fish.Audio is not available. Please check your API key configuration in config.json');
		}
		
		try {
			const voices = await this.fishAudio.getAvailableVoices();
			return voices;
		} catch (error) {
			console.error('[TTSService] Failed to fetch Fish.Audio voices:', error.message);
			
			if (error.message.includes('401') || error.message.includes('Unauthorized')) {
				throw new Error(`Fish.Audio authentication failed. Please check your API key in config.json. Error: ${error.message}`);
			} else if (error.message.includes('403') || error.message.includes('Forbidden')) {
				throw new Error(`Fish.Audio access denied. Please check your API key permissions. Error: ${error.message}`);
			} else {
				throw new Error(`Failed to fetch Fish.Audio voices: ${error.message}. Please check your internet connection and API key.`);
			}
		}
	}

	async testConnection() {
		if (!this.useFishAudio || !this.fishAudio) {
			return {
				provider: 'fish-audio',
				success: false,
				error: 'Fish.Audio is not available',
				troubleshooting: [
					'Add "fishAudioApiKey" to your config.json file',
					'Get your API key from https://fish.audio',
					'Restart the server after adding the API key'
				]
			};
		}
		
		try {
			const result = await this.fishAudio.testConnection();
			return {
				provider: 'fish-audio',
				...result,
				troubleshooting: result.success ? [] : [
					'Check your internet connection',
					'Verify your API key is correct',
					'Ensure your Fish.Audio account is active'
				]
			};
		} catch (error) {
			return {
				provider: 'fish-audio',
				success: false,
				error: error.message,
				troubleshooting: [
					'Check your internet connection',
					'Verify your API key is correct',
					'Ensure your Fish.Audio account is active',
					'Check Fish.Audio service status'
				]
			};
		}
	}

	isFishAudioAvailable() {
		return this.useFishAudio && this.fishAudio !== null;
	}

	getStatus() {
		return {
			configured: !!this.config.fishAudioApiKey,
			initialized: this.useFishAudio,
			available: this.isFishAudioAvailable(),
			apiKeyPresent: !!this.config.fishAudioApiKey,
			apiKeyMasked: this.config.fishAudioApiKey ? 
				`${this.config.fishAudioApiKey.substring(0, 4)}...${this.config.fishAudioApiKey.substring(this.config.fishAudioApiKey.length - 4)}` : 
				'Not configured'
		};
	}
}

export function createTTSService(config) {
	return new TTSService(config);
}
