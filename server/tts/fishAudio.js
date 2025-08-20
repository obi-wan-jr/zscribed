import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { audioStitcher } from './audioStitcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fish.Audio API configuration
const FISH_AUDIO_BASE_URL = 'https://api.fish.audio';
const FISH_AUDIO_WS_URL = 'wss://api.fish.audio';

// Utility function to generate user-friendly file names
function generateFileName({ user, voiceModelId, type = 'tts', index = null, format = 'mp3', bibleReference = null }) {
	// Create a short, readable name with essential variables only
	const now = new Date();
	const time = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
	const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
	const userPrefix = user ? `${user}-` : '';
	
	// Get a short voice model name (last 8 characters if it's a long ID)
	// Handle cases where voiceModelId might be undefined
	const safeVoiceId = voiceModelId || 'unknown';
	const shortVoiceId = safeVoiceId.length > 8 ? safeVoiceId.slice(-8) : safeVoiceId;
	
	// For Bible files, include the reference
	const typePrefix = type === 'bible' && bibleReference ? `bible-${bibleReference.replace(/[^a-zA-Z0-9]/g, '-')}-` : `${type}-`;
	
	if (index !== null) {
		// For segment files
		return `${userPrefix}${typePrefix}${shortVoiceId}-${time}-${index}.${format}`;
	} else {
		// For complete files
		return `${userPrefix}${typePrefix}${shortVoiceId}-${time}-${date}.${format}`;
	}
}

export class FishAudioTTS {
	constructor(apiKey) {
		this.apiKey = apiKey;
		this.baseUrl = FISH_AUDIO_BASE_URL;
		this.wsUrl = FISH_AUDIO_WS_URL;
	}

	async synthesizeChunkToFile({ chunkText, voiceModelId, format = 'mp3', outputsDir, jobId, index, user, bibleReference }) {
		try {
			console.log(`[FishAudio] Synthesizing chunk ${index} with voice ${voiceModelId}`);
			
			// Create the synthesis request using Fish.Audio API format
			const synthesisRequest = {
				text: chunkText,
				reference_id: voiceModelId, // Fish.Audio uses reference_id instead of voice_id
				format: format, // mp3, wav, etc.
				latency: 'normal', // normal or balanced
				normalize: true // Normalize text for better stability
			};

			// Make the API request to the correct Fish.Audio TTS endpoint
			const response = await fetch(`${this.baseUrl}/v1/tts`, {
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
			
			// Save to file with improved naming
			const type = bibleReference ? 'bible' : 'tts';
			const filename = generateFileName({ user, voiceModelId, type, index, format, bibleReference });
			const filepath = path.join(outputsDir, filename);
			fs.writeFileSync(filepath, Buffer.from(audioBuffer));
			
			console.log(`[FishAudio] Saved chunk ${index} to ${filepath}`);
			return filepath;
			
		} catch (error) {
			console.error(`[FishAudio] Error synthesizing chunk ${index}:`, error);
			throw error;
		}
	}

	async stitchSegments({ segmentFiles, outputsDir, jobId, format = 'mp3', user, voiceModelId, bibleReference }) {
		try {
			console.log(`[FishAudio] Stitching ${segmentFiles.length} segments`);
			
			// Check if ffmpeg is available
			const ffmpegAvailable = await audioStitcher.checkFFmpegAvailable();
			let outputPath;
			
			if (ffmpegAvailable) {
				// Use proper audio stitching with ffmpeg
				outputPath = await audioStitcher.stitchSegments({ segmentFiles, outputsDir, jobId, format, user, voiceModelId, bibleReference });
			} else {
				// Fallback to simple concatenation for non-MP3 formats
				const type = bibleReference ? 'bible' : 'tts';
				const outputFilename = generateFileName({ user, voiceModelId, type, format, bibleReference });
				outputPath = path.join(outputsDir, outputFilename);
				
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
			}
			
			// Clean up segment files after successful stitching
			await this.cleanupSegmentFiles(segmentFiles);
			
			return outputPath;
			
		} catch (error) {
			console.error(`[FishAudio] Error stitching segments:`, error);
			throw error;
		}
	}

	async cleanupSegmentFiles(segmentFiles) {
		try {
			console.log(`[FishAudio] Cleaning up ${segmentFiles.length} segment files`);
			
			for (const file of segmentFiles) {
				try {
					if (fs.existsSync(file)) {
						fs.unlinkSync(file);
						console.log(`[FishAudio] Deleted segment file: ${path.basename(file)}`);
					}
				} catch (deleteError) {
					console.warn(`[FishAudio] Failed to delete segment file ${file}:`, deleteError.message);
					// Don't throw error for cleanup failures - continue with other files
				}
			}
			
			console.log(`[FishAudio] Segment cleanup completed`);
		} catch (error) {
			console.error(`[FishAudio] Error during segment cleanup:`, error);
			// Don't throw error for cleanup failures - the main operation succeeded
		}
	}

	async getAvailableVoices() {
		try {
			// Fish.Audio API doesn't have a direct endpoint to list voices
			// Instead, you need to know your model reference_ids from their playground
			// or when you create models. We'll attempt a test request to validate the API key
			// and fall back to config voices.
			
			console.log(`[FishAudio] Testing API connection to validate available voices`);
			
			const testResponse = await fetch(`${this.baseUrl}/v1/tts`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					text: "test", // Minimal test
					reference_id: "test-invalid-id", // This will fail but validate our API key
					format: "mp3"
				})
			});

			if (testResponse.status === 401) {
				console.warn(`[FishAudio] API key is invalid (401), falling back to config voices`);
				throw new Error(`Invalid API key: ${testResponse.status}`);
			} else if (testResponse.status === 404) {
				console.warn(`[FishAudio] Reference ID not found (expected for test), but API key is valid - using config voices`);
				// This is expected - the test reference_id doesn't exist, but API key is valid
				return []; // Return empty to trigger fallback to config
			} else {
				console.log(`[FishAudio] API responded with status ${testResponse.status} - falling back to config voices`);
				return []; // Return empty to trigger fallback to config
			}
			
		} catch (error) {
			console.error(`[FishAudio] Error testing API connection:`, error.message);
			// Return empty array to trigger fallback to config voices
			return [];
		}
	}

	async testConnection() {
		try {
			// Test the TTS endpoint directly with a minimal request
			console.log(`[FishAudio] Testing connection to Fish.Audio API`);
			
			const testResponse = await fetch(`${this.baseUrl}/v1/tts`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					text: "API connection test",
					reference_id: "test-connection", // This will likely fail but validate API key
					format: "mp3"
				})
			});

			if (testResponse.status === 401) {
				return {
					success: false,
					error: "Invalid API key (401 Unauthorized)",
					statusCode: 401
				};
			} else if (testResponse.status === 400 || testResponse.status === 404) {
				// API key is valid, but reference_id is invalid (expected)
				return {
					success: true,
					message: "API key is valid. Ready to use with your voice models.",
					statusCode: testResponse.status,
					note: "Use your model reference_ids from Fish.Audio playground"
				};
			} else if (testResponse.status === 200) {
				// Unexpected success with test reference_id
				return {
					success: true,
					message: "API connection successful",
					statusCode: 200
				};
			} else {
				const errorText = await testResponse.text();
				return {
					success: false,
					error: `API returned ${testResponse.status}: ${errorText}`,
					statusCode: testResponse.status
				};
			}
			
		} catch (error) {
			return {
				success: false,
				error: `Connection failed: ${error.message}`
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
