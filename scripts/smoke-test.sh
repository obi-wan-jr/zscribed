#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:3005"

echo "[smoke] Health"
curl -sf "$BASE_URL/api/health" || { echo "health failed"; exit 1; }

echo "[smoke] Config meta"
curl -sf "$BASE_URL/api/config/meta" >/dev/null || { echo "meta failed"; exit 1; }

echo "[smoke] Queue status"
curl -sf "$BASE_URL/api/queue/status" >/dev/null || { echo "queue failed"; exit 1; }

echo "[smoke] Bible fetch (dummy)"
curl -sf -X POST "$BASE_URL/api/bible/fetch" -H 'Content-Type: application/json' -d '{"translation":"WEB","book":"John","chapter":3,"verseRanges":"3-5,7","excludeNumbers":true,"excludeFootnotes":true}' >/dev/null || { echo "bible fetch failed"; exit 1; }

echo "[smoke] Start TTS job (dummy)"
JOB_ID=$(curl -sf -X POST "$BASE_URL/api/jobs/tts" -H 'Content-Type: application/json' -d '{"user":"Smoke","text":"Hello world. This is a test.","voiceModelId":"default","format":"mp3","sentencesPerChunk":1}' | jq -r .id)
[ -n "$JOB_ID" ] || { echo "no job id"; exit 1; }

echo "[smoke] Wait briefly, list outputs"
sleep 2
curl -sf "$BASE_URL/api/outputs" >/dev/null || { echo "outputs failed"; exit 1; }

echo "[smoke] Done"
