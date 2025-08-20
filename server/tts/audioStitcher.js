import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Utility function to generate user-friendly file names
function generateFileName({ user, jobId, type = 'tts', format = 'mp3' }) {
	// Create a short, readable name
	const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
	const shortId = jobId.slice(0, 8); // First 8 characters of job ID
	const userPrefix = user ? `${user}-` : '';
	
	return `${userPrefix}${type}-${shortId}-${timestamp}.${format}`;
}

export class AudioStitcher {
	constructor() {
		this.ffmpegPath = 'ffmpeg'; // Assumes ffmpeg is in PATH
	}

	async stitchSegments({ segmentFiles, outputsDir, jobId, format = 'mp3', user }) {
		try {
			console.log(`[AudioStitcher] Stitching ${segmentFiles.length} segments to ${format}`);
			
			const outputFilename = generateFileName({ user, jobId, type: 'tts', format });
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
