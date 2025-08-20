import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { audioStitcher } from './audioStitcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fish.Audio API configuration
const FISH_AUDIO_BASE_URL = 'https://api.fish.audio';
const FISH_AUDIO_WS_URL = 'wss://api.fish.audio';

export class FishAudioTTS {
	constructor(apiKey) {
		this.apiKey = apiKey;
		this.baseUrl = FISH_AUDIO_BASE_URL;
		this.wsUrl = FISH_AUDIO_WS_URL;
	}

	async synthesizeChunkToFile({ chunkText, voiceModelId, format = 'mp3', outputsDir, jobId, index }) {
		try {
			console.log(`[FishAudio] Synthesizing chunk ${index} with voice ${voiceModelId}`);
			
			// Create the synthesis request
			const synthesisRequest = {
				text: chunkText,
				voice_id: voiceModelId,
				output_format: format,
				optimization_level: 0, // Standard quality
				enable_timestamps: false
			};

			// Make the API request
			const response = await fetch(`${this.baseUrl}/v1/speech`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(synthesisRequest)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Fish.Audio API error: ${response.status} - ${errorText}`);
			}

			// Get the audio data
			const audioBuffer = await response.arrayBuffer();
			
			// Save to file
			const filename = `${jobId}-${String(index).padStart(3, '0')}.${format}`;
			const filepath = path.join(outputsDir, filename);
			fs.writeFileSync(filepath, Buffer.from(audioBuffer));
			
			console.log(`[FishAudio] Saved chunk ${index} to ${filepath}`);
			return filepath;
			
		} catch (error) {
			console.error(`[FishAudio] Error synthesizing chunk ${index}:`, error);
			throw error;
		}
	}

	async stitchSegments({ segmentFiles, outputsDir, jobId, format = 'mp3' }) {
		try {
			console.log(`[FishAudio] Stitching ${segmentFiles.length} segments`);
			
			// Check if ffmpeg is available
			const ffmpegAvailable = await audioStitcher.checkFFmpegAvailable();
			
			if (ffmpegAvailable) {
				// Use proper audio stitching with ffmpeg
				return await audioStitcher.stitchSegments({ segmentFiles, outputsDir, jobId, format });
			} else {
				// Fallback to simple concatenation for non-MP3 formats
				const outputFilename = `${jobId}-complete.${format}`;
				const outputPath = path.join(outputsDir, outputFilename);
				
				if (format === 'mp3') {
					// For MP3 without ffmpeg, just copy the first segment
					console.warn(`[FishAudio] FFmpeg not available, using first segment only for MP3`);
					fs.copyFileSync(segmentFiles[0], outputPath);
				} else {
					// For other formats, concatenate
					const audioBuffers = segmentFiles.map(file => fs.readFileSync(file));
					const combinedBuffer = Buffer.concat(audioBuffers);
					fs.writeFileSync(outputPath, combinedBuffer);
				}
				
				console.log(`[FishAudio] Stitched audio saved to ${outputPath}`);
				return outputPath;
			}
			
		} catch (error) {
			console.error(`[FishAudio] Error stitching segments:`, error);
			throw error;
		}
	}

	async getAvailableVoices() {
		try {
			const response = await fetch(`${this.baseUrl}/v1/voices`, {
				headers: {
					'Authorization': `Bearer ${this.apiKey}`
				}
			});

			if (!response.ok) {
				console.warn(`[FishAudio] API returned ${response.status}, falling back to config voices`);
				throw new Error(`Failed to fetch voices: ${response.status}`);
			}

			const voices = await response.json();
			return voices.data || [];
			
		} catch (error) {
			console.error(`[FishAudio] Error fetching voices:`, error.message);
			// Return empty array to trigger fallback to config voices
			return [];
		}
	}

	async testConnection() {
		try {
			const voices = await this.getAvailableVoices();
			return {
				success: true,
				voiceCount: voices.length,
				voices: voices.slice(0, 5) // Return first 5 voices as sample
			};
		} catch (error) {
			return {
				success: false,
				error: error.message
			};
		}
	}
}

// Factory function to create FishAudioTTS instance
export function createFishAudioTTS(apiKey) {
	if (!apiKey) {
		throw new Error('Fish.Audio API key is required');
	}
	return new FishAudioTTS(apiKey);
}
