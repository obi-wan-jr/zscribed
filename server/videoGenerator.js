import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { VideoDebugger } from './videoDebugger.js';

export class VideoGenerator {
	constructor(outputsDir, storageDir) {
		this.outputsDir = outputsDir;
		this.storageDir = storageDir;
		this.uploadDir = path.join(storageDir, 'uploads');
		this.debugger = new VideoDebugger(outputsDir);
	}

	async createVideo(audioFile, videoSettings, jobId, broadcastLog, emitProgress) {
		// Create debug session
		const debugSession = this.debugger.createDebugSession(jobId);
		
		try {
			this.debugger.logStep(debugSession, 'video_creation_started', {
				audioFile,
				videoSettings,
				jobId
			});

			const { backgroundType, videoResolution, backgroundFile, bookName, chapterNumber, enableTitle = true } = videoSettings;
			const audioBasename = path.basename(audioFile, '.mp3');
			const videoOutput = path.join(this.outputsDir, `${audioBasename}-video.mp4`);
			
			broadcastLog('progress', 'video', 'video_init', `Starting video creation: ${videoResolution}, ${backgroundType}`, `Job: ${jobId}`);
			
			// Validate video settings
			const settingsValidation = this.debugger.validateVideoSettings(debugSession, videoSettings);
			if (!settingsValidation.isValid) {
				this.debugger.logError(debugSession, new Error('Invalid video settings'), settingsValidation);
				throw new Error('Invalid video settings');
			}

			// Validate input files
			const fileValidation = this.debugger.validateInputFiles(debugSession, audioFile, backgroundFile, this.uploadDir);
			if (!fileValidation.isValid) {
				this.debugger.logError(debugSession, new Error('Invalid input files'), fileValidation);
				throw new Error('Invalid input files');
			}

			// Get audio duration early for accurate timing
			this.debugger.logStep(debugSession, 'getting_audio_duration');
			const audioDurationMs = await this.getAudioDurationMs(audioFile);
			if (!audioDurationMs) {
				this.debugger.logWarning(debugSession, 'Could not determine audio duration, using default timing');
				broadcastLog('warning', 'video', 'Could not determine audio duration, using default timing', `Job: ${jobId}`);
			}

			this.debugger.logStep(debugSession, 'audio_duration_obtained', { audioDurationMs });

			// Create video with static title (if enabled)
			if (bookName && chapterNumber && enableTitle) {
				this.debugger.logStep(debugSession, 'creating_video_with_title', {
					bookName,
					chapterNumber,
					enableTitle
				});
				
				broadcastLog('info', 'video', `Creating video with static title overlay`, `Job: ${jobId}`);
				const ffmpegArgs = await this.buildBasicVideoWithTitleCommand(backgroundType, backgroundFile, audioFile, videoResolution, videoOutput, bookName, chapterNumber, audioDurationMs);
				
				this.debugger.logFFmpegCommand(debugSession, ffmpegArgs, videoOutput);
				await this.runFFmpegCommandWithDebug(ffmpegArgs, videoOutput, jobId, broadcastLog, emitProgress, debugSession);
				broadcastLog('success', 'video', `Video with title created successfully`, `Job: ${jobId}`);
			} else {
				// No title needed, create basic video
				this.debugger.logStep(debugSession, 'creating_basic_video', {
					bookName,
					chapterNumber,
					enableTitle
				});
				
				broadcastLog('info', 'video', `Creating basic video without title`, `Job: ${jobId}`);
				const ffmpegArgs = await this.buildBasicVideoCommand(backgroundType, backgroundFile, audioFile, videoResolution, videoOutput, audioDurationMs);
				
				this.debugger.logFFmpegCommand(debugSession, ffmpegArgs, videoOutput);
				await this.runFFmpegCommandWithDebug(ffmpegArgs, videoOutput, jobId, broadcastLog, emitProgress, debugSession);
				broadcastLog('success', 'video', `Basic video created successfully`, `Job: ${jobId}`);
			}

			// Final file check
			this.debugger.logFileCheck(debugSession, videoOutput, true);
			
			this.debugger.logStep(debugSession, 'video_creation_completed', {
				videoOutput,
				fileSize: fs.existsSync(videoOutput) ? fs.statSync(videoOutput).size : 0
			});

			// Generate debug report
			const report = this.debugger.generateDebugReport(debugSession);
			this.debugger.logStep(debugSession, 'debug_report_generated', { reportId: report.sessionId });

			return videoOutput;
		} catch (error) {
			this.debugger.logError(debugSession, error, {
				audioFile,
				videoSettings,
				jobId
			});
			
			// Generate debug report even on error
			const report = this.debugger.generateDebugReport(debugSession);
			
			broadcastLog('error', 'video', 'video_failed', error.message, `Job: ${jobId}`);
			throw error;
		}
	}

	async buildBasicVideoCommand(backgroundType, backgroundFile, audioFile, videoResolution, videoOutput, audioDurationMs = 0) {
		const scale = this.getResolutionScale(videoResolution);
		
		// Calculate duration for -t parameter - use fallback if audio duration is 0
		const durationSec = audioDurationMs > 0 ? (audioDurationMs / 1000).toFixed(6) : '30.0'; // 30 second fallback
		
		if (backgroundType === 'image') {
			const imagePath = path.join(this.uploadDir, backgroundFile);
			
			if (!fs.existsSync(imagePath)) {
				throw new Error(`Background image not found: ${backgroundFile}`);
			}
			
			const args = [
				'-framerate', '30',
				'-loop', '1',
				'-i', imagePath,
				'-i', audioFile,
				'-c:v', 'libx264',
				'-c:a', 'aac',
				'-ar', '44100',
				'-vf', `scale=${scale}`,
				'-shortest',
				'-pix_fmt', 'yuv420p',
				'-tune', 'stillimage',
				'-preset', 'fast',
				'-movflags', '+faststart'
			];
			
			args.push('-y', videoOutput);
			return args;
		} else {
			const videoPath = path.join(this.uploadDir, backgroundFile);
			if (!fs.existsSync(videoPath)) {
				throw new Error(`Background video not found: ${backgroundFile}`);
			}
			
			const args = [
				'-stream_loop', '-1',
				'-i', videoPath,
				'-i', audioFile,
				'-c:v', 'libx264',
				'-c:a', 'aac',
				'-ar', '44100',
				'-vf', `scale=${scale}`,
				'-shortest',
				'-pix_fmt', 'yuv420p',
				'-preset', 'fast',
				'-movflags', '+faststart'
			];
			
			args.push('-y', videoOutput);
			return args;
		}
	}

	async buildBasicVideoWithTitleCommand(backgroundType, backgroundFile, audioFile, videoResolution, videoOutput, bookName, chapterNumber, audioDurationMs = 0) {
		const scale = this.getResolutionScale(videoResolution);
		const titleFilter = this.buildTitleFilter(bookName, chapterNumber, videoResolution);
		
		// Calculate duration for -t parameter - use fallback if audio duration is 0
		const durationSec = audioDurationMs > 0 ? (audioDurationMs / 1000).toFixed(6) : '30.0'; // 30 second fallback
		
		if (backgroundType === 'image') {
			const imagePath = path.join(this.uploadDir, backgroundFile);
			
			if (!fs.existsSync(imagePath)) {
				throw new Error(`Background image not found: ${backgroundFile}`);
			}
			
			const args = [
				'-framerate', '30',
				'-loop', '1',
				'-i', imagePath,
				'-i', audioFile,
				'-c:v', 'libx264',
				'-c:a', 'aac',
				'-ar', '44100',
				'-vf', `scale=${scale}${titleFilter}`,
				'-shortest',
				'-pix_fmt', 'yuv420p',
				'-tune', 'stillimage',
				'-preset', 'fast',
				'-movflags', '+faststart'
			];
			
			args.push('-y', videoOutput);
			return args;
		} else {
			const videoPath = path.join(this.uploadDir, backgroundFile);
			if (!fs.existsSync(videoPath)) {
				throw new Error(`Background video not found: ${backgroundFile}`);
			}
			
			const args = [
				'-stream_loop', '-1',
				'-i', videoPath,
				'-i', audioFile,
				'-c:v', 'libx264',
				'-c:a', 'aac',
				'-ar', '44100',
				'-vf', `scale=${scale}${titleFilter}`,
				'-shortest',
				'-pix_fmt', 'yuv420p',
				'-preset', 'fast',
				'-movflags', '+faststart'
			];
			
			args.push('-y', videoOutput);
			return args;
		}
	}

	buildTitleFilter(bookName, chapterNumber, resolution) {
		if (!bookName || !chapterNumber) {
			return '';
		}

		// Escape special characters in book name and chapter number
		const escapedBookName = bookName.replace(/[\\:]/g, '\\$&');
		const escapedChapterNumber = chapterNumber.toString().replace(/[\\:]/g, '\\$&');
		
		// Create the text to display
		const text = `${escapedBookName} Chapter ${escapedChapterNumber}`;
		
		// Calculate font size based on resolution
		let fontSize;
		switch (resolution) {
			case '720p': fontSize = 48; break;
			case '1080p': fontSize = 72; break;
			case '4k': fontSize = 144; break;
			default: fontSize = 72;
		}
		
		// Calculate position (top center)
		let x, y;
		switch (resolution) {
			case '720p': x = 640; y = 60; break; // 1280/2, 60 from top
			case '1080p': x = 960; y = 90; break; // 1920/2, 90 from top
			case '4k': x = 1920; y = 180; break; // 3840/2, 180 from top
			default: x = 960; y = 90;
		}
		
		// Try to find a suitable font file
		const fontPaths = [
			'/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
			'/usr/share/fonts/TTF/arial.ttf',
			'/System/Library/Fonts/Arial.ttf',
			'/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
		];
		
		let fontfile = '';
		for (const fontPath of fontPaths) {
			if (fs.existsSync(fontPath)) {
				fontfile = `:fontfile=${fontPath}`;
				break;
			}
		}
		
		// Build the drawtext filter with proper centering
		const filter = `,drawtext=text='${text}':fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=${y}:box=1:boxcolor=black@0.5:boxborderw=5:line_spacing=10:box_align=center${fontfile}`;
		
		return filter;
	}

	async getAudioDurationMs(audioFile) {
		return new Promise((resolve, reject) => {
			const ffprobe = spawn('ffprobe', [
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
					resolve(duration * 1000); // Convert to milliseconds
				} else {
					resolve(0); // Return 0 if we can't get duration
				}
			});
			
			ffprobe.on('error', (error) => {
				resolve(0); // Return 0 if we can't get duration
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

	async runFFmpegCommandWithDebug(args, outputFile, jobId, broadcastLog, emitProgress, debugSession) {
		return new Promise((resolve, reject) => {
			const ffmpeg = spawn('ffmpeg', args);
			
			let stderr = '';
			let stdout = '';
			
			ffmpeg.stdout.on('data', (data) => {
				stdout += data.toString();
			});
			
			ffmpeg.stderr.on('data', (data) => {
				stderr += data.toString();
			});
			
			ffmpeg.on('close', (code) => {
				const success = code === 0 || (fs.existsSync(outputFile) && fs.statSync(outputFile).size > 0);
				
				if (success) {
					this.debugger.logStep(debugSession, 'ffmpeg_completed_successfully', {
						exitCode: code,
						outputFile,
						fileSize: fs.existsSync(outputFile) ? fs.statSync(outputFile).size : 0
					});
					broadcastLog('success', 'video', `FFmpeg completed successfully`, `Job: ${jobId}`);
					resolve(outputFile);
				} else {
					this.debugger.logError(debugSession, new Error(`FFmpeg failed with code ${code}`), {
						exitCode: code,
						stderr,
						stdout,
						outputFile
					});
					broadcastLog('error', 'video', `FFmpeg failed`, `Job: ${jobId}, Code: ${code}, Error: ${stderr}`);
					reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
				}
			});
			
			ffmpeg.on('error', (error) => {
				this.debugger.logError(debugSession, error, {
					args,
					outputFile
				});
				broadcastLog('error', 'video', `FFmpeg error`, `Job: ${jobId}, Error: ${error.message}`);
				reject(error);
			});
		});
	}

	async runFFmpegCommand(args, outputFile, jobId, broadcastLog, emitProgress) {
		return new Promise((resolve, reject) => {
			const ffmpeg = spawn('ffmpeg', args);
			
			let stderr = '';
			let stdout = '';
			
			ffmpeg.stdout.on('data', (data) => {
				stdout += data.toString();
			});
			
			ffmpeg.stderr.on('data', (data) => {
				stderr += data.toString();
			});
			
			ffmpeg.on('close', (code) => {
				if (code === 0 || (fs.existsSync(outputFile) && fs.statSync(outputFile).size > 0)) {
					broadcastLog('success', 'video', `FFmpeg completed successfully`, `Job: ${jobId}`);
					resolve(outputFile);
				} else {
					broadcastLog('error', 'video', `FFmpeg failed`, `Job: ${jobId}, Code: ${code}, Error: ${stderr}`);
					reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
				}
			});
			
			ffmpeg.on('error', (error) => {
				broadcastLog('error', 'video', `FFmpeg error`, `Job: ${jobId}, Error: ${error.message}`);
				reject(error);
			});
		});
	}
}
