# Agent Bible — Project Context & Continuity

> **Purpose:** This file ensures Antigravity never loses project context across sessions.
> **Rule:** This file MUST be updated after every significant conversation or decision.
> **Last Updated:** 2026-09-26 (Session 15 — Three.js Digital Twin 3D Mesh Table Penetration Prevention, Revert Geofencing & Runtime Toggle)

---

## 1. Project Identity

- **Project:** Vision-Based Autonomous Pick-and-Place Robotic Arm Using Imitation Learning
- **Owner:** Soham Bhavsar
- **Team Members:** Soham Bhavsar, Divyansh Dewangan, Toshal Kumbhar
- **Type:** Academic Journal Paper & Capstone Project
- **Workspace Path:** `/Users/sohambhavsar/Desktop/Autonomoous arm`
- **GitHub Repository:** `https://github.com/SohamBhavsar24/vision-autonomous-robotic-arm.git`

---

## 2. Current Project Status

### Overall Phase: CONTINUOUS AUTONOMOUS MODE, JOURNAL PAPER EVALUATION ROADMAP (30/60/90 DEMOS & ACT POLICY), & THREE.JS DIGITAL TWIN (SESSION 14)
- **Continuous Autonomous Execution Engine (Phase D):** Redesigned Autonomous Mode with a unified Master Control Bar. Arm enters Standby at Home pose (`[90°, 90°, 90°, 90°, 90°, 140°]`), continuously monitors Camera 1 perception, and triggers a 1.0-second stationary stability countdown upon block detection. Once verified stable ($\Delta x \le 0.8\text{ cm}$, $\Delta y \le 0.8\text{ cm}$, $\Delta \theta \le 15^\circ$), the selected policy model executes the 30Hz trajectory rollout, deposits the block into the target box, returns to Home, and immediately re-enters Standby mode.
- **Journal Paper Research Direction:** Empirical evaluation matrix for academic journal publication:
  1. Progressive Demonstration Dataset Scaling: Evaluating physical pick-and-place accuracy at 30 demos, 60 demos, and 90 demos.
  2. Action Chunking with Transformers (ACT) Policy Pipeline: Conditioning ACT policy directly on lightweight OpenCV feature vectors (ArUco Tag 0 real-world coordinates $X, Y$ and orientation $\theta$) instead of end-to-end heavy CNN vision backbones, maximizing inference speed on edge devices.
- **3D WebGL Digital Twin (Three.js):** 100% offline local Three.js + STLLoader WebGL engine animating physical CAD STL meshes (`Base.STL`, `Waist.STL`, `Arm 01.STL`, `Arm 02 v3.STL`, `Arm 03.STL`, `Gripper base.STL`, `Gripper 1.STL`) in real-time synchronized to live WebSocket joint telemetry at 60 FPS.
- **High-Resolution Academic Research Poster:** Standalone print-ready A0 research poster web application (`poster/index.html`) running on port 8055 with high-contrast layout, custom SVG system pipeline flowchart, and print CSS formatting.
- **Direct Joint Velocity Rate Control (Default Teleop Mode):** Smooth, gliding PS5 DualSense controller teleoperation with zero-jerk EMA low-pass filtering.
- **Gripper Binary State Paradigm:** Dynamic user-defined `Open Angle (°)` (140°) and `Close Angle (°)` (85°) calibration input fields persisted via browser `localStorage` and backend `kinematics_config.json`.
- **Demonstration Dataset Engine (Phase C):** Logs 5 primary joint angles `[θ1..θ5]` + binary `gripper_state` (`0 = OPEN`, `1 = CLOSED`) at 30Hz across a $25\text{ cm} \times 30\text{ cm}$ workspace table ($5 \times 6$ grid, 30 sub-cells).
- **Journal Backend:** Powered by **Supabase PostgreSQL** (`journal_entries` table on `pzewxynfhrylnqbkkeeq.supabase.co`) + **Supabase Cloud Storage** (`journal-media` public bucket).
- **Live OpenCV Vision Stream:** ArUco Marker ID 0 (Target Block) and ID 2 (World Origin) tracking active on 30 FPS MJPEG camera feed (`/api/video_feed/1`).

### What Exists in the Codebase
| File | Status | Description |
|---|---|---|
| `dashboard/backend/autonomous_runner.py` | [DONE] Active | Continuous autonomous loop, 1.0s stability meter, Tri-Anchor Joint-Space Trajectory Blending |
| `dashboard/backend/main.py` | [DONE] Active | FastAPI + WebSockets + Kinematics, Vision, Dataset, Model Training & Autonomous Endpoints |
| `dashboard/backend/serial_manager.py` | [DONE] Active | Arduino Serial + Bluetooth Port Filtering + Cosine S-Curve Transitions + E-Stop |
| `dashboard/backend/vision_manager.py` | [DONE] Active | OpenCV 5.0 ArUco tracking (IDs 0, 1, 2) + World Coordinate Transformation |
| `dashboard/frontend/index.html` | [DONE] Active | Master Autonomous Bar, 3D Digital Twin, Teleop, Dataset, Journal, ROS 2 Panels |
| `dashboard/frontend/js/autonomous_panel.js` | [DONE] Active | Continuous Autonomous UI, Model Selector Dropdown, 1.0s Stability Meter, Live Telemetry |
| `dashboard/frontend/js/digital_twin_panel.js`| [DONE] Active | Three.js WebGL CAD STL 3D Simulation with live WebSocket joint telemetry syncing |
| `dashboard/frontend/js/teleop_panel.js` | [DONE] Active | PS5 Controller + Dual Modes + Velocity Rate Integrator + EMA Low-Pass Filter |
| `dashboard/frontend/js/dataset_panel.js` | [DONE] Active | Phase C Demonstration Recording (30Hz), Live Telemetry, Auto-Homing & Replay |
| `poster/index.html` | [DONE] Active | Standalone high-res A0 research poster application (Port 8055) |
| `start_dashboard.sh` | [DONE] Active | One-click launcher for Dashboard Backend (Port 8000) |
| `start_poster.sh` | [DONE] Active | One-click launcher for Academic Research Poster (Port 8055) |
| `firmware/robot_driver/robot_driver.ino` | [DONE] Active | Arduino Mega/Uno firmware with PCA9685 16-channel PWM servo driver |
| `firmware/servo_calibration/servo_calibration.ino` | [DONE] Ready | Individual servo calibration utility |
| `ps5_controller_test.html` | [DONE] Validated | Browser Gamepad API testing harness |
| `project_journal.html` | [DONE] Active | Supabase PostgreSQL & Storage media uploader PWA (Entry #14 Live) |
| `agent_bible.md` | [DONE] Active | Project Continuity & Context Record (Updated Session 14) |

---

## 3. Locked Engineering Decisions

| # | Decision | Details |
|---|---|---|
| 1 | Perception Architecture | Hybrid: OpenCV extracts features -> Neural network / policy learns motion only |
| 2 | Stage 1 Perception | ArUco markers on sponge blocks (cardboard-backed for flatness, Tag ID 0) |
| 3 | Stage 2 & 3 Perception | Color & contour detection (HSV thresholding for Red, Blue, Green blocks) |
| 4 | Coordinate System | Calibrated real-world coordinates (cm from robot base origin Tag 2), NOT pixels |
| 5 | Teleoperation Control | Dual Modes: Cartesian IK & Direct Joint Velocity-Based Rate Control |
| 6 | Serial Protocol | Binary 6-byte packets at 115200 baud, 30 Hz target |
| 7 | Safety | Physical emergency stop switch + 500ms watchdog auto-home on Arduino |
| 8 | Block Material | Sponge cubes (4cm x 4cm x 4cm, lightweight, prevents gripper stall) |
| 9 | Stage 1 Setup | Box is FIXED, block is randomly placed in workspace |
| 10 | Stage 2 Setup | All objects (blocks & boxes) randomly placed |
| 11 | Dashboard | Web-based (HTML/CSS/JS + Python WebSocket backend) |
| 12 | Deployment Target | Raspberry Pi 5 (4GB RAM) |
| 13 | Camera 2 Role | Side camera is for dataset logging only; NOT used by the neural policy |
| 14 | Home Position & 90° Zero Reference | When all 5 arm joints are set to 90° (and Gripper at 140°), the physical arm stands straight upright, facing forward towards the workspace plank |
| 15 | Arduino Port Management | Direct pyserial + Bluetooth audio port filtering (`IGNORED_PORT_KEYWORDS`) |
| 16 | Dashboard Auth | No authentication — local network only |
| 17 | Dashboard Responsiveness | Laptop + Tablet (min 768px width). Phone NOT supported |
| 18 | Dashboard Theme | Warm light mode — cream/linen/sand palette (`#FAF7F2`). NO dark mode |
| 19 | Assembly Strategy | Build Dashboard Phase A first as interactive assembly & testing tool |
| 20 | Zero-Jerk Motion | Cosine S-Curve trajectory interpolation for all automated joint transitions |
| 21 | Kinematic Calibration | Web-based calibration ($L_1..L_4$, servo zero offsets, gripper angles) saved to `kinematics_config.json` |
| 22 | Cloud Storage & Media | Supabase PostgreSQL (`journal_entries`) + Supabase Storage (`journal-media`) for PDFs, Word docs, photos, and videos |
| 23 | Dedicated Digital Twin Tab | 3D WebGL viewport canvas loading local STL meshes with live WebSocket joint telemetry syncing |
| 24 | Prime Directive (100% Smooth Motion) | EMA Low-Pass Filter ($\alpha = 0.25$) with 5°/hard endpoint snapping across ALL 6 SERVOS |
| 25 | Phase C Demonstration Dataset | 30Hz trajectory sampling, auto-homing on stop (excluded from dataset), latest-episode-first list ordering, smooth `Play Trajectory` replay with live telemetry, and deletion |
| 26 | Continuous Autonomous Execution Loop | Arm parks in Standby at Home pose (`[90, 90, 90, 90, 90, open_angle]`). Continuously watches Camera 1 vision for block detection. 1.0-second stationary stability verification window ($\Delta x \le 0.8\text{ cm}$, $\Delta y \le 0.8\text{ cm}$, $\Delta \theta \le 15^\circ$) prevents false triggering while placing blocks. Trajectory executes pick-and-place, returns to Home, and immediately re-enters Standby |
| 27 | Camera FOV & Drop Zone Decoupling | Overhead camera strictly observes the $25\text{ cm} \times 30\text{ cm}$ manipulation table workspace; target drop box is physically situated outside the camera field-of-view, eliminating false-positive pick triggers on delivered blocks |
| 28 | Journal Paper Evaluation Strategy (BC vs ACT with Feature Vectors) | Empirical evaluation matrix comparing Behavior Cloning (BC) baseline across progressive dataset tiers (30 vs 60 vs 90 human teleoperated demonstration episodes) against Action Chunking with Transformers (ACT) conditioned directly on lightweight OpenCV feature vectors (ArUco coordinates $X, Y$ and orientation $\theta$), circumventing heavy CNN visual latency on embedded edge hardware |
| 29 | Standalone Decoupled Research Poster | High-resolution print-ready A0 academic poster web application hosted independently on port 8055, decoupled from dashboard telemetry to prevent runtime interference |
| 30 | Offline 3D STL Digital Twin | Zero-CDN Three.js + STLLoader WebGL engine loading local CAD meshes (`Arm 01.STL`, `Arm 02 v3.STL`, `Arm 03.STL`, `Base.STL`, `Waist.STL`, `Gripper base.STL`, `Gripper 1.STL`) with live WebSocket `/ws` joint telemetry mapping |
| 31 | Digital Twin 3D Mesh Table Penetration Prevention & Geofencing Floor Guard | Zero analytical kinematics equations. Derives exact end-effector / claw 3D world elevation ($Y_{\text{min}}$ in mm) directly from Three.js scene-graph mesh forward transforms (`THREE.Box3().setFromObject(this.wristPitchGroup)`). If candidate joint angles command claws below $8.0\text{ mm}$ safety threshold ($Y_{\text{floor\_limit}}$) above tabletop ($Y = 0\text{ mm}$ table, $Y = 1.6\text{ mm}$ pad), commands are blocked at transmission, a flashing red HUD collision banner is displayed, claws highlight red, and angles revert to `lastSafeAngles`. Enforced universally across PS5 Teleoperation (Joint & IK modes), Manual Sliders, and Autonomous Mode execution. Runtime toggle button (`#btnDtToggleGeofence`) with `localStorage` persistence enables on-the-fly override |

---

## 4. Conversation History Summary

### Session 8 (2026-08-13) — HARDWARE REFINEMENT, REPLAY INTERPOLATION & DATASET ARCHITECTURE
- **30Hz Trajectory Recorder Telemetry Sync:** Updated `DatasetPanel.getCurrentJointAngles()` to capture live PS5/IK/teleop joint telemetry during demonstration recording.
- **Zero-Jerk Trajectory Replay Lead-In:** Implemented S-Curve cosine interpolation lead-in and lead-out transitions for 1-click dataset replay to satisfy Prime Directive smooth motion policy.
- **Compact Dataset Storage Architecture:** Built custom dataset formatter reducing line count by 91% and created 1-click PyTorch/HDF5 (`.h5` / `.npz`) exporter (`export_dataset.py`).
- **Hardware Serial Anti-Jitter Protocol:** Implemented `0xFF` Start-of-Frame Header Byte Framing and 400kHz Fast I2C mode. Fixed false 60Hz WebSocket teleop loop flooding.
- **Natural Controller Direction Tuning:** Reversed Base (Left Joystick LEFT moves Base LEFT) and Elbow (Right Joystick FORWARD moves Elbow FORWARD) in Direct Joint mode per user spec.

### Session 9 (2026-08-14) — PHYSICAL ARM ASSEMBLY COMPLETE, GRIPPER CALIBRATION & LIVE OPENCV VISION PIPELINE
- **Complete Physical 6-DOF Assembly & Pick-and-Place:** Robotic arm completely assembled with all 6 joints and verified physical pick-and-place operation.
- **Gripper Angle Calibration:** Open state calibrated to 140° and closed state to 85° across firmware (`robot_driver.ino`), Python backend (`serial_manager.py`, `main.py`), and frontend (`teleop_panel.js`, `servo_panel.js`, `dataset_panel.js`) with hard clamping to eliminate motor stall & gear strain.
- **PS5 Options Button Home Trigger:** Mapped PS5 Options button to trigger smooth Cosine S-Curve Home trajectory `[90°, 90°, 90°, 90°, 90°, 140°]`.
- **Live OpenCV ArUco Vision Stream:** Created `vision_manager.py` using OpenCV 5.0 `ArucoDetector` (`DICT_4X4_50`, IDs 0, 1, 2) streaming live 30 FPS MJPEG video on `/api/video_feed/1` with real-time green bounding boxes, orientation dots, and HUD labels.
- **Regenerated Official OpenCV Vector Markers:** Extracted exact binary matrices directly from OpenCV dictionary and re-rendered `aruco_id_0.svg`, `aruco_id_1.svg`, `aruco_id_2.svg`, `Block_1_Marker_0.png`, `Block_2_Marker_1.png`, and `print_aruco_sheet.html`. Verified live detection on webcam.
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
  - **Pass 1 (30 Demonstrations):** 1 demonstration per cell -> Train initial Behavioral Cloning policy & test physical success rate.
  - **Pass 2 (60 Demonstrations):** 2 demonstrations per cell (varied block rotations $0^\circ, 30^\circ, 45^\circ$) -> Retrain & evaluate accuracy improvement.
  - **Pass 3 (90 Demonstrations):** 3 demonstrations per cell (diverse approach angles & boundary offsets) -> Retrain & verify convergence.
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

### Session 13 (2026-09-20) — AUTONOMOUS MODE PAUSED, 3D STL DIGITAL TWIN (THREE.JS) & DEDICATED ROS 2 PANEL ARCHITECTURE
- **Autonomous Mode Transition:** Testing of autonomous pick-and-place paused for subsequent physical tuning. Focus pivoted to 3D simulation and ROS 2 middleware architecture.
- **Dedicated 3D Digital Twin Panel (Three.js WebGL):** Converted `panel-digital-twin` into a high-performance WebGL 3D simulation rendering the physical 3D print STL parts (`Base.STL`, `Waist.STL`, `Arm 01.STL`, `Arm 02 v3.STL`, `Arm 03.STL`, `Gripper base.STL`, `Gripper 1.STL` from `Robotic_Arm_3D_Model.STEP`). Integrated OrbitControls, studio lighting, smooth 60 FPS lerp interpolation, and real-time synchronization with WebSocket (`/ws`) joint telemetry. Zero external CDN dependencies (Three.js, OrbitControls, and STLLoader bundled locally for 100% offline operation).
- **Dedicated ROS 2 Panel (`panel-ros`):** Separated ROS 2 integration into its own dashboard panel hosting the ROS 2 computational graph visualization (`robot_state_publisher`, `joint_state_broadcaster`, `rosbridge_websocket`, `arm_controller`), active topic streams table (`/joint_states`, `/robot_description`, `/tf`, `/arm_controller/joint_trajectory`, `/camera/color/image_raw`), TF2 transform tree hierarchy (`world` -> `base_link` -> `waist_link` -> `shoulder_link` -> `elbow_link` -> `wrist_pitch_link` -> `wrist_roll_link` -> `tool_center_point`), and URDF/Xacro pipeline specifications.
- **Zero Emoji Compliance:** Preserved strict zero-emoji mandate across all UI views, documentation, and source code.

### Session 14 (2026-09-26) — CONTINUOUS AUTONOMOUS MODE REDESIGN, 1.0s STABILITY VERIFICATION, JOURNAL PAPER ACT ROADMAP & A0 RESEARCH POSTER OVERHAUL
- **Continuous Autonomous Execution Redesign:** Completely overhauled Autonomous Mode execution flow for journal paper experimental evaluations. Eliminated individual per-model launch buttons requiring repetitive manual clicks. Created a unified **Master Autonomous Control Bar** with:
  1. A **Policy Model Dropdown** (`selAutonomousModel`) dynamically synchronized to registered models (`v1`, `v2`, `v3`).
  2. A single **Start / Stop Autonomous Mode** toggle button (`btnToggleAutonomousLoop`) transitioning between emerald green (Start) and crimson red (Stop).
  3. A real-time **Autonomous Status Badge** displaying live states: `IDLE`, `STANDBY (ARM AT HOME)`, `STABILIZING (1.0s countdown)`, and `EXECUTING PICK & PLACE`.
- **1.0-Second Stationary Stability Verification Window:**
  - Implemented continuous perception stability tracking in `autonomous_runner.py`: when a target block (Tag ID 0) is placed within the $25\text{ cm} \times 30\text{ cm}$ manipulation workspace, the arm remains safely at Home (`[90, 90, 90, 90, 90, 140]`) while verifying that coordinates remain stationary ($\Delta x \le 0.8\text{ cm}$, $\Delta y \le 0.8\text{ cm}$, $\Delta \theta \le 15^\circ$) for a full 1.0 second.
  - Any hand movement or block displacement resets the 1.0s countdown meter.
  - Upon 1.0s verified stability, the chosen policy automatically triggers trajectory rollout at 30Hz, deposits the block into the drop box, returns smoothly to Home, and immediately re-enters Standby ready for the next block.
- **Field of View & Camera Decoupling Clarification:** Camera 1 strictly frames the $25\text{ cm} \times 30\text{ cm}$ table workspace; the target drop box is physically outside camera view, ensuring delivered blocks are ignored and never trigger false-positive duplicate picks.
- **Standalone A0 Research Poster Overhaul (`poster/index.html`):**
  - Built and refined a print-ready A0 academic research poster on dedicated port 8055.
  - Tuned layout: 40x40 cm rigid baseplate rig, 50 cm overhead optical mast, 25x30 cm calibrated manipulation pad, dual-rail isolated power architecture (6V 5A servo rail + shielded 5V logic).
  - Clean high-contrast white aesthetic with blue accent cards, custom inline SVG pipeline flowchart, and print CSS styling.
- **Strict Zero-Emoji Enforcement:** Preserved 100% zero-emoji rule across all files, tools, and documentation.

### Session 15 (2026-09-26) — THREE.JS DIGITAL TWIN 3D MESH TABLE PENETRATION PREVENTION & UNIVERSAL REVERT GEOFENCING
- **Problem Statement & Zero-Kinematics Mandate:** Multiple physical test runs resulted in the robotic arm or gripper slamming downward into the table workspace plank. While conventional robotics relies on analytical forward/inverse kinematics solvers, the core philosophy of this project strictly avoids complex analytical kinematics solvers in runtime control to favor lightweight imitation learning and direct joint-space demonstration manifolds.
- **Three.js Scene-Graph 3D Mesh Bounding Box Architecture:**
  - Utilized the existing Three.js digital twin WebGL scene graph to evaluate safety without trigonometry or kinematics equations.
  - Developed `DigitalTwinPanel.evaluateAnglesSafety(candidateAngles)`: applies candidate joint angles to the Three.js hierarchical groups (`waistGroup` -> `shoulderGroup` -> `elbowGroup` -> `wristRollGroup` -> `wristPitchGroup` -> `clawLeftGroup`/`clawRightGroup`) off-screen, invokes `robotRoot.updateMatrixWorld(true)`, and measures the lowest world-space vertex elevation ($Y_{\text{min}}$ in mm) via `THREE.Box3().setFromObject(this.wristPitchGroup)` and `setFromObject(this.elbowGroup)`.
  - Immediate rotation rollback ensures the visible digital twin animation remains synchronized to telemetry.
- **Table Pad Calibration & Safety Cushion:**
  - Table wood surface: $Y = 0.0\text{ mm}$.
  - Calibrated manipulation pad: $Y = 1.6\text{ mm}$.
  - Safety floor threshold: $Y_{\text{floor\_limit}} = 8.0\text{ mm}$ ($0.8\text{ cm}$). This gives a 6.4mm air cushion above the pad, preventing gripper slams while allowing 40mm sponge block pick acquisitions ($Y \approx 12\text{--}15\text{ mm}$) without false alarms.
- **Universal Revert Enforcement:**
  - **Manual Sliders & PS5 Teleoperation (`servo_panel.js`):** Intercepted in `throttledSendAngles()`. Candidate angles breaching the 8.0mm limit are blocked from WebSocket transmission. Sliders and `TeleopPanel` integrated/smoothed state instantly revert to `lastSafeAngles`, and safe angles are resent to the robot.
  - **Autonomous Mode (`autonomous_panel.js`):** Added live safety guard in `updateExecutionUI()` during autonomous execution (`status.is_running`). If live telemetry violates the threshold, the autonomous loop aborts, triggers the collision alert, and commands safe recovery angles.
- **Digital Twin UI Indicators & Runtime Toggle:**
  - **Table Safety Toggle Button (`#btnDtToggleGeofence`):** Positioned in the `#panel-digital-twin` header. Defaults to OFF (`Table Safety: OFF`), allowing user to toggle protection ON or OFF on the fly, with state saved to `localStorage`.
  - **Live Clearance Meter (`#dtClearanceMeter`):** Renders dynamic 60 FPS clearance readout ("Clearance: 42.5 mm", turning crimson "Clearance: 0.0 mm (BREACH)" when breached).
  - **Floating HUD Collision Banner (`#dtCollisionBanner`):** Displays red pulsing alert banner (`TABLE PENETRATION DETECTED: REVERTED TO SAFE POSE`) inside the WebGL viewport and highlights gripper claw meshes red with a 1.4-second auto-fade.
- **Dynamic Gripper Open Angle Resolution:** Safe pose baseline and fallbacks dynamically retrieve the calibrated `openAngle` (`[90, 90, 90, 90, 90, openAngle]`) from UI inputs (`#angleGripperOpen`, `#inputGripperOpenCard`) or `localStorage`, eliminating hardcoded 140° gripper angles.
- **Supabase Cloud Journal Sync (Entries 15 & 16):** Successfully published Log Entry #15 (Three.js WebGL Digital Twin & ROS 2 Architecture) and Log Entry #16 (Continuous Autonomous Execution Engine & 3D Mesh Table Penetration Prevention) directly to the live Supabase PostgreSQL database (`journal_entries` table on `pzewxynfhrylnqbkkeeq.supabase.co`) and synchronized local backend JSON and Vercel PWA seed entries.
- **Journal PWA Enhancements (100-Word Limit & In-Place Editing):** Upgraded `project_journal.html` and `dashboard/frontend/project_journal.html` with a 100-word truncation filter and collapsible "Read More ▾" / "Read Less ▴" toggle button for long narrative entries. Added full editing capabilities: each journal card features an "Edit" button pre-populating the entry modal (date, title, story, attachment status) with instant Supabase PostgreSQL (`resolution=merge-duplicates`) and `localStorage` cloud synchronization.
- **Strict Zero-Emoji Mandate:** Confirmed 0 emoji characters across all modified JavaScript, HTML, CSS, and markdown files.

---

## 5. Next Steps

1. **Physical Continuous Autonomous Trials & Geofence Verification:** Perform live continuous pick-and-place trial runs with model `v1 (30 Demos)` while verifying that table penetration prevention smoothly prevents floor collisions during teleoperation and autonomous rollouts.
2. **Pass 2 Demonstration Collection (60 Demos):** Log 30 additional demonstrations across the 30 grid cells with varied block angles ($0^\circ, 30^\circ, 45^\circ$) to evaluate accuracy improvement for the journal paper.
3. **Action Chunking with Transformers (ACT) Policy Pipeline:** Implement lightweight ACT policy conditioned on OpenCV coordinate and orientation feature vectors ($X, Y, \theta$) and compare performance metrics against baseline Behavior Cloning.
4. **Pick Sequence Fault Detection:** Implement vision verification step to detect grasp slip or dropped blocks and trigger safe recovery trajectories.
