import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

export class VideoGenerator {
    constructor(outputsDir) {
        this.outputsDir = outputsDir || path.resolve(__dirname, '../storage/outputs');
        this.tempDir = path.join(this.outputsDir, 'temp');
        this.ensureDirectories();
    }

    ensureDirectories() {
        if (!fs.existsSync(this.outputsDir)) {
            fs.mkdirSync(this.outputsDir, { recursive: true });
        }
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async createVideo(audioFile, videoSettings, jobId, broadcastLog) {
        try {
            const {
                backgroundType = 'static',
                backgroundFile = null,
                resolution = '1080p',
                duration = null,
                outputFormat = 'mp4'
            } = videoSettings;

            const audioBasename = path.basename(audioFile, path.extname(audioFile));
            const videoOutput = path.join(this.outputsDir, `${audioBasename}-video.${outputFormat}`);
            
            broadcastLog(`[Video] Starting video generation for ${audioBasename}`);
            broadcastLog(`[Video] Resolution: ${resolution}, Background: ${backgroundType}`);

            // Get audio duration if not provided
            let audioDuration = duration;
            if (!audioDuration) {
                audioDuration = await this.getAudioDuration(audioFile);
                broadcastLog(`[Video] Audio duration: ${audioDuration}s`);
            }

            // Create video based on background type
            if (backgroundType === 'static' && backgroundFile) {
                await this.createVideoWithStaticBackground(
                    audioFile, 
                    backgroundFile, 
                    videoOutput, 
                    resolution, 
                    audioDuration,
                    broadcastLog
                );
            } else if (backgroundType === 'video' && backgroundFile) {
                await this.createVideoWithVideoBackground(
                    audioFile, 
                    backgroundFile, 
                    videoOutput, 
                    resolution, 
                    audioDuration,
                    broadcastLog
                );
            } else {
                // Create video with solid color background
                await this.createVideoWithColorBackground(
                    audioFile, 
                    videoOutput, 
                    resolution, 
                    audioDuration,
                    broadcastLog
                );
            }

            broadcastLog(`[Video] Video generation completed: ${path.basename(videoOutput)}`);
            return videoOutput;

        } catch (error) {
            broadcastLog(`[Video] Error: ${error.message}`);
            throw error;
        }
    }

    async createVideoWithStaticBackground(audioFile, backgroundFile, outputFile, resolution, duration, broadcastLog) {
        const { width, height } = this.getResolutionDimensions(resolution);
        
        broadcastLog(`[Video] Creating video with static background: ${width}x${height}`);

        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(backgroundFile)
                .input(audioFile)
                .outputOptions([
                    `-c:v libx264`,
                    `-preset medium`,
                    `-crf 23`,
                    `-c:a aac`,
                    `-b:a 128k`,
                    `-shortest`,
                    `-vf scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`
                ])
                .output(outputFile)
                .on('progress', (progress) => {
                    if (progress.percent) {
                        broadcastLog(`[Video] Progress: ${Math.round(progress.percent)}%`);
                    }
                })
                .on('end', () => {
                    broadcastLog(`[Video] Static background video completed`);
                    resolve(outputFile);
                })
                .on('error', (err) => {
                    reject(new Error(`FFmpeg error: ${err.message}`));
                })
                .run();
        });
    }

    async createVideoWithVideoBackground(audioFile, backgroundFile, outputFile, resolution, duration, broadcastLog) {
        const { width, height } = this.getResolutionDimensions(resolution);
        
        broadcastLog(`[Video] Creating video with video background: ${width}x${height}`);

        return new Promise((resolve, reject) => {
            ffmpeg()
                .input(backgroundFile)
                .input(audioFile)
                .outputOptions([
                    `-c:v libx264`,
                    `-preset medium`,
                    `-crf 23`,
                    `-c:a aac`,
                    `-b:a 128k`,
                    `-shortest`,
                    `-vf scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`
                ])
                .output(outputFile)
                .on('progress', (progress) => {
                    if (progress.percent) {
                        broadcastLog(`[Video] Progress: ${Math.round(progress.percent)}%`);
                    }
                })
                .on('end', () => {
                    broadcastLog(`[Video] Video background video completed`);
                    resolve(outputFile);
                })
                .on('error', (err) => {
                    reject(new Error(`FFmpeg error: ${err.message}`));
                })
                .run();
        });
    }

    async createVideoWithColorBackground(audioFile, outputFile, resolution, duration, broadcastLog) {
        const { width, height } = this.getResolutionDimensions(resolution);
        
        broadcastLog(`[Video] Creating video with color background: ${width}x${height}`);

        return new Promise((resolve, reject) => {
            ffmpeg()
                .input('color=black:size=' + width + 'x' + height + ':duration=' + duration)
                .input(audioFile)
                .outputOptions([
                    `-c:v libx264`,
                    `-preset medium`,
                    `-crf 23`,
                    `-c:a aac`,
                    `-b:a 128k`,
                    `-shortest`
                ])
                .output(outputFile)
                .on('progress', (progress) => {
                    if (progress.percent) {
                        broadcastLog(`[Video] Progress: ${Math.round(progress.percent)}%`);
                    }
                })
                .on('end', () => {
                    broadcastLog(`[Video] Color background video completed`);
                    resolve(outputFile);
                })
                .on('error', (err) => {
                    reject(new Error(`FFmpeg error: ${err.message}`));
                })
                .run();
        });
    }

    async getAudioDuration(audioFile) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(audioFile, (err, metadata) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(metadata.format.duration);
                }
            });
        });
    }

    getResolutionDimensions(resolution) {
        const resolutions = {
            '720p': { width: 1280, height: 720 },
            '1080p': { width: 1920, height: 1080 },
            '4k': { width: 3840, height: 2160 }
        };
        
        return resolutions[resolution] || resolutions['1080p'];
    }

    async testFFmpeg() {
        try {
            return new Promise((resolve) => {
                ffmpeg.ffprobe(ffmpegPath.path, (err) => {
                    if (err) {
                        resolve({
                            success: false,
                            message: 'FFmpeg not accessible',
                            error: err.message
                        });
                    } else {
                        resolve({
                            success: true,
                            message: 'FFmpeg is working correctly',
                            version: ffmpegPath.version
                        });
                    }
                });
            });
        } catch (error) {
            return {
                success: false,
                message: 'FFmpeg test failed',
                error: error.message
            };
        }
    }

    cleanupTempFiles() {
        try {
            const tempFiles = fs.readdirSync(this.tempDir);
            tempFiles.forEach(file => {
                const filePath = path.join(this.tempDir, file);
                if (fs.statSync(filePath).isFile()) {
                    fs.unlinkSync(filePath);
                }
            });
        } catch (error) {
            console.error('[VideoGenerator] Cleanup error:', error);
        }
    }
}
