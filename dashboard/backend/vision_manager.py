"""
==========================================================================
PERCEPTION & VISION MANAGER (PYTHON - OPENCV 5.0 COMPLIANT)
==========================================================================
Project:  Vision-Based Autonomous Robotic Arm
File:     vision_manager.py
Location: dashboard/backend/

PURPOSE:
  Manages USB/MacBook camera feeds and executes ultra-robust OpenCV
  ArUco marker detection (DICT_4X4_50 / DICT_4X4_100 / DICT_ARUCO_ORIGINAL)
  for Marker ID 0 (Block 1), ID 1 (Block 2), and ID 2 (Target Box).
  Provides continuous MJPEG video stream for Web Dashboard.
==========================================================================
"""

import os
import time
import logging
import cv2
import numpy as np
from typing import Generator, Optional, Dict, Tuple, List

logger = logging.getLogger("VisionManager")
logging.basicConfig(level=logging.INFO)

class VisionManager:
    def __init__(self, camera_index: int = 0):
        self.camera_index = camera_index
        self.cap: Optional[cv2.VideoCapture] = None
        self.is_running = False

        # Build OpenCV 5.0 High-Sensitivity Detector Parameters
        self.params = cv2.aruco.DetectorParameters()
        self.params.adaptiveThreshWinSizeMin = 3
        self.params.adaptiveThreshWinSizeMax = 31
        self.params.adaptiveThreshWinSizeStep = 4
        self.params.minMarkerPerimeterRate = 0.015 # Detects small markers held far away
        self.params.maxMarkerPerimeterRate = 4.0
        self.params.polygonalApproxAccuracyRate = 0.05
        self.params.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_SUBPIX

        # Dictionaries to check
        self.dict_4x4 = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
        self.dict_4x4_100 = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_100)
        self.dict_original = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_ARUCO_ORIGINAL)

        # OpenCV 5.0 ArucoDetector Objects
        self.detector_4x4 = cv2.aruco.ArucoDetector(self.dict_4x4, self.params)
        self.detector_4x4_100 = cv2.aruco.ArucoDetector(self.dict_4x4_100, self.params)
        self.detector_original = cv2.aruco.ArucoDetector(self.dict_original, self.params)

        # Target Marker Labels
        self.marker_labels: Dict[int, str] = {
            0: "Block 1 (ArUco ID: 0)",
            1: "Block 2 (ArUco ID: 1)",
            2: "Target Box (ArUco ID: 2)"
        }

        # Latest detection state
        self.last_detected_ids: List[int] = []
        self.is_camera_connected = False

    def init_camera(self) -> bool:
        """Attempts to open USB camera (Logitech C270 or MacBook FaceTime camera)."""
        if self.cap is not None and self.cap.isOpened():
            return True

        logger.info(f"Opening camera index {self.camera_index}...")
        self.cap = cv2.VideoCapture(self.camera_index)
        
        # Set resolution to 640x480 for fast 30 FPS processing
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.cap.set(cv2.CAP_PROP_FPS, 30)

        if self.cap.isOpened():
            self.is_camera_connected = True
            logger.info(f"Camera index {self.camera_index} opened successfully.")
            return True
        else:
            self.is_camera_connected = False
            logger.warning(f"Failed to open camera index {self.camera_index}.")
            return False

    def detect_and_annotate(self, frame: np.ndarray) -> np.ndarray:
        """Executes multi-scale ArUco detection and draws high-visibility bounding boxes + labels."""
        if frame is None:
            return frame

        # Convert to grayscale for max thresholding contrast
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Run Primary 4x4_50 Detector
        corners, ids, rejected = self.detector_4x4.detectMarkers(gray)

        # Fallback to 4x4_100 if empty
        if ids is None or len(ids) == 0:
            corners, ids, rejected = self.detector_4x4_100.detectMarkers(gray)

        # Fallback to ORIGINAL dictionary if empty
        if ids is None or len(ids) == 0:
            corners, ids, rejected = self.detector_original.detectMarkers(gray)

        self.last_detected_ids = []

        if ids is not None and len(ids) > 0:
            ids_flat = ids.flatten()
            self.last_detected_ids = [int(x) for x in ids_flat]

            for i, marker_id in enumerate(ids_flat):
                marker_corners = corners[i][0] # 4 corner points
                pts = marker_corners.astype(np.int32)

                # Draw thick bright neon green bounding polygon around ArUco tag
                cv2.polylines(frame, [pts], isClosed=True, color=(0, 255, 102), thickness=3)

                # Corner dot markers (Corner 0 = Red, Others = Yellow)
                cv2.circle(frame, tuple(pts[0]), 6, (0, 0, 255), -1) # Top-Left orientation dot
                for pt in pts[1:]:
                    cv2.circle(frame, tuple(pt), 4, (0, 255, 255), -1)

                # Center crosshair point
                center_x = int(np.mean(pts[:, 0]))
                center_y = int(np.mean(pts[:, 1]))
                cv2.circle(frame, (center_x, center_y), 5, (255, 153, 0), -1)

                # Label string
                label_text = self.marker_labels.get(int(marker_id), f"ArUco ID: {marker_id}")

                # Position banner above marker
                top_y = min(pts[:, 1]) - 12
                top_x = min(pts[:, 0])

                # Draw filled dark background container for label text readability
                (w, h), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                bg_x1 = max(0, top_x - 4)
                bg_y1 = max(0, top_y - h - 10)
                bg_x2 = min(frame.shape[1], top_x + w + 8)
                bg_y2 = max(0, top_y + 4)
                cv2.rectangle(frame, (bg_x1, bg_y1), (bg_x2, bg_y2), (20, 18, 17), -1)

                # Draw crisp neon green label text
                cv2.putText(
                    frame, label_text, (max(0, top_x), max(18, top_y)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 102), 2, cv2.LINE_AA
                )

            # Top-Left Live On-Screen Telemetry HUD Overlay
            status_str = f"ArUco Status: DETECTED (IDs: {self.last_detected_ids})"
            cv2.rectangle(frame, (10, 10), (380, 42), (20, 18, 17), -1)
            cv2.putText(frame, status_str, (20, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 102), 2, cv2.LINE_AA)
        else:
            # Top-Left HUD Overlay when searching
            cv2.rectangle(frame, (10, 10), (360, 42), (20, 18, 17), -1)
            cv2.putText(frame, "ArUco Status: Searching for Tag...", (20, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 165, 255), 1, cv2.LINE_AA)

        return frame

    def generate_mjpeg_stream(self) -> Generator[bytes, None, None]:
        """Generator function producing continuous MJPEG byte stream for FastAPI."""
        if not self.init_camera():
            # If physical camera is not connected, generate standing-by video stream
            while True:
                blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
                blank_frame[:] = (36, 38, 42) # BGR for #2A2624

                # Grid background
                for x in range(0, 640, 40):
                    cv2.line(blank_frame, (x, 0), (x, 480), (45, 48, 52), 1)
                for y in range(0, 480, 40):
                    cv2.line(blank_frame, (0, y), (640, y), (45, 48, 52), 1)

                cv2.putText(blank_frame, "Camera 1 (Workspace View)", (140, 220),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (242, 247, 250), 2, cv2.LINE_AA)
                cv2.putText(blank_frame, "Camera standing by... Plug USB camera or allow webcam access", (60, 260),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (74, 120, 196), 1, cv2.LINE_AA)

                ret, jpeg = cv2.imencode('.jpg', blank_frame)
                if ret:
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
                time.sleep(0.1)

        while True:
            success, frame = self.cap.read()
            if not success:
                logger.warning("Camera read frame failed. Re-initializing...")
                self.cap.release()
                time.sleep(0.5)
                self.init_camera()
                continue

            # Run real-time ArUco detection & annotation
            annotated_frame = self.detect_and_annotate(frame)

            # Compress to JPG
            ret, jpeg = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if not ret:
                continue

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')

            # ~30 FPS stream delay
            time.sleep(0.033)


# Global singleton instance
vision_manager_cam1 = VisionManager(camera_index=0)
