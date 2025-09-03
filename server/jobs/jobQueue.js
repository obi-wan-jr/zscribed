import fs from 'fs';
import path from 'path';

export class JobQueue {
    constructor(outputsDir) {
        this.outputDir = outputsDir;
        this.jobs = new Map();
        this.maxConcurrentJobs = 3;
        this.runningJobs = 0;
        this.jobQueueFile = path.join(outputsDir, '..', 'job-queue.json');
        this.loadJobs();
    }

    addJob(job) {
        this.jobs.set(job.id, job);
        this.saveJobs();
        this.processNextJob();
    }

    getJob(jobId) {
        return this.jobs.get(jobId);
    }

    getJobs() {
        return Array.from(this.jobs.values()).sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );
    }

    updateJob(jobId, updates) {
        const job = this.jobs.get(jobId);
        if (job) {
            Object.assign(job, updates);
            job.updatedAt = new Date().toISOString();
            this.saveJobs();
            
            if (updates.status === 'completed' || updates.status === 'failed') {
                this.runningJobs--;
                this.processNextJob();
            }
        }
    }

    removeJob(jobId) {
        const job = this.jobs.get(jobId);
        if (job) {
            if (job.status === 'processing') {
                this.runningJobs--;
            }
            this.jobs.delete(jobId);
            this.saveJobs();
            this.processNextJob();
            return true;
        }
        return false;
    }

    processNextJob() {
        if (this.runningJobs >= this.maxConcurrentJobs) {
            return; // Already at max capacity
        }

        // Find next pending job
        const pendingJob = Array.from(this.jobs.values())
            .find(job => job.status === 'pending');

        if (pendingJob) {
            this.runningJobs++;
            pendingJob.status = 'processing';
            pendingJob.startedAt = new Date().toISOString();
            this.saveJobs();
        }
    }

    loadJobs() {
        try {
            if (fs.existsSync(this.jobQueueFile)) {
                const data = fs.readFileSync(this.jobQueueFile, 'utf8');
                const jobsData = JSON.parse(data);
                
                // Reconstruct Map from array
                this.jobs = new Map();
                jobsData.forEach(job => {
                    this.jobs.set(job.id, job);
                    if (job.status === 'processing') {
                        // Reset stuck jobs to pending
                        job.status = 'pending';
                        delete job.startedAt;
                    }
                });
                
                // Count running jobs
                this.runningJobs = Array.from(this.jobs.values())
                    .filter(job => job.status === 'processing').length;
                
                console.log(`[JobQueue] Loaded ${this.jobs.size} jobs, ${this.runningJobs} running`);
            }
        } catch (error) {
            console.error('[JobQueue] Error loading jobs:', error);
        }
    }

    saveJobs() {
        try {
            const jobsArray = Array.from(this.jobs.values());
            fs.writeFileSync(this.jobQueueFile, JSON.stringify(jobsArray, null, 2));
        } catch (error) {
            console.error('[JobQueue] Error saving jobs:', error);
        }
    }

    cleanup() {
        // Remove completed jobs older than 24 hours
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
        let cleaned = 0;
        
        for (const [jobId, job] of this.jobs.entries()) {
            if (job.status === 'completed' && new Date(job.updatedAt) < cutoff) {
                this.jobs.delete(jobId);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`[JobQueue] Cleaned up ${cleaned} old completed jobs`);
            this.saveJobs();
        }
    }

    getStats() {
        const total = this.jobs.size;
        const pending = Array.from(this.jobs.values()).filter(j => j.status === 'pending').length;
        const processing = this.runningJobs;
        const completed = Array.from(this.jobs.values()).filter(j => j.status === 'completed').length;
        const failed = Array.from(this.jobs.values()).filter(j => j.status === 'failed').length;

        return {
            total,
            pending,
            processing,
            completed,
            failed,
            maxConcurrent: this.maxConcurrentJobs
        };
    }
}
