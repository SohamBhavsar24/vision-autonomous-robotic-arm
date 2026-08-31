# Agent Bible — Project Context & Continuity

> **Purpose:** This file ensures Antigravity never loses project context across sessions.
> **Rule:** This file MUST be updated after every significant conversation or decision.
> **Last Updated:** 2026-08-31 (Session 11 Complete — Gripper Binary State Paradigm Deployed, 25cm × 25cm Workspace & 75-Episode Dataset Strategy Defined, Supabase Cloud Journal Synced)

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

### Overall Phase: DEMONSTRATION DATASET COLLECTION & HARDWARE TELEOPERATION (SESSION 11)
- **Direct Joint Velocity Rate Control (Default Teleop Mode):** Smooth, gliding PS5 DualSense controller teleoperation with zero-jerk EMA low-pass filtering. Base motor lag and state conflict resets eliminated.
- **Gripper Binary State Paradigm:** Full 0°–180° testing range on dashboard sliders. Dynamic user-defined `Open Angle (°)` and `Close Angle (°)` calibration input fields persisted via browser `localStorage` and backend `kinematics_config.json`. R2 closes gripper smoothly (`gripper_state = 1`); L2 opens gripper smoothly (`gripper_state = 0`).
- **Demonstration Dataset Engine (Phase C):** Stores 5 primary joint angles `[θ1..θ5]` + binary `gripper_state` (`0 = OPEN`, `1 = CLOSED`) at 30Hz, decoupled from raw mechanical servo drift. Target volume defined at **75 demonstration episodes** across a $25\text{ cm} \times 25\text{ cm}$ workspace table ($5 \times 5$ grid, 3 demos per cell).
- **Journal Backend:** Powered by **Supabase PostgreSQL** (`journal_entries` table on `pzewxynfhrylnqbkkeeq.supabase.co`) + **Supabase Cloud Storage** (`journal-media` public bucket) with instant auto-sync across mobile PWA and laptop dashboard.
- **Live OpenCV Vision Stream:** ArUco Marker ID 0 tracking active on 30 FPS MJPEG camera feed (`/api/video_feed/1`).

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
| 14 | Home Position & 90° Zero Reference | When all 5 arm joints are set to 90° (and Gripper at 140°), the physical arm stands straight upright, facing forward towards the workspace plank |
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

### Session 10 (2026-08-31) — 3D ANALYTICAL INVERSE KINEMATICS & FORWARD KINEMATICS ENGINE IMPLEMENTATION
- **3D Analytical IK Engine (`ik_solver.py`):** Implemented closed-form trigonometric & geometric 3D IK and FK algorithms calibrated to physical dimensions: $L_1 = 9.5\text{ cm}$, $L_2 = 12.0\text{ cm}$, $L_3 = 9.0\text{ cm}$, $L_4 = 14.0\text{ cm}$.
- **Physical Direction & Reference Frame Mapping:** 
  - Base ($\theta_1$): $90^\circ \to 130^\circ$ moves Left (+X).
  - Shoulder ($\theta_2$): $90^\circ \to 50^\circ$ tilts Forward (+Y/down towards table).
  - Elbow ($\theta_3$): $45^\circ$ = Upright inline with $L_2$, $90^\circ$ = $45^\circ$ forward tilt, $135^\circ$ = Parallel to table.
- **REST & WebSocket API Endpoints:** Added `/api/ik/solve`, `/api/ik/move`, and `/api/fk` in `main.py` along with `move_ik` WebSocket handler for instant 3D coordinate teleoperation & autonomous vision picking.
- **Persistent Kinematics Config:** Updated `kinematics_config.json` and linked dynamic parameters to `ik_solver.py`.

### Session 11 (2026-08-31) — GRIPPER BINARY STATE PARADIGM, 25cm × 25cm WORKSPACE, 75-EPISODE DATASET BLUEPRINT & BASE LAG RESOLUTION
- **Gripper Binary State Paradigm:** Unlocked dashboard Gripper slider to full $0^\circ \text{ to } 180^\circ$ testing range. Added dynamic user-defined `Open Angle (°)` and `Close Angle (°)` calibration input fields persisted via browser `localStorage` and backend `kinematics_config.json`. PS5 R2 trigger glides gripper closed (`gripper_state = 1`); L2 trigger glides gripper open (`gripper_state = 0`).
- **Demonstration Dataset Schema Update:** Refactored `dataset_panel.js` to log 5 primary joint angles `[θ1..θ5]` + binary `gripper_state` (`0 = OPEN`, `1 = CLOSED`) at 30Hz, completely decoupling dataset trajectory logs from physical servo gear slip. Trajectory replay dynamically resolves open/close angles from user calibration settings.
- **25cm × 25cm Workspace Bounding Box & 75-Episode Blueprint:** Established a strict $25\text{ cm} \times 25\text{ cm}$ physical workspace grid ($5 \times 5$ grid, 25 sub-squares of $5\text{ cm} \times 5\text{ cm}$ each) with a target dataset volume of **75 demonstration episodes** (3 clean human teleoperation demonstrations per cell across varying block approach angles and rotations).
- **Base Motor Lag & Snapping Resolution:** Eliminated state conflict reset loop in `teleop_panel.js` animation loop. Base motor movement is 100% continuous and responsive to Left Joystick (X) inputs without dropping frames or snapping to limits.
- **Supabase Cloud Sync:** Published Log Entry 12 directly to live **Supabase PostgreSQL** database (`journal_entries` table on `pzewxynfhrylnqbkkeeq.supabase.co`).
- **ArUco Perception Validation:** ArUco ID 0 (Block 1) detected live on 30 FPS MJPEG camera feed (`/api/video_feed/1`). ArUco ID 2 designated as World Origin Calibration Tag on the platform board.

---

## 5. Next Steps (Demonstration Data Collection & Perception Calibration)

1. **Place ArUco ID 2 World Origin Tag:** Stick ArUco Tag ID 2 flat on the corner of the $25\text{ cm} \times 25\text{ cm}$ workspace platform to establish the real-world $(0,0)$ origin.
2. **Collect 75 Demonstration Episodes:** Execute the $5 \times 5$ grid teleoperation routine (3 episodes per cell) to build the Stage 1 training dataset for imitation learning.
3. **Format PyTorch Dataset (`export_dataset.py`):** Run 1-click dataset exporter to package recorded JSON demonstration episodes into PyTorch tensors (`.h5` / `.npz`) for policy model training.
