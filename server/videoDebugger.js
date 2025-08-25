import fs from 'fs';
import path from 'path';

export class VideoDebugger {
	constructor(outputsDir) {
		this.outputsDir = outputsDir;
		this.debugDir = path.join(outputsDir, 'debug');
		this.ensureDebugDirectory();
	}

	ensureDebugDirectory() {
		if (!fs.existsSync(this.debugDir)) {
			fs.mkdirSync(this.debugDir, { recursive: true });
		}
	}

	createDebugSession(jobId) {
		const sessionId = `debug_${jobId}_${Date.now()}`;
		const sessionDir = path.join(this.debugDir, sessionId);
		fs.mkdirSync(sessionDir, { recursive: true });
		
		const session = {
			id: sessionId,
			jobId,
			startTime: new Date().toISOString(),
			steps: [],
			errors: [],
			warnings: [],
			fileChecks: [],
			ffmpegCommands: [],
			performance: {
				startTime: Date.now(),
				checkpoints: []
			}
		};

		this.saveSession(session);
		return session;
	}

	saveSession(session) {
		const sessionFile = path.join(this.debugDir, `${session.id}.json`);
		fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
	}

	logStep(session, step, details = {}) {
		const stepData = {
			timestamp: new Date().toISOString(),
			step,
			details,
			duration: Date.now() - session.performance.startTime
		};

		session.steps.push(stepData);
		session.performance.checkpoints.push({
			step,
			timestamp: stepData.timestamp,
			duration: stepData.duration
		});

		this.saveSession(session);
		return stepData;
	}

	logError(session, error, context = {}) {
		const errorData = {
			timestamp: new Date().toISOString(),
			error: error.message || error,
			stack: error.stack,
			context,
			duration: Date.now() - session.performance.startTime
		};

		session.errors.push(errorData);
		this.saveSession(session);
		return errorData;
	}

	logWarning(session, warning, context = {}) {
		const warningData = {
			timestamp: new Date().toISOString(),
			warning,
			context,
			duration: Date.now() - session.performance.startTime
		};

		session.warnings.push(warningData);
		this.saveSession(session);
		return warningData;
	}

	logFileCheck(session, filePath, expected = true) {
		const exists = fs.existsSync(filePath);
		const size = exists ? fs.statSync(filePath).size : 0;
		
		const fileData = {
			timestamp: new Date().toISOString(),
			filePath,
			exists,
			size,
			expected,
			status: exists === expected ? 'PASS' : 'FAIL'
		};

		session.fileChecks.push(fileData);
		this.saveSession(session);
		return fileData;
	}

	logFFmpegCommand(session, command, outputFile, expectedSuccess = true) {
		const commandData = {
			timestamp: new Date().toISOString(),
			command: Array.isArray(command) ? command.join(' ') : command,
			outputFile,
			expectedSuccess,
			fileExists: fs.existsSync(outputFile),
			fileSize: fs.existsSync(outputFile) ? fs.statSync(outputFile).size : 0
		};

		session.ffmpegCommands.push(commandData);
		this.saveSession(session);
		return commandData;
	}

	validateVideoSettings(session, videoSettings) {
		const validation = {
			backgroundType: {
				value: videoSettings.backgroundType,
				valid: ['image', 'video'].includes(videoSettings.backgroundType),
				required: true
			},
			videoResolution: {
				value: videoSettings.videoResolution,
				valid: ['720p', '1080p', '4k'].includes(videoSettings.videoResolution),
				required: true
			},
			backgroundFile: {
				value: videoSettings.backgroundFile,
				valid: !!videoSettings.backgroundFile,
				required: true
			},
			bookName: {
				value: videoSettings.bookName,
				valid: !!videoSettings.bookName,
				required: false
			},
			chapterNumber: {
				value: videoSettings.chapterNumber,
				valid: !!videoSettings.chapterNumber,
				required: false
			},
			enableTitle: {
				value: videoSettings.enableTitle,
				valid: typeof videoSettings.enableTitle === 'boolean',
				required: false
			}
		};

		const isValid = Object.values(validation).every(v => !v.required || v.valid);
		
		this.logStep(session, 'validate_video_settings', {
			validation,
			isValid,
			settings: videoSettings
		});

		return { isValid, validation };
	}

	validateInputFiles(session, audioFile, backgroundFile, uploadDir) {
		const checks = {
			audioFile: {
				path: audioFile,
				exists: fs.existsSync(audioFile),
				size: fs.existsSync(audioFile) ? fs.statSync(audioFile).size : 0
			},
			backgroundFile: {
				path: path.join(uploadDir, backgroundFile),
				exists: fs.existsSync(path.join(uploadDir, backgroundFile)),
				size: fs.existsSync(path.join(uploadDir, backgroundFile)) ? fs.statSync(path.join(uploadDir, backgroundFile)).size : 0
			},
			uploadDir: {
				path: uploadDir,
				exists: fs.existsSync(uploadDir),
				writable: fs.accessSync(uploadDir, fs.constants.W_OK)
			}
		};

		const isValid = checks.audioFile.exists && checks.backgroundFile.exists && checks.uploadDir.exists;

		this.logStep(session, 'validate_input_files', {
			checks,
			isValid
		});

		return { isValid, checks };
	}

	monitorFFmpegProcess(session, ffmpegProcess, outputFile, jobId) {
		return new Promise((resolve, reject) => {
			let stdout = '';
			let stderr = '';
			let startTime = Date.now();

			ffmpegProcess.stdout?.on('data', (data) => {
				stdout += data.toString();
			});

			ffmpegProcess.stderr?.on('data', (data) => {
				stderr += data.toString();
			});

			ffmpegProcess.on('close', (code) => {
				const duration = Date.now() - startTime;
				const success = code === 0 || (fs.existsSync(outputFile) && fs.statSync(outputFile).size > 0);
				
				const result = {
					exitCode: code,
					duration,
					success,
					stdout,
					stderr,
					outputFileExists: fs.existsSync(outputFile),
					outputFileSize: fs.existsSync(outputFile) ? fs.statSync(outputFile).size : 0
				};

				this.logStep(session, 'ffmpeg_process_completed', result);

				if (success) {
					resolve(result);
				} else {
					this.logError(session, new Error(`FFmpeg failed with code ${code}`), result);
					reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
				}
			});

			ffmpegProcess.on('error', (error) => {
				const duration = Date.now() - startTime;
				this.logError(session, error, { duration, stdout, stderr });
				reject(error);
			});
		});
	}

	generateDebugReport(session) {
		const endTime = Date.now();
		const totalDuration = endTime - session.performance.startTime;
		
		const report = {
			sessionId: session.id,
			jobId: session.jobId,
			startTime: session.startTime,
			endTime: new Date().toISOString(),
			totalDuration,
			summary: {
				totalSteps: session.steps.length,
				totalErrors: session.errors.length,
				totalWarnings: session.warnings.length,
				totalFileChecks: session.fileChecks.length,
				totalFFmpegCommands: session.ffmpegCommands.length,
				success: session.errors.length === 0
			},
			steps: session.steps,
			errors: session.errors,
			warnings: session.warnings,
			fileChecks: session.fileChecks,
			ffmpegCommands: session.ffmpegCommands,
			performance: {
				...session.performance,
				totalDuration
			}
		};

		const reportFile = path.join(this.debugDir, `${session.id}_report.json`);
		fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

		return report;
	}

	getDebugSessions() {
		const files = fs.readdirSync(this.debugDir).filter(f => f.endsWith('.json'));
		return files.map(file => {
			const content = fs.readFileSync(path.join(this.debugDir, file), 'utf-8');
			return JSON.parse(content);
		}).sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
	}

	cleanupOldSessions(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
		const files = fs.readdirSync(this.debugDir).filter(f => f.endsWith('.json'));
		const now = Date.now();
		
		files.forEach(file => {
			const filePath = path.join(this.debugDir, file);
			const stats = fs.statSync(filePath);
			if (now - stats.mtime.getTime() > maxAge) {
				fs.unlinkSync(filePath);
			}
		});
	}
}
