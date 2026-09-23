#!/bin/bash
# Dedicated Launcher for Standalone A0 Research Poster
PORT=8055
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/poster" && pwd)"

echo "Starting Standalone A0 Research Poster Server on port $PORT..."
echo "Poster directory: $DIR"
echo "URL: http://localhost:$PORT"

# Clean up any existing process on this port
PID=$(lsof -ti :$PORT)
if [ ! -z "$PID" ]; then
    kill -9 $PID 2>/dev/null
    sleep 1
fi

python3 -m http.server $PORT --bind 0.0.0.0 --directory "$DIR"
