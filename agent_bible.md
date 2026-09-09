# Agent Bible — Project Context & Continuity

> **Purpose:** This file ensures Antigravity never loses project context across sessions.
> **Rule:** This file MUST be updated after every significant conversation or decision.
> **Last Updated:** 2026-09-09 (Session 12 Complete — Behavior Cloning Policy v1 Deployed, Autonomous Mode Panel, Zero-IK Tri-Anchor Blending, Supabase Log Entry #14 Synced)

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

### Session 11 (2026-08-31 to 2026-09-08) — GRIPPER BINARY STATE PARADIGM, 25cm × 30cm WORKSPACE, PROGRESSIVE 30/60/90 DATASET STRATEGY & WORLD ORIGIN ARUCO TRACKING
- **Gripper Binary State Paradigm:** Unlocked dashboard Gripper slider to full $0^\circ \text{ to } 180^\circ$ testing range. Added dynamic user-defined `Open Angle (°)` and `Close Angle (°)` calibration input fields persisted via browser `localStorage` and backend `kinematics_config.json`. PS5 R2 trigger glides gripper closed (`gripper_state = 1`); L2 trigger glides gripper open (`gripper_state = 0`).
- **Demonstration Dataset Schema Update:** Refactored `dataset_panel.js` to log 5 primary joint angles `[θ1..θ5]` + binary `gripper_state` (`0 = OPEN`, `1 = CLOSED`) at 30Hz, completely decoupling dataset trajectory logs from physical servo gear slip. Trajectory replay dynamically resolves open/close angles from user calibration settings.
- **25cm × 30cm Workspace Definition & 30-Cell Grid Strategy:** Established a physical $25\text{ cm} \times 30\text{ cm}$ workspace grid (total area $750\text{ cm}^2$) partitioned into 30 sub-squares of $5\text{ cm} \times 5\text{ cm}$ each ($5\text{ columns} \times 6\text{ rows}$).
- **Progressive Dataset Collection & Evaluation Pipeline:**
  - **Pass 1 (30 Demonstrations):** 1 demonstration per cell $\to$ Train initial Behavioral Cloning policy & test physical success rate.
  - **Pass 2 (60 Demonstrations):** 2 demonstrations per cell (varied block rotations $0^\circ, 30^\circ, 45^\circ$) $\to$ Retrain & evaluate accuracy improvement.
  - **Pass 3 (90 Demonstrations):** 3 demonstrations per cell (diverse approach angles & boundary offsets) $\to$ Retrain & verify convergence.
  - **Pass 4 (120 Demonstrations - optional buffer):** Final refinement before transitioning to Stage 2 multi-block color/tag sorting.
- **Base Motor Lag & Snapping Resolution:** Eliminated state conflict reset loop in `teleop_panel.js` animation loop. Base motor movement is 100% continuous and responsive to Left Joystick (X) inputs without dropping frames or snapping to limits.
- **Live World Origin Coordinate Transformation:** Verified live detection of ArUco ID 2 (World Origin) and ArUco ID 0 (Block 1). Drawn coordinate axes (+X red, +Y green) and real-world vector line with live centimeter distance and orientation $\theta$ overlay on Camera 1 feed.
- **Supabase Cloud Sync:** Log Entries 12 and 13 published to live **Supabase PostgreSQL** database (`journal_entries` table on `pzewxynfhrylnqbkkeeq.supabase.co`).

### Session 12 (2026-09-09) — BEHAVIOR CLONING POLICY v1 DEPLOYMENT, AUTONOMOUS MODE PANEL, ZERO-IK TRI-ANCHOR BLENDING & SUPABASE LOG ENTRY 14
- **Behavior Cloning (BC) Policy Model Training (`v1 (30 Demos)`):** Ingested all 30 human teleoperation demonstration episodes (17,824 state-action pairs sampled at 30Hz). Observation vector $[θ_1, θ_2, θ_3, θ_4, θ_5, \text{gripper}, X, Y, \theta]$, Action vector $[θ_1', θ_2', θ_3', θ_4', θ_5', \text{gripper}']$. Trained in 5.9 seconds with loss converging to `0.5026` and Joint MSE to `0.4038` degrees. Saved to `dashboard/backend/models/v1_policy.npz`.
- **Autonomous Mode Execution Subsystem (Phase D):** Built backend runner (`autonomous_runner.py`) and Web Dashboard panel (`http://localhost:8050/#panel-autonomous`) with Camera 1 live perception check, 6-phase dynamic state progression, 30Hz joint telemetry stream, and emergency software abort.
- **Workspace Axis Dimension Correction:** Corrected physical workspace bounds in training and inference pipelines: $X_{\text{max}} = 30.0\text{ cm}$ (horizontal width), $Y_{\text{max}} = 25.0\text{ cm}$ (forward reach/depth), fixing observation feature normalization.
- **Tri-Anchor Joint-Space Trajectory Blending (Zero Inverse Kinematics):** Replaced linear offset heuristics with continuous non-linear manifold interpolation across the $k=3$ nearest human demonstrations using normalized Inverse Distance Weighting ($w_i \propto 1/(d_i + \epsilon)^2$). Blends trajectories purely in joint space ($\theta_1 \dots \theta_5$), preserving natural demonstration curvature without IK. Widened gripper approach angle to $148^\circ$ for expanded physical capture envelope.
- **Model Lifecycle Management & Emoji Purge:** Implemented backend deletion (`DELETE /api/models/{model_id}`) and frontend **Delete** buttons to remove and unregister experimental model versions (e.g. `v2`). Purged all emojis across the entire dashboard interface, scripts, and codebase.
- **Supabase Cloud Journal Sync:** Successfully published Log Entry #14 directly to Supabase PostgreSQL cloud database (`journal_entries` table).

---

## 5. Next Steps

1. **Evaluate Physical Pick-and-Place Success Rate:** Run autonomous trials across various coordinates in the $30\text{ cm} \times 25\text{ cm}$ workspace with model `v1` and Tri-Anchor Blending.
2. **Collect Second Batch (Pass 2 - 60 Demonstrations):** Add 30 more demonstration episodes covering diverse block rotation orientations ($0^\circ, 30^\circ, 45^\circ$).
3. **Retrain Policy Version `v2`:** Evaluate accuracy improvements across the expanded 60-episode dataset.
