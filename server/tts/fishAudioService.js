import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class FishAudioService {
    constructor(apiKey, outputsDir, baseUrl = 'https://api.fish.audio') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.outputsDir = outputsDir || path.resolve(__dirname, '../../storage/outputs');
    }

    async generateAudio(text, voiceModelId, options = {}) {
        try {
            const {
                format = 'mp3',
                quality = 'high',
                speed = 1.0,
                pitch = 0,
                sentencesPerChunk = 1
            } = options;

            // Split text into sentences for chunking
            const sentences = this.splitIntoSentences(text);
            const chunks = this.createChunks(sentences, sentencesPerChunk);
            
            const audioFiles = [];
            
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkText = chunk.join(' ');
                
                console.log(`[FishAudio] Processing chunk ${i + 1}/${chunks.length}: "${chunkText.substring(0, 50)}..."`);
                
                const audioFile = await this.processChunk(chunkText, voiceModelId, {
                    format,
                    quality,
                    speed,
                    pitch,
                    chunkIndex: i
                });
                
                audioFiles.push(audioFile);
            }
            
            // Stitch audio chunks together
            const finalAudio = await this.stitchAudioChunks(audioFiles, format);
            
            // Clean up individual chunk files
            audioFiles.forEach(file => {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                }
            });
            
            return finalAudio;
            
        } catch (error) {
            console.error('[FishAudio] Audio generation failed:', error);
            throw new Error(`TTS generation failed: ${error.message}`);
        }
    }

    async processChunk(text, voiceModelId, options) {
        const payload = {
            text: text,
            voice_id: voiceModelId,
            format: options.format || 'mp3',
            quality: options.quality || 'high',
            speed: options.speed || 1.0,
            pitch: options.pitch || 0
        };

        const response = await fetch(`${this.baseUrl}/v1/audio/generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Fish.Audio API error: ${response.status} - ${errorText}`);
        }

        const audioBuffer = await response.arrayBuffer();
        const chunkFilename = `chunk_${options.chunkIndex}_${Date.now()}.${options.format}`;
        const chunkPath = path.join(this.outputsDir, chunkFilename);
        
        fs.writeFileSync(chunkPath, Buffer.from(audioBuffer));
        
        return chunkPath;
    }

    async stitchAudioChunks(audioFiles, format) {
        // For now, return the first chunk as a placeholder
        // In a full implementation, this would use FFmpeg to stitch audio files
        if (audioFiles.length === 1) {
            return audioFiles[0];
        }
        
        // TODO: Implement FFmpeg audio stitching
        console.log('[FishAudio] Audio stitching not yet implemented, returning first chunk');
        return audioFiles[0];
    }

    splitIntoSentences(text) {
        // Simple sentence splitting - can be improved with NLP libraries
        return text
            .replace(/([.!?])\s*(?=[A-Z])/g, '$1|')
            .split('|')
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    createChunks(sentences, sentencesPerChunk) {
        const chunks = [];
        for (let i = 0; i < sentences.length; i += sentencesPerChunk) {
            chunks.push(sentences.slice(i, i + sentencesPerChunk));
        }
        return chunks;
    }

    async testConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/v1/voices`, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`API test failed: ${response.status}`);
            }
            
            const voices = await response.json();
            return {
                success: true,
                message: 'Fish.Audio API connection successful',
                availableVoices: voices.length
            };
        } catch (error) {
            return {
                success: false,
                message: `API test failed: ${error.message}`,
                error: error.message
            };
        }
    }
}
