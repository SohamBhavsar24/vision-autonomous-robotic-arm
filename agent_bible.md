# Agent Bible — Project Context & Continuity

> **Purpose:** This file ensures Antigravity never loses project context across sessions.
> **Rule:** This file MUST be updated after every significant conversation or decision.
> **Last Updated:** 2026-08-06 (Session 6 — Supabase Media DB Sync, Dual Teleop Modes & Hardware Assembly Kickoff)

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

### Overall Phase: HARDWARE WIRING & ASSEMBLY (PHASE 1 IN PROGRESS)
- **PCA9685 & Arduino Uno Wiring:** Defined exact pinouts (VCC $\to$ 5V, GND $\to$ GND, SDA $\to$ A4, SCL $\to$ A5, Screw Terminals $\to$ External 5V/6V Power Supply, Channels 0–5 $\to$ Servos 1–6).
- **Web Dashboard:** Fully operational (`http://localhost:8050`). Features 6-servo sliders, Lock All at 90°, Solo Test buttons, Emergency Stop, Serial auto-connect, 3D Digital Twin URDF viewport, Supabase-backed Project Journal, and Dual Teleoperation Modes.
- **Journal Backend:** Powered by **Supabase PostgreSQL** (`journal_entries` table) + **Supabase Cloud Storage** (`journal-media` public bucket) with instant 3s auto-sync across mobile PWA and laptop dashboard. Supports PDFs, Word docs, photos, and HTML5 video players.
- **ROS 2 Digital Twin Specs:** Master zero-prompt instruction guide `TOSHAL_INSTRUCTION.md` created locally for Toshal's AI agents (includes URDF, Gazebo worlds for Stage 1 ArUco & Stage 3 Color blocks, MoveIt 2, and `rosbridge_suite` WebSocket bridge).

### What Exists in the Codebase
| File | Status |
|---|---|
| `firmware/servo_calibration/servo_calibration.ino` | ✅ Written, ready to flash |
| `firmware/robot_driver/robot_driver.ino` | ✅ Written, ready to flash |
| `ps5_controller_test.html` | ✅ Written, tested & validated |
| `start_dashboard.sh` | ✅ One-click launcher |
| `dashboard/backend/main.py` | ✅ FastAPI + WebSockets + Kinematics & Journal REST endpoints |
| `dashboard/backend/serial_manager.py` | ✅ Arduino Serial + Bluetooth Port Filtering + E-Stop |
| `dashboard/frontend/index.html` | ✅ Warm Cream UI shell + Teleop Mode Switcher + Journal App |
| `dashboard/frontend/js/teleop_panel.js` | ✅ Live PS5 DualSense Tester + Dual Modes (IK vs Joint Control) |
| `project_journal.html` | ✅ Supabase PostgreSQL & Storage media uploader PWA |
| `api/journal.js` | ✅ Supabase Serverless API handler |
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
| 5 | Teleoperation Control | Dual Modes: Cartesian IK (PS5 stick controls X,Y,Z) & Direct Joint Control |
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

---

## 4. Conversation History Summary

### Session 6 (2026-08-06) — COMPLETED
- **Supabase Cloud Database & Storage Upgrade:** Connected `project_journal.html` to Supabase REST API (`https://pzewxynfhrylnqbkkeeq.supabase.co/rest/v1/journal_entries`) and public Storage Bucket (`journal-media`). Added file upload input for PDFs, Word docs, photos, and HTML5 video players.
- **PostgREST Key Normalization & Seeding:** Mapped array keys for Supabase PostgREST upserts and seeded all 8 logbook entries (including `Log Book-1.docx` and `logbook2.pdf`).
- **Bluetooth Port Filtering:** Expanded `serial_manager.py` keyword filter to reject virtual macOS Bluetooth audio serial ports (`stone`, `airdopes`, `airpods`, `speaker`, `headset`).
- **ROS 2 Digital Twin Master Execution Guide:** Created `TOSHAL_INSTRUCTION.md` locally (and added to `.gitignore`) containing complete project context, 6-DOF URDF/Xacro specs, MG996R/MG90S motor dynamics, Gazebo `.world` files (Stage 1 ArUco & Stage 3 Color blocks), MoveIt 2 configs, and `rosbridge_suite` WebSocket bridge on port 9090.
- **Dual Teleoperation Modes:** Implemented **Cartesian IK Mode** vs **Direct Joint Motor Control Mode** switcher on Web Dashboard Teleoperation tab with zero-dependency inline execution.
- **PCA9685 Wiring & Servo Horn Lock:** Provided step-by-step wiring guide for Arduino Uno $\leftrightarrow$ PCA9685 $\leftrightarrow$ 5V/6V External Servo Power Supply $\leftrightarrow$ 6 Servos.

---

## 5. Next Steps (Immediate)

1. **Physical Servo Horn Alignment** — Connect Arduino Uno + PCA9685 + 6 Servos, launch local Web Dashboard (`python3 dashboard/backend/main.py`), click **"Lock All at 90°"**, attach plastic servo horns at $90^\circ$, and complete 6-DOF physical arm assembly on $50\text{cm} \times 50\text{cm}$ platform board.
2. **Measure Link Lengths ($L_1..L_4$)** — Measure physical link lengths in centimeters using a ruler and save via Kinematic Calibration panel.
3. **Write `ik_solver.py` & `vision_tracker.py`** — Write Python Cartesian IK solver and OpenCV 30Hz ArUco coordinate tracking pipeline.
