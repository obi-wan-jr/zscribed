#!/usr/bin/env bash
set -euo pipefail

# Clean up orphaned audio segment files
# This script removes temporary audio chunk files that may have been left behind

STORAGE_DIR="storage"
OUTPUTS_DIR="$STORAGE_DIR/outputs"

echo "[cleanup] Looking for orphaned audio segment files..."

if [ -d "$OUTPUTS_DIR" ]; then
	cd "$OUTPUTS_DIR"
	
	# Updated pattern to match new naming: user-tts-shortid-XXX.mp3
	segment_files=$(find . -name "*-tts-*-[0-9][0-9][0-9].mp3" -type f 2>/dev/null || true)
	
	if [ -n "$segment_files" ]; then
		echo "[cleanup] Found segment files:"
		echo "$segment_files" | while read -r file; do
			echo "  $file"
		done
		
		# Extract job IDs from the new naming pattern
		# Pattern: user-tts-shortid-XXX.mp3 -> extract shortid
		job_ids=$(echo "$segment_files" | sed 's/.*-tts-\([^-]*\)-[0-9][0-9][0-9]\.mp3$/\1/' | sort -u)
		
		echo "[cleanup] Job IDs found: $job_ids"
		
		for job_id in $job_ids; do
			# Look for complete files with the new pattern: user-tts-shortid-YYYY-MM-DD.mp3
			complete_file=$(find . -name "*-tts-${job_id}-*.mp3" -not -name "*-[0-9][0-9][0-9].mp3" -type f 2>/dev/null | head -1)
			
			if [ -n "$complete_file" ] && [ -f "$complete_file" ]; then
				echo "[cleanup] Job $job_id has complete file ($complete_file), cleaning up segments..."
				rm -f "./*-tts-${job_id}-[0-9][0-9][0-9].mp3"
				echo "[cleanup] Cleaned up segments for job $job_id"
			else
				echo "[cleanup] Job $job_id has no complete file, keeping segments for debugging"
			fi
		done
	else
		echo "[cleanup] No segment files found"
	fi
	
	# Clean up filelist files (old pattern)
	filelist_files=$(find . -name "*-filelist.txt" -type f 2>/dev/null || true)
	if [ -n "$filelist_files" ]; then
		echo "[cleanup] Cleaning up filelist files:"
		echo "$filelist_files" | while read -r file; do
			echo "  Removing $file"
			rm -f "$file"
		done
	fi
	
	cd - > /dev/null
else
	echo "[cleanup] Outputs directory not found: $OUTPUTS_DIR"
fi

echo "[cleanup] Segment cleanup completed"
