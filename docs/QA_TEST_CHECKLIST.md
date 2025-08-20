# QA Test Checklist (Pi Server)

Target URL: http://<pi-host-or-ip>:3005

## 1) Health and UI
- Open `/api/health` returns `{ ok: true }`.
- App loads in browser with midnight theme and nav.

## 2) Voice Models (global)
- Add a model in UI: enter `test-model-1` + name → Add → appears in list and TTS dropdown.
- Remove the model → disappears from list and dropdown.

## 3) Preferences (per user)
- Select user `Inggo`, set TTS model, format, sentences/chunk → Save Preferences.
- Refresh page → settings persist.
- Switch to `Gelo`, set different defaults, Save → Refresh → persists independently.

## 4) TTS (dummy)
- On TTS page, enter 2–4 sentences.
- Set sentences/chunk to 1, pick a model, click Convert to Audio.
- Observe progress messages under TTS.
- After completion, file appears in Outputs; link is downloadable.

## 5) Bible fetch (dummy)
- Translation WEB, Book `John`, Chapter `3`, Verses `3-5,7`.
- Check Exclude verse numbers and footnotes.
- Click Fetch Text → content shows without numbers/footnotes.
- Uncheck toggles, Fetch again → numbers/footnotes reappear (if present).

## 6) Bible TTS (dummy)
- With the above selection, click Create Audio.
- Observe progress; Outputs shows the stitched file when done.

## 7) Outputs management
- Rename an output; verify link updates and remains valid.
- Delete the output; verify it disappears.

## 8) Queue behavior
- Trigger 2–3 TTS jobs quickly.
- Queue status shows pending/processing.
- Jobs complete sequentially and all appear in Outputs.

## 9) Logs and retention (spot check)
- On filesystem (`storage/logs/<user>/...`), confirm job_start/job_complete entries written.
- Ensure logs are JSONL files; retention is set to prune after ~30 days.

Notes
- Current TTS/Bible pipelines are dummy; files are `.txt` placeholders.
- Real Fish.audio integration and ffmpeg stitching planned next.
