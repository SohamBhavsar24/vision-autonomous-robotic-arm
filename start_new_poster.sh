#!/bin/bash
# Dedicated Launcher for New Template-Format Standalone A0 Academic Poster
PORT=8057
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/new_poster" && pwd)"

echo "=========================================================="
echo " Starting Standalone A0 Research Poster (Template Format)"
echo " Poster directory: $DIR"
echo " URL: http://localhost:$PORT"
echo " Persistence: Active (IndexedDB + Disk State)"
echo "=========================================================="

# Clean up any existing process on this port
PID=$(lsof -ti :$PORT)
if [ ! -z "$PID" ]; then
    echo "Stopping existing process on port $PORT (PID: $PID)..."
    kill -9 $PID 2>/dev/null
    sleep 1
fi

cd "$DIR"
python3 poster_server.py $PORT
