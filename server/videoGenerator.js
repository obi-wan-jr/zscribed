import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

export class VideoGenerator {
	constructor(outputsDir, storageDir) {
		this.outputsDir = outputsDir;
		this.storageDir = storageDir;
		this.uploadDir = path.join(storageDir, 'uploads');
	}

	async createVideo(audioFile, videoSettings, jobId, broadcastLog) {
		const { backgroundType, videoResolution, backgroundFile } = videoSettings;
		
		broadcastLog('info', 'video', `Starting video generation with ${backgroundType}`, `Job: ${jobId}`);
		
		try {
					// Try multiple approaches in order of preference
		const approaches = [
			() => this.createVideoWithNativeFFmpeg(audioFile, videoSettings, jobId, broadcastLog),
			() => this.createVideoWithFluentFFmpeg(audioFile, videoSettings, jobId, broadcastLog),
			() => this.createVideoWithCanvas(audioFile, videoSettings, jobId, broadcastLog)
		];

			for (let i = 0; i < approaches.length; i++) {
				try {
					broadcastLog('info', 'video', `Trying approach ${i + 1}`, `Job: ${jobId}`);
					const result = await approaches[i]();
					broadcastLog('success', 'video', `Video created successfully with approach ${i + 1}`, `Job: ${jobId}`);
					return result;
				} catch (error) {
					broadcastLog('warning', 'video', `Approach ${i + 1} failed`, `Job: ${jobId}, Error: ${error.message}`);
					if (i === approaches.length - 1) {
						throw error; // All approaches failed
					}
				}
			}
		} catch (error) {
			broadcastLog('error', 'video', `All video generation approaches failed`, `Job: ${jobId}, Error: ${error.message}`);
			throw error;
		}
	}

	async createVideoWithFluentFFmpeg(audioFile, videoSettings, jobId, broadcastLog) {
		const { backgroundType, videoResolution, backgroundFile } = videoSettings;
		const audioBasename = path.basename(audioFile, '.mp3');
		const videoOutput = path.join(this.outputsDir, `${audioBasename}-video.mp4`);
		
		return new Promise((resolve, reject) => {
			const command = ffmpeg();
			
			if (backgroundType === 'image') {
				const imagePath = path.join(this.uploadDir, backgroundFile);
				if (!fs.existsSync(imagePath)) {
					reject(new Error(`Background image not found: ${backgroundFile}`));
					return;
				}
				
				command
					.input(imagePath)
					.inputOptions(['-loop 1'])
					.input(audioFile)
					.outputOptions([
						'-c:v libx264',
						'-c:a aac',
						'-shortest',
						'-pix_fmt yuv420p',
						`-vf scale=${this.getResolutionScale(videoResolution)}`
					])
					.output(videoOutput);
			} else {
				const videoPath = path.join(this.uploadDir, backgroundFile);
				if (!fs.existsSync(videoPath)) {
					reject(new Error(`Background video not found: ${backgroundFile}`));
					return;
				}
				
				command
					.input(videoPath)
					.inputOptions(['-stream_loop -1'])
					.input(audioFile)
					.outputOptions([
						'-c:v libx264',
						'-c:a aac',
						'-shortest',
						'-pix_fmt yuv420p',
						`-vf scale=${this.getResolutionScale(videoResolution)}`
					])
					.output(videoOutput);
			}
			
			command
				.on('start', (commandLine) => {
					broadcastLog('info', 'video', `FFmpeg command started`, `Job: ${jobId}, Command: ${commandLine}`);
				})
				.on('progress', (progress) => {
					broadcastLog('debug', 'video', `FFmpeg progress`, `Job: ${jobId}, ${progress.percent}%`);
				})
				.on('end', () => {
					broadcastLog('success', 'video', `FFmpeg completed`, `Job: ${jobId}, Output: ${path.basename(videoOutput)}`);
					resolve(videoOutput);
				})
				.on('error', (error) => {
					broadcastLog('error', 'video', `FFmpeg error`, `Job: ${jobId}, Error: ${error.message}`);
					reject(error);
				})
				.run();
		});
	}

	async createVideoWithCanvas(audioFile, videoSettings, jobId, broadcastLog) {
		// Canvas-based video generation not implemented yet
		broadcastLog('info', 'video', `Canvas video generation not implemented`, `Job: ${jobId}`);
		throw new Error('Canvas video generation not implemented yet');
	}

	async createVideoWithNativeFFmpeg(audioFile, videoSettings, jobId, broadcastLog) {
		const { backgroundType, videoResolution, backgroundFile } = videoSettings;
		const audioBasename = path.basename(audioFile, '.mp3');
		const videoOutput = path.join(this.outputsDir, `${audioBasename}-video.mp4`);
		
		// Get audio duration
		const audioDuration = await this.getAudioDuration(audioFile);
		
		// Build FFmpeg command
		let ffmpegCommand;
		
		if (backgroundType === 'image') {
			const imagePath = path.join(this.uploadDir, backgroundFile);
			if (!fs.existsSync(imagePath)) {
				throw new Error(`Background image not found: ${backgroundFile}`);
			}
			
			ffmpegCommand = [
				'-loop', '1',
				'-i', imagePath,
				'-i', audioFile,
				'-c:v', 'libx264',
				'-c:a', 'aac',
				'-shortest',
				'-pix_fmt', 'yuv420p',
				'-vf', `scale=${this.getResolutionScale(videoResolution)}`,
				'-y', videoOutput
			];
		} else {
			const videoPath = path.join(this.uploadDir, backgroundFile);
			if (!fs.existsSync(videoPath)) {
				throw new Error(`Background video not found: ${backgroundFile}`);
			}
			
			ffmpegCommand = [
				'-stream_loop', '-1',
				'-i', videoPath,
				'-i', audioFile,
				'-c:v', 'libx264',
				'-c:a', 'aac',
				'-shortest',
				'-pix_fmt', 'yuv420p',
				'-vf', `scale=${this.getResolutionScale(videoResolution)}`,
				'-y', videoOutput
			];
		}
		
		return new Promise((resolve, reject) => {
			const ffmpeg = spawn(ffmpegPath.path, ffmpegCommand);
			
			let stderr = '';
			let stdout = '';
			
			ffmpeg.stdout.on('data', (data) => {
				stdout += data.toString();
			});
			
			ffmpeg.stderr.on('data', (data) => {
				stderr += data.toString();
			});
			
			ffmpeg.on('close', (code) => {
				if (code === 0) {
					broadcastLog('success', 'video', `Native FFmpeg completed`, `Job: ${jobId}, Output: ${path.basename(videoOutput)}`);
					resolve(videoOutput);
				} else {
					broadcastLog('error', 'video', `Native FFmpeg failed`, `Job: ${jobId}, Code: ${code}, Error: ${stderr}`);
					reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
				}
			});
			
			ffmpeg.on('error', (error) => {
				broadcastLog('error', 'video', `Native FFmpeg error`, `Job: ${jobId}, Error: ${error.message}`);
				reject(error);
			});
		});
	}

	async getAudioDuration(audioFile) {
		return new Promise((resolve, reject) => {
			const ffprobe = spawn(ffmpegPath.path.replace('ffmpeg', 'ffprobe'), [
				'-v', 'quiet',
				'-show_entries', 'format=duration',
				'-of', 'csv=p=0',
				audioFile
			]);
			
			let output = '';
			
			ffprobe.stdout.on('data', (data) => {
				output += data.toString();
			});
			
			ffprobe.on('close', (code) => {
				if (code === 0) {
					const duration = parseFloat(output.trim());
					resolve(duration);
				} else {
					reject(new Error(`ffprobe failed with code ${code}`));
				}
			});
			
			ffprobe.on('error', (error) => {
				reject(error);
			});
		});
	}

	getResolutionScale(resolution) {
		switch (resolution) {
			case '720p': return '1280:720';
			case '1080p': return '1920:1080';
			case '4k': return '3840:2160';
			default: return '1920:1080';
		}
	}
}
