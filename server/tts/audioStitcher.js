import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export class AudioStitcher {
	constructor() {
		this.ffmpegPath = 'ffmpeg'; // Assumes ffmpeg is in PATH
	}

	async stitchSegments({ segmentFiles, outputsDir, jobId, format = 'mp3' }) {
		try {
			console.log(`[AudioStitcher] Stitching ${segmentFiles.length} segments to ${format}`);
			
			const outputFilename = `${jobId}-complete.${format}`;
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
