"""
==========================================================================
PERCEPTION & VISION MANAGER (PYTHON)
==========================================================================
Project:  Vision-Based Autonomous Robotic Arm
File:     vision_manager.py
Location: dashboard/backend/

PURPOSE:
  Manages USB camera feeds (Logitech C270) and executes real-time OpenCV
  ArUco marker detection (DICT_4X4_50) for Marker ID 0 (Block 1), ID 1 (Block 2),
  and ID 2 (Target Box). Provides continuous MJPEG video stream for Web Dashboard.
==========================================================================
"""

import os
import time
import logging
import cv2
import numpy as np
from typing import Generator, Optional, Dict, Tuple

logger = logging.getLogger("VisionManager")
logging.basicConfig(level=logging.INFO)

class VisionManager:
    def __init__(self, camera_index: int = 0):
        self.camera_index = camera_index
        self.cap: Optional[cv2.VideoCapture] = None
        self.is_running = False

        # Load ArUco Dictionary (DICT_4X4_50)
        self.aruco_dict = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
        
        # Detector Parameters & OpenCV 5.0 / 4.7+ Detector Object
        self.detector_params = cv2.aruco.DetectorParameters()
        try:
            self.detector = cv2.aruco.ArucoDetector(self.aruco_dict, self.detector_params)
            self.use_new_detector = True
        except AttributeError:
            self.detector = None
            self.use_new_detector = False

        # Target Marker Labels
        self.marker_labels: Dict[int, str] = {
            0: "Block 1 (ArUco ID: 0)",
            1: "Block 2 (ArUco ID: 1)",
            2: "Target Box (ArUco ID: 2)"
        }

        # Latest detection state
        self.last_detected_ids = []
        self.is_camera_connected = False

    def init_camera(self) -> bool:
        """Attempts to open USB camera (Logitech C270 or onboard webcam)."""
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
        """Executes real-time ArUco detection and draws bounding boxes + labels on frame."""
        if frame is None:
            return frame

        # Detect ArUco Markers
        if self.use_new_detector and self.detector is not None:
            corners, ids, rejected = self.detector.detectMarkers(frame)
        else:
            corners, ids, rejected = cv2.aruco.detectMarkers(frame, self.aruco_dict, parameters=self.detector_params)

        self.last_detected_ids = []
        if ids is not None and len(ids) > 0:
            ids_flat = ids.flatten()
            self.last_detected_ids = ids_flat.tolist()

            for i, marker_id in enumerate(ids_flat):
                marker_corners = corners[i][0] # 4 corner points
                
                # Reshape corner points to int32
                pts = marker_corners.astype(np.int32)
                
                # Draw thick green bounding box around ArUco tag
                cv2.polylines(frame, [pts], isClosed=True, color=(0, 230, 77), thickness=3)

                # Corner dot markers (Top-Left = Red, others = Green)
                cv2.circle(frame, tuple(pts[0]), 5, (0, 0, 255), -1) # Top-Left
                for pt in pts[1:]:
                    cv2.circle(frame, tuple(pt), 4, (0, 255, 0), -1)

                # Calculate center point
                center_x = int(np.mean(pts[:, 0]))
                center_y = int(np.mean(pts[:, 1]))
                cv2.circle(frame, (center_x, center_y), 5, (255, 128, 0), -1)

                # Get label text
                label = self.marker_labels.get(int(marker_id), f"ArUco ID: {marker_id}")

                # Top banner positioning
                top_y = min(pts[:, 1]) - 12
                top_x = min(pts[:, 0])

                # Draw filled dark background banner for clean label text readability
                text_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
                bg_pt1 = (max(0, top_x - 4), max(0, top_y - text_size[1] - 8))
                bg_pt2 = (min(frame.shape[1], top_x + text_size[0] + 8), max(0, top_y + 4))
                cv2.rectangle(frame, bg_pt1, bg_pt2, (30, 25, 24), -1)

                # Draw crisp label text
                cv2.putText(
                    frame, label, (max(0, top_x), max(16, top_y)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 230, 77), 2, cv2.LINE_AA
                )

        return frame

    def generate_mjpeg_stream(self) -> Generator[bytes, None, None]:
        """Generator function producing continuous MJPEG byte stream for FastAPI."""
        if not self.init_camera():
            # If physical camera is not connected, generate high-tech standing-by video stream
            while True:
                blank_frame = np.zeros((480, 640, 3), dtype=np.uint8)
                # Fill background with dark warm theme
                blank_frame[:] = (36, 38, 42) # BGR for #2A2624

                # Draw grid lines
                for x in range(0, 640, 40):
                    cv2.line(blank_frame, (x, 0), (x, 480), (45, 48, 52), 1)
                for y in range(0, 480, 40):
                    cv2.line(blank_frame, (0, y), (640, y), (45, 48, 52), 1)

                # Center placeholder text
                cv2.putText(blank_frame, "Camera 1 (Logitech C270 Workspace View)", (80, 220),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (242, 247, 250), 2, cv2.LINE_AA)
                cv2.putText(blank_frame, "Camera standing by... Plug USB camera to view live feed", (70, 260),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (74, 120, 196), 1, cv2.LINE_AA)

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
