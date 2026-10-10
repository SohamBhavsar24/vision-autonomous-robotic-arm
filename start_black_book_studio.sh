#!/bin/bash
# Dedicated Launcher for Black Book Web Studio (Overleaf-Style LaTeX Editor)
# Edits directly inside black_book/ with 100% persistent local disk storage.

PORT=8060
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/black_book" && pwd)"

echo "=========================================================="
echo " Starting Black Book Web Studio (Overleaf-Style Editor)"
echo " Project directory : $DIR"
echo " Studio URL        : http://localhost:$PORT"
echo " Persistence       : Active (Direct Disk Writes in black_book/)"
echo " Compiler          : Tectonic (/opt/homebrew/bin/tectonic)"
echo "=========================================================="

# Clean up any existing process on this port
PID=$(lsof -ti :$PORT)
if [ ! -z "$PID" ]; then
    echo "Stopping existing process on port $PORT (PID: $PID)..."
    kill -9 $PID 2>/dev/null
    sleep 1
fi

# Open in default web browser in background
(sleep 1 && open "http://localhost:$PORT") &

cd "$DIR"
python3 studio/server.py $PORT
