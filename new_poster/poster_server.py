#!/usr/bin/env python3
"""
High-Performance Standalone Poster Server with Disk Persistence
Serves the A0 Research Poster and persists all layout customizations,
card sizes, alignments, text edits, and uploaded photos to disk.
"""

import os
import sys
import json
import base64
import time
import mimetypes
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
STATE_FILE = os.path.join(BASE_DIR, "poster_saved_state.json")
DEFAULT_PORT = 8057

os.makedirs(UPLOADS_DIR, exist_ok=True)


class PosterHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def end_headers(self):
        # Enable CORS and disable aggressive caching for API
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/load":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            if os.path.exists(STATE_FILE):
                try:
                    with open(STATE_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    data["exists"] = True
                    self.wfile.write(json.dumps(data).encode("utf-8"))
                    return
                except Exception as e:
                    self.wfile.write(json.dumps({"exists": False, "error": str(e)}).encode("utf-8"))
                    return
            else:
                self.wfile.write(json.dumps({"exists": False}).encode("utf-8"))
                return
        
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        content_length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(content_length)

        if parsed.path == "/api/save":
            try:
                payload = json.loads(raw_body.decode("utf-8"))
                
                # Check for base64 images inside photoSlots and write to disk
                photo_slots = payload.get("photoSlots", {})
                for slot_id, slot_data in photo_slots.items():
                    src = slot_data.get("src", "")
                    if src and src.startswith("data:image/"):
                        # Extract mime and data
                        try:
                            header, b64_data = src.split(",", 1)
                            ext = "png"
                            if "jpeg" in header or "jpg" in header:
                                ext = "jpg"
                            elif "webp" in header:
                                ext = "webp"
                            elif "svg" in header:
                                ext = "svg"
                            
                            safe_slot = slot_id.replace("/", "_").replace("\\", "_")
                            filename = f"upload_{safe_slot}_{int(time.time())}.{ext}"
                            filepath = os.path.join(UPLOADS_DIR, filename)
                            with open(filepath, "wb") as f_img:
                                f_img.write(base64.b64decode(b64_data))
                            
                            # Replace data URL with saved relative URL to keep state file compact
                            slot_data["src"] = f"/uploads/{filename}"
                        except Exception as img_err:
                            print(f"[PosterServer] Warning extracting image for slot {slot_id}: {img_err}")
                
                payload["saved_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
                with open(STATE_FILE, "w", encoding="utf-8") as f:
                    json.dump(payload, f, indent=2, ensure_ascii=False)
                
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                response = {
                    "success": True,
                    "saved_at": payload["saved_at"],
                    "photoSlots": payload.get("photoSlots", {})
                }
                self.wfile.write(json.dumps(response).encode("utf-8"))
                print(f"[PosterServer] Saved poster state to {STATE_FILE} at {payload['saved_at']}")
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        elif parsed.path == "/api/reset":
            try:
                if os.path.exists(STATE_FILE):
                    os.remove(STATE_FILE)
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "message": "State reset"}).encode("utf-8"))
                print(f"[PosterServer] Reset poster state on user request.")
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()


def run_server(port=DEFAULT_PORT):
    server_address = ("0.0.0.0", port)
    httpd = HTTPServer(server_address, PosterHandler)
    print("=" * 60)
    print(f" Academic A0 Poster Server (Template Format) Running")
    print(f" Port: {port}")
    print(f" Serving: {BASE_DIR}")
    print(f" URL: http://localhost:{port}")
    print(f" Persistence: Active (Writes to {STATE_FILE})")
    print("=" * 60)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[PosterServer] Shutting down cleanly.")
        httpd.server_close()


if __name__ == "__main__":
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    run_server(port)
