import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Utility function to generate user-friendly file names
function generateFileName({ user, voiceModelId, type = 'tts', format = 'mp3', bibleReference = null }) {
	// Create a short, readable name with essential variables only
	const now = new Date();
	const time = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
	const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
	const userPrefix = user ? `${user}-` : '';
	
	// Get a short voice model name (last 8 characters if it's a long ID)
	// Handle cases where voiceModelId might be undefined or null
	const safeVoiceId = (voiceModelId && typeof voiceModelId === 'string') ? voiceModelId : 'unknown';
	const shortVoiceId = safeVoiceId.length > 8 ? safeVoiceId.slice(-8) : safeVoiceId;
	
	// For Bible files, include the reference
	const typePrefix = type === 'bible' && bibleReference ? `bible-${bibleReference.replace(/[^a-zA-Z0-9]/g, '-')}-` : `${type}-`;
	
	return `${userPrefix}${typePrefix}${shortVoiceId}-${time}-${date}.${format}`;
}

export class AudioStitcher {
	constructor() {
		this.ffmpegPath = 'ffmpeg'; // Assumes ffmpeg is in PATH
	}

	async stitchSegments({ segmentFiles, outputsDir, jobId, format = 'mp3', user, voiceModelId, bibleReference }) {
		try {
			// Validate required parameters
			if (!segmentFiles || !Array.isArray(segmentFiles) || segmentFiles.length === 0) {
				throw new Error('segmentFiles must be a non-empty array');
			}
			
			if (!outputsDir || typeof outputsDir !== 'string') {
				throw new Error('outputsDir must be a valid string');
			}
			
			if (!jobId || typeof jobId !== 'string') {
				throw new Error('jobId must be a valid string');
			}
			
			// Ensure user and voiceModelId are strings or undefined
			const safeUser = (user && typeof user === 'string') ? user : 'unknown';
			const safeVoiceModelId = (voiceModelId && typeof voiceModelId === 'string') ? voiceModelId : 'unknown';
			
			console.log(`[AudioStitcher] Stitching ${segmentFiles.length} segments to ${format}`);
			
			const type = bibleReference ? 'bible' : 'tts';
			const outputFilename = generateFileName({ user: safeUser, voiceModelId: safeVoiceModelId, type, format, bibleReference });
			const outputPath = path.join(outputsDir, outputFilename);
			
			// Create a file list for ffmpeg
			const fileListPath = path.join(outputsDir, `${jobId}-filelist.txt`);
			const fileListContent = segmentFiles.map(file => `file '${file}'`).join('\n');
			fs.writeFileSync(fileListPath, fileListContent);
			
			// Use ffmpeg to concatenate audio files
			const ffmpegArgs = [
				'-f', 'concat',
				'-safe', '0',
				'-i', fileListPath,
				'-c', 'copy',
				outputPath
			];
			
			await this.runFFmpeg(ffmpegArgs);
			
			// Clean up the file list
			fs.unlinkSync(fileListPath);
			
			console.log(`[AudioStitcher] Successfully stitched audio to ${outputPath}`);
			return outputPath;
			
		} catch (error) {
			console.error(`[AudioStitcher] Error stitching segments:`, error);
			throw error;
		}
	}

	async runFFmpeg(args) {
		return new Promise((resolve, reject) => {
			const ffmpeg = spawn(this.ffmpegPath, args, {
				stdio: ['pipe', 'pipe', 'pipe']
			});
			
			let stderr = '';
			
			ffmpeg.stderr.on('data', (data) => {
				stderr += data.toString();
			});
			
			ffmpeg.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
				}
			});
			
			ffmpeg.on('error', (error) => {
				reject(new Error(`FFmpeg spawn error: ${error.message}`));
			});
		});
	}

	async checkFFmpegAvailable() {
		try {
			await this.runFFmpeg(['-version']);
			return true;
		} catch (error) {
			console.warn('[AudioStitcher] FFmpeg not available:', error.message);
			return false;
		}
	}
}

export const audioStitcher = new AudioStitcher();
