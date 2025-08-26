# Project Brief

Title: Bible Text-to-Speech & Video Web Application

Purpose: Build a lightweight, Raspberry Pi–hosted web app that generates high-quality audio (and optionally video) from arbitrary text and Bible content using Fish.audio custom voice models. The system should be responsive, dark-themed, modular, and optimized for Pi hardware.

Primary Outcomes:
- Pure TTS page for arbitrary text inputs
- Bible transcription page with translation/book/chapter/verse-range selection, segmentation, and batch processing
- Output management (preview, download, rename, delete)
- Basic per-user job logging (Inggo, Gelo, JM, Irish)
- Queue-driven processing with real-time progress

Key Constraints:
- Vanilla JavaScript + TailwindCSS (no heavy frameworks)
- Hosted on Raspberry Pi, port 3005, managed by PM2
- No local dev/test required; deploy to test Pi for verification
- Secure handling of Fish.audio API key and model IDs via config.json (masked in UI)

Non-Goals (for v1):
- Full authentication/authorization
- Complex multi-tenant access controls
- Rich captioning/synchronization (planned for future)

Success Metrics:
- Stable operation on Raspberry Pi with responsive UI
- End-to-end generation from text/Bible selection to saved output
- Clear progress feedback, orderly queue execution, and recoverable logs

