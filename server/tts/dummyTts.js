import fs from 'fs';
import path from 'path';

export async function synthesizeChunkToFile({ chunkText, voiceModelId, format = 'mp3', outputsDir, jobId, index }) {
	// Dummy: write text to a file to simulate an audio segment
	const filename = `${jobId}-${String(index).padStart(3, '0')}.${format}.txt`;
	const filepath = path.join(outputsDir, filename);
	fs.writeFileSync(filepath, `VOICE:${voiceModelId}\n${chunkText}`);
	return filepath;
}

export async function stitchSegments({ segmentFiles, outputsDir, jobId, format = 'mp3' }) {
	// Dummy: concatenate text files to simulate stitching
	const out = path.join(outputsDir, `${jobId}-stitched.${format}.txt`);
	const content = segmentFiles.map(f => fs.readFileSync(f, 'utf-8')).join('\n---\n');
	fs.writeFileSync(out, content);
	return out;
}
