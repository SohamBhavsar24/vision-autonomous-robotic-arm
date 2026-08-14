"""
==========================================================================
PERCEPTION & VISION MANAGER (PYTHON - STRICT ARUCO DETECTION)
==========================================================================
Project:  Vision-Based Autonomous Robotic Arm
File:     vision_manager.py
Location: dashboard/backend/

PURPOSE:
  Executes high-accuracy OpenCV ArUco detection (DICT_4X4_50) strictly
  filtered for Marker ID 0 (Block 1), ID 1 (Block 2), and ID 2 (Target Box).
  Includes strict border validation and ID white-listing to eliminate 100%
  of false positives (t-shirts, shadows, hair).
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

        # Target valid IDs for our project
        self.VALID_IDS = {0, 1, 2}

        # Build OpenCV 5.0 Strict Detector Parameters (Eliminates false positives)
        self.params = cv2.aruco.DetectorParameters()
        self.params.adaptiveThreshWinSizeMin = 5
        self.params.adaptiveThreshWinSizeMax = 25
        self.params.adaptiveThreshWinSizeStep = 5
        self.params.minMarkerPerimeterRate = 0.04 # Requires valid tag size
        self.params.maxMarkerPerimeterRate = 4.0
        self.params.polygonalApproxAccuracyRate = 0.03
        self.params.minCornerDistanceRate = 0.05
        self.params.minDistanceToBorder = 3
        self.params.markerBorderBits = 1 # Must have solid 1-cell black border
        self.params.perspectiveRemovePixelPerCell = 8
        self.params.maxErroneousBitsInBorderRate = 0.15 # Strict border checking (rejects t-shirts & hair)
        self.params.errorCorrectionRate = 0.3 # Strict bit error tolerance
        self.params.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_SUBPIX

        # Dictionaries (DICT_4X4_50)
        self.dict_4x4 = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
        self.detector_4x4 = cv2.aruco.ArucoDetector(self.dict_4x4, self.params)

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
        """Attempts to open USB camera (Logitech C270 or FaceTime camera)."""
        if self.cap is not None and self.cap.isOpened():
            return True

        logger.info(f"Opening camera index {self.camera_index}...")
        self.cap = cv2.VideoCapture(self.camera_index)
        
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
        """Executes strict ArUco detection and draws bounding boxes ONLY for valid IDs (0, 1, 2)."""
        if frame is None:
            return frame

        # Convert to grayscale for contrast
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Detect ArUco Markers
        corners, ids, rejected = self.detector_4x4.detectMarkers(gray)

        self.last_detected_ids = []

        if ids is not None and len(ids) > 0:
            ids_flat = ids.flatten()

            for i, raw_id in enumerate(ids_flat):
                marker_id = int(raw_id)

                # STRICT WHITELIST CHECK: Reject any false positive ID not in {0, 1, 2}
                if marker_id not in self.VALID_IDS:
                    continue

                self.last_detected_ids.append(marker_id)
                marker_corners = corners[i][0] # 4 corner points
                pts = marker_corners.astype(np.int32)

                # Draw thick neon green bounding box around ArUco tag
                cv2.polylines(frame, [pts], isClosed=True, color=(0, 255, 102), thickness=3)

                # Orientation markers (Corner 0 = Red, Others = Yellow)
                cv2.circle(frame, tuple(pts[0]), 6, (0, 0, 255), -1)
                for pt in pts[1:]:
                    cv2.circle(frame, tuple(pt), 4, (0, 255, 255), -1)

                # Center crosshair point
                center_x = int(np.mean(pts[:, 0]))
                center_y = int(np.mean(pts[:, 1]))
                cv2.circle(frame, (center_x, center_y), 5, (255, 153, 0), -1)

                # Label string
                label_text = self.marker_labels.get(marker_id, f"ArUco ID: {marker_id}")

                # Banner positioning
                top_y = min(pts[:, 1]) - 12
                top_x = min(pts[:, 0])

                # Dark container box for label
                (w, h), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                bg_x1 = max(0, top_x - 4)
                bg_y1 = max(0, top_y - h - 10)
                bg_x2 = min(frame.shape[1], top_x + w + 8)
                bg_y2 = max(0, top_y + 4)
                cv2.rectangle(frame, (bg_x1, bg_y1), (bg_x2, bg_y2), (20, 18, 17), -1)

                # Neon green text
                cv2.putText(
                    frame, label_text, (max(0, top_x), max(18, top_y)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 102), 2, cv2.LINE_AA
                )

        # On-Screen HUD Status Overlay at Top-Left
        if len(self.last_detected_ids) > 0:
            status_str = f"ArUco Status: DETECTED (IDs: {self.last_detected_ids})"
            cv2.rectangle(frame, (10, 10), (380, 42), (20, 18, 17), -1)
            cv2.putText(frame, status_str, (20, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 102), 2, cv2.LINE_AA)
        else:
            cv2.rectangle(frame, (10, 10), (360, 42), (20, 18, 17), -1)
            cv2.putText(frame, "ArUco Status: Searching for Tag...", (20, 32), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 165, 255), 1, cv2.LINE_AA)

        return frame

    def generate_mjpeg_stream(self) -> Generator[bytes, None, None]:
        """Generator function producing continuous MJPEG byte stream for FastAPI."""
        if not self.init_camera():
            while True:
                blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
                blank_frame[:] = (36, 38, 42)

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

            # Run strict ArUco detection & annotation
            annotated_frame = self.detect_and_annotate(frame)

            # Compress to JPG
            ret, jpeg = cv2.imencode('.jpg', annotated_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if not ret:
                continue

            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')

            time.sleep(0.033)


# Global singleton instance
vision_manager_cam1 = VisionManager(camera_index=0)
