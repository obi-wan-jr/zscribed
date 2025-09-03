class TTSPage {
    constructor() {
        this.currentJob = null;
        this.jobPollingInterval = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadVoiceModels();
        this.loadRecentJobs();
        this.updateCharCount();
    }

    bindEvents() {
        document.getElementById('ttsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.generateTTS();
        });

        document.getElementById('textInput').addEventListener('input', () => {
            this.updateCharCount();
        });

        document.getElementById('speed').addEventListener('input', (e) => {
            document.getElementById('speedValue').textContent = `${e.target.value}x`;
        });
    }

    updateCharCount() {
        const text = document.getElementById('textInput').value;
        const count = text.length;
        document.getElementById('charCount').textContent = `${count}/10000`;
        
        // Update character count color
        const charCount = document.getElementById('charCount');
        if (count > 8000) {
            charCount.className = 'text-xs text-red-400';
        } else if (count > 6000) {
            charCount.className = 'text-xs text-yellow-400';
        } else {
            charCount.className = 'text-xs text-slate-400';
        }
    }

    async loadVoiceModels() {
        try {
            // For now, use hardcoded models - in production this would come from config
            const models = [
                { id: '2939fcf1e9224fe9ac0839f1e2b26c50', name: 'Default Voice' },
                { id: 'custom-voice-1', name: 'Custom Voice 1' },
                { id: 'custom-voice-2', name: 'Custom Voice 2' }
            ];

            const select = document.getElementById('voiceModel');
            select.innerHTML = '<option value="">Select a voice model...</option>';
            
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load voice models:', error);
        }
    }

    async generateTTS() {
        const text = document.getElementById('textInput').value.trim();
        const voiceModelId = document.getElementById('voiceModel').value;
        const format = document.getElementById('format').value;
        const quality = document.getElementById('quality').value;
        const speed = parseFloat(document.getElementById('speed').value);
        const sentencesPerChunk = parseInt(document.getElementById('sentencesPerChunk').value);

        // Validation
        if (!text) {
            this.showError('Please enter text to convert');
            return;
        }

        if (!voiceModelId) {
            this.showError('Please select a voice model');
            return;
        }

        if (text.length > 10000) {
            this.showError('Text is too long (maximum 10,000 characters)');
            return;
        }

        // Show progress
        this.showProgress();
        this.disableForm();

        try {
            const response = await fetch('/api/tts/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text,
                    voiceModelId,
                    format,
                    quality,
                    speed,
                    sentencesPerChunk
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to start TTS generation');
            }

            const result = await response.json();
            this.currentJob = result.jobId;
            
            // Start polling for job progress
            this.startJobPolling();
            
        } catch (error) {
            this.showError(error.message);
            this.hideProgress();
            this.enableForm();
        }
    }

    startJobPolling() {
        if (this.jobPollingInterval) {
            clearInterval(this.jobPollingInterval);
        }

        this.jobPollingInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/jobs/${this.currentJob}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch job status');
                }

                const { job } = await response.json();
                
                if (job.status === 'completed') {
                    this.handleJobComplete(job);
                } else if (job.status === 'failed') {
                    this.handleJobFailed(job);
                } else if (job.status === 'processing') {
                    this.updateProgress(job.progress || 0, 'Processing audio...');
                }
                
            } catch (error) {
                console.error('Job polling error:', error);
            }
        }, 1000);
    }

    handleJobComplete(job) {
        this.stopJobPolling();
        this.hideProgress();
        this.enableForm();
        this.showResults(job);
        this.loadRecentJobs(); // Refresh jobs list
    }

    handleJobFailed(job) {
        this.stopJobPolling();
        this.hideProgress();
        this.enableForm();
        this.showError(job.error || 'Job failed');
        this.loadRecentJobs(); // Refresh jobs list
    }

    stopJobPolling() {
        if (this.jobPollingInterval) {
            clearInterval(this.jobPollingInterval);
            this.jobPollingInterval = null;
        }
    }

    updateProgress(percent, message) {
        document.getElementById('progressBar').style.width = `${percent}%`;
        document.getElementById('progressText').textContent = message;
    }

    showProgress() {
        document.getElementById('progressSection').classList.remove('hidden');
        document.getElementById('resultsSection').classList.add('hidden');
    }

    hideProgress() {
        document.getElementById('progressSection').classList.add('hidden');
    }

    showResults(job) {
        const resultsSection = document.getElementById('resultsSection');
        const resultContent = document.getElementById('resultContent');
        
        if (job.result && job.result.audioFile) {
            resultContent.innerHTML = `
                <div class="flex items-center justify-between p-3 bg-[#0b1020] border border-slate-600 rounded">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
                            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                            </svg>
                        </div>
                        <div>
                            <div class="font-medium text-white">${job.result.audioFile}</div>
                            <div class="text-sm text-slate-400">Audio file generated successfully</div>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <a href="/outputs/${job.result.audioFile}" download class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm transition-colors">
                            Download
                        </a>
                        <button onclick="ttsPage.playAudio('/outputs/${job.result.audioFile}')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors">
                            Play
                        </button>
                    </div>
                </div>
            `;
        } else {
            resultContent.innerHTML = `
                <div class="text-slate-400 text-center py-4">
                    No audio file generated
                </div>
            `;
        }
        
        resultsSection.classList.remove('hidden');
    }

    playAudio(audioUrl) {
        const audio = new Audio(audioUrl);
        audio.play().catch(error => {
            console.error('Failed to play audio:', error);
            this.showError('Failed to play audio');
        });
    }

    showError(message) {
        // Create error notification
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    disableForm() {
        document.getElementById('generateBtn').disabled = true;
        document.getElementById('generateBtn').textContent = 'Generating...';
    }

    enableForm() {
        document.getElementById('generateBtn').disabled = false;
        document.getElementById('generateBtn').textContent = 'Generate Audio';
    }

    async loadRecentJobs() {
        try {
            const response = await fetch('/api/jobs');
            if (!response.ok) {
                throw new Error('Failed to fetch jobs');
            }

            const { jobs } = await response.json();
            this.displayJobs(jobs.filter(job => job.type === 'tts').slice(0, 5));
            
        } catch (error) {
            console.error('Failed to load jobs:', error);
        }
    }

    displayJobs(jobs) {
        const jobsList = document.getElementById('jobsList');
        
        if (jobs.length === 0) {
            jobsList.innerHTML = `
                <div class="text-slate-400 text-center py-4">
                    No TTS jobs yet
                </div>
            `;
            return;
        }

        jobsList.innerHTML = jobs.map(job => `
            <div class="flex items-center justify-between p-3 bg-[#0b1020] border border-slate-600 rounded">
                <div class="flex items-center space-x-3">
                    <div class="w-8 h-8 rounded-full flex items-center justify-center ${
                        job.status === 'completed' ? 'bg-green-600' :
                        job.status === 'failed' ? 'bg-red-600' :
                        job.status === 'processing' ? 'bg-blue-600' :
                        'bg-slate-600'
                    }">
                        <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            ${job.status === 'completed' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>' :
                              job.status === 'failed' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>' :
                              job.status === 'processing' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>' :
                              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>'}
                        </svg>
                    </div>
                    <div>
                        <div class="text-sm font-medium text-white">
                            ${job.status === 'completed' ? 'Audio Generated' :
                              job.status === 'failed' ? 'Generation Failed' :
                              job.status === 'processing' ? 'Processing...' :
                              'Pending'}
                        </div>
                        <div class="text-xs text-slate-400">
                            ${new Date(job.createdAt).toLocaleString()}
                        </div>
                    </div>
                </div>
                <div class="text-xs text-slate-400">
                    ${job.status === 'completed' ? '100%' :
                      job.status === 'failed' ? 'Failed' :
                      job.status === 'processing' ? `${job.progress || 0}%` :
                      'Pending'}
                </div>
            </div>
        `).join('');
    }
}

// Initialize the page
const ttsPage = new TTSPage();
