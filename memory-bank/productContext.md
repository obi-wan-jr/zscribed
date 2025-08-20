# Product Context

Problem: Creating high-quality Bible chapter audio (and optionally video) requires manual text cleanup (removing verse numbers/footnotes), segmentation for fluid TTS, and stitching into a single output. Existing tools are heavyweight or lack batch/queue management.

Audience: Single-user, small team (Inggo, Gelo, JM) producing Bible audio/video content. No public multi-user access needed.

Experience Goals:
- Midnight dark theme with high-contrast, accessible UI
- Two focused workflows: Pure TTS and Bible Transcription
- Clear progress indicators for individual jobs and batches
- Easy management of outputs with preview/download/rename/delete

Core Use Cases:
1) Arbitrary text → audio file using selected Fish.audio voice model
2) Bible passages → segmented TTS → stitched audio; optional video with static background
3) Batch processing of multiple chapters, with queue and server-side logs

Value:
- Dramatically reduces time to produce consistent Bible audio outputs
- Leverages custom voice models for brand consistency
- Operates reliably on Raspberry Pi hardware
