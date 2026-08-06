# Agent Bible — Project Context & Continuity

> **Purpose:** This file ensures Antigravity never loses project context across sessions.
> **Rule:** This file MUST be updated after every significant conversation or decision.
> **Last Updated:** 2026-08-07 (Session 6 — Phase C Demonstration Dataset Recording & Replay Live)

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

### Overall Phase: HARDWARE WIRING & ASSEMBLY + PHASE C DATASET LIVE
- **PCA9685 & Arduino Uno Wiring:** Defined exact pinouts (VCC $\to$ 5V, GND $\to$ GND, SDA $\to$ A4, SCL $\to$ A5, Screw Terminals $\to$ External 5V/6V Power Supply, Channels 0–5 $\to$ Servos 1–6).
- **Web Dashboard:** Fully operational (`http://localhost:8050`). Features 6-servo sliders, Lock All at 90°, Solo Test buttons, Emergency Stop, Serial auto-connect, 3D Digital Twin URDF viewport, Supabase-backed Project Journal, Dual Teleoperation Modes (IK vs Velocity Rate Integrator), and **Demonstration Dataset Recording & Trajectory Replay**.
- **Demonstration Dataset Engine (Phase C):** Live on `#panel-dataset`. Supports 30Hz trajectory sampling (`[timestamp, [θ0, θ1, θ2, θ3, θ4, θ5]]`), auto-homing on recording stop, latest-episode-first list ordering, 1-click smooth trajectory playback (`▶️ Play Trajectory`), and episode deletion (`🗑️ Delete`).
- **Journal Backend:** Powered by **Supabase PostgreSQL** (`journal_entries` table) + **Supabase Cloud Storage** (`journal-media` public bucket) with instant 3s auto-sync across mobile PWA and laptop dashboard.
- **ROS 2 Digital Twin Specs:** Master zero-prompt instruction guide `TOSHAL_INSTRUCTION.md` created locally for Toshal's AI agents (includes URDF, Gazebo worlds for Stage 1 ArUco & Stage 3 Color blocks, MoveIt 2, and `rosbridge_suite` WebSocket bridge).

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
| `dashboard/frontend/js/dataset_panel.js` | ✅ Phase C Demonstration Recording (30Hz), Auto-Homing & Smooth Replay |
| `project_journal.html` | ✅ Supabase PostgreSQL & Storage media uploader PWA |
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
| 25 | Phase C Demonstration Dataset | 30Hz trajectory sampling, auto-homing on stop, latest-episode-first list ordering, smooth `▶️ Play Trajectory` replay, and deletion |

---

## 4. Conversation History Summary

### Session 6 (2026-08-06 / 2026-08-07) — COMPLETED
- **Supabase Cloud Database & Storage Upgrade:** Connected `project_journal.html` to Supabase REST API (`https://pzewxynfhrylnqbkkeeq.supabase.co/rest/v1/journal_entries`) and public Storage Bucket (`journal-media`). Added file upload input for PDFs, Word docs, photos, and HTML5 video players.
- **Bluetooth Port Filtering:** Expanded `serial_manager.py` keyword filter to reject virtual macOS Bluetooth audio serial ports (`stone`, `airdopes`, `airpods`, `speaker`, `headset`).
- **Dual Teleoperation Modes:** Implemented **Cartesian IK Mode** vs **Direct Joint Velocity Rate Control Mode** switcher on Web Dashboard Teleoperation tab with zero-dependency inline execution.
- **Velocity-Based Rate Integrator & Button Fixes:** Upgraded PS5 teleoperation to smooth velocity rate integration ($\Delta \theta / \Delta t$) so analog joysticks drive joint travel speed without instant position snapping. Fixed all PS5 buttons (Cross, Circle, L1, R1, L2, R2).
- **Prime Directive (100% Smooth Motion Policy):** Enforced EMA Low-Pass Filtering ($\alpha = 0.25$) with exact endpoint snapping (0°, 10°, 180°) across ALL 6 SERVOS.
- **Phase C Demonstration Dataset Management:** Built full dataset recording & replay system on `#panel-dataset`. Features 30Hz trajectory sampling, auto-homing on stop, latest-first list ordering, `▶️ Play Trajectory` smooth replay, and episode deletion.

---

## 5. Next Steps (Immediate)

1. **Physical Servo Horn Alignment** — Connect Arduino Uno + PCA9685 + 6 Servos, launch local Web Dashboard (`python3 dashboard/backend/main.py`), click **"Lock All at 90°"**, attach plastic servo horns at $90^\circ$, and complete 6-DOF physical arm assembly on $50\text{cm} \times 50\text{cm}$ platform board.
2. **Measure Link Lengths ($L_1..L_4$)** — Measure physical link lengths in centimeters using a ruler and save via Kinematic Calibration panel.
3. **Write `ik_solver.py` & `vision_tracker.py`** — Write Python Cartesian IK solver and OpenCV 30Hz ArUco coordinate tracking pipeline.
