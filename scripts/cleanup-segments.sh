#!/usr/bin/env bash
set -euo pipefail

# Clean up orphaned audio segment files
# This script removes temporary audio chunk files that may have been left behind

STORAGE_DIR="storage"
OUTPUTS_DIR="$STORAGE_DIR/outputs"

echo "[cleanup] Looking for orphaned audio segment files..."

# Find all files that match the pattern: jobId-XXX.mp3 (segment files)
# but don't have corresponding complete files
if [ -d "$OUTPUTS_DIR" ]; then
    cd "$OUTPUTS_DIR"
    
    # Find all segment files (pattern: *-XXX.mp3 where XXX is 3 digits)
    segment_files=$(find . -name "*-[0-9][0-9][0-9].mp3" -type f 2>/dev/null || true)
    
    if [ -n "$segment_files" ]; then
        echo "[cleanup] Found segment files:"
        echo "$segment_files" | while read -r file; do
            echo "  $file"
        done
        
        # Extract job IDs from segment files
        job_ids=$(echo "$segment_files" | sed 's/.*\///' | sed 's/-[0-9][0-9][0-9]\.mp3$//' | sort -u)
        
        echo "[cleanup] Job IDs found: $job_ids"
        
        # Check which job IDs have complete files
        for job_id in $job_ids; do
            complete_file="./${job_id}-complete.mp3"
            if [ -f "$complete_file" ]; then
                echo "[cleanup] Job $job_id has complete file, cleaning up segments..."
                # Remove all segment files for this job
                rm -f "./${job_id}-[0-9][0-9][0-9].mp3"
                echo "[cleanup] Cleaned up segments for job $job_id"
            else
                echo "[cleanup] Job $job_id has no complete file, keeping segments for debugging"
            fi
        done
    else
        echo "[cleanup] No segment files found"
    fi
    
    # Also clean up any filelist.txt files that might be left behind
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
