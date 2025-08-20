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
				console.warn('[TTSService] Failed to initialize Fish.Audio:', error.message);
				this.useFishAudio = false;
			}
		} else {
			console.log('[TTSService] No Fish.Audio API key, using dummy TTS');
		}
	}

	async synthesizeChunkToFile({ chunkText, voiceModelId, format = 'mp3', outputsDir, jobId, index }) {
		if (this.useFishAudio && this.fishAudio) {
			try {
				return await this.fishAudio.synthesizeChunkToFile({ 
					chunkText, voiceModelId, format, outputsDir, jobId, index 
				});
			} catch (error) {
				console.error('[TTSService] Fish.Audio failed, falling back to dummy:', error.message);
				// Fall back to dummy TTS
				return await dummySynthesize({ chunkText, voiceModelId, format, outputsDir, jobId, index });
			}
		} else {
			// Use dummy TTS
			return await dummySynthesize({ chunkText, voiceModelId, format, outputsDir, jobId, index });
		}
	}

	async stitchSegments({ segmentFiles, outputsDir, jobId, format = 'mp3' }) {
		if (this.useFishAudio && this.fishAudio) {
			try {
				return await this.fishAudio.stitchSegments({ segmentFiles, outputsDir, jobId, format });
			} catch (error) {
				console.error('[TTSService] Fish.Audio stitching failed, falling back to dummy:', error.message);
				// Fall back to dummy stitching
				return await dummyStitch({ segmentFiles, outputsDir, jobId, format });
			}
		} else {
			// Use dummy stitching
			return await dummyStitch({ segmentFiles, outputsDir, jobId, format });
		}
	}

	async getAvailableVoices() {
		if (this.useFishAudio && this.fishAudio) {
			try {
				const voices = await this.fishAudio.getAvailableVoices();
				return voices;
			} catch (error) {
				console.error('[TTSService] Failed to fetch Fish.Audio voices:', error.message);
				// Return config voices as fallback
				return this.config.voiceModels || [];
			}
		} else {
			// Return config voices
			return this.config.voiceModels || [];
		}
	}

	async testConnection() {
		if (this.useFishAudio && this.fishAudio) {
			try {
				const result = await this.fishAudio.testConnection();
				return {
					provider: 'fish-audio',
					...result
				};
			} catch (error) {
				return {
					provider: 'fish-audio',
					success: false,
					error: error.message
				};
			}
		} else {
			return {
				provider: 'dummy',
				success: true,
				message: 'Using dummy TTS (no Fish.Audio API key configured)'
			};
		}
	}

	isFishAudioAvailable() {
		return this.useFishAudio && this.fishAudio !== null;
	}
}

export function createTTSService(config) {
	return new TTSService(config);
}
