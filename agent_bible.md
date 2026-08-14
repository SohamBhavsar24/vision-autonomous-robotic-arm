# Agent Bible — Project Context & Continuity

> **Purpose:** This file ensures Antigravity never loses project context across sessions.
> **Rule:** This file MUST be updated after every significant conversation or decision.
> **Last Updated:** 2026-08-14 (Session 9 Complete — Physical 6-DOF Arm Assembly Complete, Gripper Calibrated 85°–140°, Pick-and-Place Execution Verified, Live OpenCV ArUco Vision Pipeline Operational, Manus AI Presentation Deck Prompt Prepared)

---

## 1. Project Identity

- **Project:** Vision-Based Autonomous Pick-and-Place Robotic Arm Using Imitation Learning
- **Owner:** Soham Bhavsar
- **Team Members:** Soham Bhavsar, Divyansh Dewangan, Toshal Kumbhar
- **Type:** College Capstone Project (6-month timeline)
- **Workspace Path:** `/Users/sohambhavsar/Desktop/Autonomoous arm`
- **GitHub Repository:** `https://github.com/SohamBhavsar24/vision-autonomous-robotic-arm.git`

---

## 2. Current Project Status

### Overall Phase: READY FOR HARDWARE WIRING & PHYSICAL ASSEMBLY (SESSION 7)
- **PCA9685 & Arduino Uno Wiring Protocol:** 
  - Arduino VCC $\to$ PCA9685 VCC (5V logic power)
  - Arduino GND $\to$ PCA9685 GND
  - Arduino A4 $\to$ PCA9685 SDA (I2C data)
  - Arduino A5 $\to$ PCA9685 SCL (I2C clock)
  - PCA9685 Screw Terminals $\to$ External 5V/6V High-Current Servo Power Supply (DO NOT power servos from Arduino 5V pin!)
  - Channels 0–5 $\to$ Servos 1–6 (0: Base, 1: Shoulder, 2: Elbow, 3: Wrist Pitch, 4: Wrist Roll, 5: Gripper)
- **Web Dashboard:** Fully operational (`http://localhost:8050`). Features 6-servo sliders, Lock All at 90°, Solo Test buttons, Emergency Stop, Serial auto-connect, 3D Digital Twin URDF viewport, Supabase-backed Project Journal (Entry #10 live), Dual Teleoperation Modes (IK vs Velocity Rate Integrator), and Phase C Demonstration Dataset Recording & Trajectory Replay.
- **Demonstration Dataset Engine (Phase C):** Live on `#panel-dataset`. Supports 30Hz trajectory sampling (`[timestamp, [θ1..θ6]]`), live 6-joint angle telemetry readout, auto-homing on stop (excluded from dataset), latest-episode-first list ordering, 1-click smooth trajectory playback (`Play Trajectory`), and episode deletion (`Delete`).
- **Prime Directive (100% Smooth Motion):** EMA Low-Pass Filter ($\alpha = 0.25$) with 5°/hard endpoint snapping across ALL 6 SERVOS.
- **Journal Backend:** Powered by **Supabase PostgreSQL** (`journal_entries` table) + **Supabase Cloud Storage** (`journal-media` public bucket) with instant 3s auto-sync across mobile PWA and laptop dashboard.

### What Exists in the Codebase
| File | Status |
|---|---|
| `firmware/servo_calibration/servo_calibration.ino` | ✅ Written, ready to flash |
| `firmware/robot_driver/robot_driver.ino` | ✅ Written, ready to flash |
| `ps5_controller_test.html` | ✅ Written, tested & validated |
| `start_dashboard.sh` | ✅ One-click launcher |
| `dashboard/backend/main.py` | ✅ FastAPI + WebSockets + Kinematics, Journal & Dataset REST endpoints |
| `dashboard/backend/serial_manager.py` | ✅ Arduino Serial + Bluetooth Port Filtering + E-Stop |
| `dashboard/frontend/index.html` | ✅ Warm Cream UI shell + Teleop Mode Switcher + Journal App + Dataset Recording |
| `dashboard/frontend/js/teleop_panel.js` | ✅ PS5 Controller + Dual Modes + Velocity Rate Integrator + EMA Low-Pass Filter |
| `dashboard/frontend/js/dataset_panel.js` | ✅ Phase C Demonstration Recording (30Hz), Live Telemetry, Auto-Homing & Replay |
| `project_journal.html` | ✅ Supabase PostgreSQL & Storage media uploader PWA (Entry #10 Live) |
| `TOSHAL_INSTRUCTION.md` | ✅ Complete ROS 2 Digital Twin guide (local / git-ignored) |
| `architecture.md` | ✅ System architecture document |
| `agent_bible.md` | ✅ This file (updated Session 6) |

---

## 3. Locked Engineering Decisions

| # | Decision | Details |
|---|---|---|
| 1 | Perception Architecture | Hybrid: OpenCV extracts features $\to$ Neural network learns motion only |
| 2 | Stage 1 Perception | ArUco markers on sponge blocks (cardboard-backed for flatness) |
| 3 | Stage 2 & 3 Perception | Color & contour detection (HSV thresholding for Red, Blue, Green blocks) |
| 4 | Coordinate System | Calibrated real-world coordinates (cm from robot base), NOT pixels |
| 5 | Teleoperation Control | Dual Modes: Cartesian IK & Direct Joint Velocity-Based Rate Control |
| 6 | Serial Protocol | Binary 6-byte packets at 115200 baud, 30 Hz target |
| 7 | Safety | Physical emergency stop switch + 500ms watchdog auto-home on Arduino |
| 8 | Block Material | Sponge cubes ($4\text{cm} \times 4\text{cm} \times 4\text{cm}$, lightweight, prevents gripper stall) |
| 9 | Stage 1 Setup | Box is FIXED, block is randomly placed |
| 10 | Stage 2 Setup | All objects (blocks & boxes) randomly placed |
| 11 | Dashboard | Web-based (HTML/CSS/JS + Python WebSocket backend) |
| 12 | Deployment Target | Raspberry Pi 5 (4GB RAM) |
| 13 | Camera 2 Role | Side camera is for dataset logging only; NOT used by the neural network |
| 14 | Home Position Assembly | Mount arm parts to maximize physical workspace range; use joint offsets in software |
| 15 | Arduino Port Management | Direct pyserial + Bluetooth audio port filtering (`IGNORED_PORT_KEYWORDS`) |
| 16 | Dashboard Auth | No authentication — local network only |
| 17 | Dashboard Responsiveness | Laptop + Tablet (min 768px width). Phone NOT supported |
| 18 | Dashboard Theme | Warm light mode — cream/linen/sand palette (`#FAF7F2`). NO dark mode |
| 19 | Assembly Strategy | Build Dashboard Phase A first as interactive assembly & testing tool |
| 20 | Zero-Jerk Motion | Cosine S-Curve trajectory interpolation for all automated joint transitions |
| 21 | Kinematic Calibration | Web-based calibration ($L_1..L_4$, servo zero offsets, gripper angles) saved to `kinematics_config.json` |
| 22 | Cloud Storage & Media | Supabase PostgreSQL (`journal_entries`) + Supabase Storage (`journal-media`) for PDFs, Word docs, photos, and videos |
| 23 | Dedicated Digital Twin Tab | 3D Viewport canvas listening on WebSocket port 9090 for ROS 2 `rosbridge` telemetry |
| 24 | Prime Directive (100% Smooth Motion) | EMA Low-Pass Filter ($\alpha = 0.25$) with 5°/hard endpoint snapping across ALL 6 SERVOS |
| 25 | Phase C Demonstration Dataset | 30Hz trajectory sampling, auto-homing on stop (excluded from dataset), latest-episode-first list ordering, smooth `Play Trajectory` replay with live telemetry, and deletion |

---

## 4. Conversation History Summary

### Session 8 (2026-08-13) — HARDWARE REFINEMENT, REPLAY INTERPOLATION & DATASET ARCHITECTURE
- **30Hz Trajectory Recorder Telemetry Sync:** Updated `DatasetPanel.getCurrentJointAngles()` to capture live PS5/IK/teleop joint telemetry during demonstration recording.
- **Zero-Jerk Trajectory Replay Lead-In:** Implemented S-Curve cosine interpolation lead-in and lead-out transitions for 1-click dataset replay to satisfy Prime Directive smooth motion policy.
- **Compact Dataset Storage Architecture:** Built custom dataset formatter reducing line count by **91%** and created 1-click PyTorch/HDF5 (`.h5` / `.npz`) exporter (`export_dataset.py`).
- **Hardware Serial Anti-Jitter Protocol:** Implemented `0xFF` Start-of-Frame Header Byte Framing and 400kHz Fast I2C mode. Fixed false 60Hz WebSocket teleop loop flooding.
- **Natural Controller Direction Tuning:** Reversed Base (Left Joystick LEFT moves Base LEFT) and Elbow (Right Joystick FORWARD moves Elbow FORWARD) in Direct Joint mode per user spec.

### Session 9 (2026-08-14) — PHYSICAL ARM ASSEMBLY COMPLETE, GRIPPER CALIBRATION & LIVE OPENCV VISION PIPELINE
- **Complete Physical 6-DOF Assembly & Pick-and-Place:** Robotic arm completely assembled with all 6 joints and verified physical pick-and-place operation!
- **Gripper Angle Calibration:** Open state calibrated to **140°** and closed state to **85°** across firmware (`robot_driver.ino`), Python backend (`serial_manager.py`, `main.py`), and frontend (`teleop_panel.js`, `servo_panel.js`, `dataset_panel.js`) with hard clamping to eliminate motor stall & gear strain.
- **PS5 Options Button Home Trigger:** Mapped PS5 Options button ($\equiv$) to trigger smooth Cosine S-Curve Home trajectory `[90°, 90°, 90°, 90°, 90°, 140°]`.
- **Live OpenCV ArUco Vision Stream:** Created `vision_manager.py` using OpenCV 5.0 `ArucoDetector` (`DICT_4X4_50`, IDs 0, 1, 2) streaming live 30 FPS MJPEG video on `/api/video_feed/1` with real-time green bounding boxes, orientation dots, and HUD labels.
- **Regenerated Official OpenCV Vector Markers:** Extracted exact binary matrices directly from OpenCV dictionary and re-rendered `aruco_id_0.svg`, `aruco_id_1.svg`, `aruco_id_2.svg`, `Block_1_Marker_0.png`, `Block_2_Marker_1.png`, and `print_aruco_sheet.html`. Verified live detection on webcam!
- **Manus AI Presentation Prompt:** Prepared comprehensive 12-slide presentation prompt matching warm cream/terracotta dashboard theme, hardware wiring, digital twin simulation, perception pipeline, and zero-jerk control algorithms.

---

## 5. Next Steps (Vision Workspace Calibration & Demonstration Data Collection)

1. **Mount Logitech C270 Camera:** Position Logitech C270 camera looking down at the workspace table plank.
2. **Cardboard Mounting for Physical Blocks:** Cut out printed ArUco ID 0, ID 1, and ID 2 tags, glue onto thin cardboard backing, and attach to sponge cubes & destination box.
3. **Record Demonstration Episodes (Phase C):** Use PS5 controller to record 150–250 pick-and-place demonstration episodes for Behavioral Cloning training.
