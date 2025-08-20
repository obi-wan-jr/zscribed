#!/usr/bin/env bash
set -euo pipefail

# Clean up orphaned audio segment files
# This script removes temporary audio chunk files that may have been left behind

STORAGE_DIR="storage"
OUTPUTS_DIR="$STORAGE_DIR/outputs"

echo "[cleanup] Looking for orphaned audio segment files..."

if [ -d "$OUTPUTS_DIR" ]; then
	cd "$OUTPUTS_DIR"
	
	# Updated pattern to match new naming: user-voicemodel-time-index.mp3
	# Pattern: *-*-*-[0-9].mp3 (where the last part is a single digit index)
	segment_files=$(find . -name "*-*-*-[0-9].mp3" -type f 2>/dev/null || true)
	
	if [ -n "$segment_files" ]; then
		echo "[cleanup] Found segment files:"
		echo "$segment_files" | while read -r file; do
			echo "  $file"
		done
		
		# Extract the base pattern from segment files
		# Pattern: user-voicemodel-time-index.mp3 -> extract user-voicemodel-time
		base_patterns=$(echo "$segment_files" | sed 's/-[0-9]\.mp3$//' | sort -u)
		
		echo "[cleanup] Base patterns found: $base_patterns"
		
		for base_pattern in $base_patterns; do
			# Look for complete files with the new pattern: user-voicemodel-time-date.mp3
			# Pattern: user-voicemodel-time-YYYY-MM-DD.mp3
			complete_file=$(find . -name "${base_pattern}-[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9].mp3" -type f 2>/dev/null | head -1)
			
			if [ -n "$complete_file" ] && [ -f "$complete_file" ]; then
				echo "[cleanup] Pattern $base_pattern has complete file ($complete_file), cleaning up segments..."
				rm -f "./${base_pattern}-[0-9].mp3"
				echo "[cleanup] Cleaned up segments for pattern $base_pattern"
			else
				echo "[cleanup] Pattern $base_pattern has no complete file, keeping segments for debugging"
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
