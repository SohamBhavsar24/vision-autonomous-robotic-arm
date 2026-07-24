# Agent Bible — Project Context & Continuity

> **Purpose:** This file ensures Antigravity never loses project context across sessions.
> **Rule:** This file MUST be updated after every significant conversation or decision.
> **Last Updated:** 2026-07-23 (Session 3 — Dashboard Planning)

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

### Overall Phase: PRE-HARDWARE ASSEMBLY → DASHBOARD PLANNING
- The robot arm has NOT been physically assembled yet.
- Servo calibration firmware is written but not flashed.
- Robot driver firmware is written but not tested.
- No Python code has been written yet.
- Dashboard is in the PLANNING phase (not yet built).
- No link measurements (L1–L4) have been provided by the user yet.
- The synopsis PDF has been completed and submitted.

### What Exists in the Codebase
| File | Status |
|---|---|
| `firmware/servo_calibration/servo_calibration.ino` | ✅ Written, NOT flashed |
| `firmware/robot_driver/robot_driver.ino` | ✅ Written, NOT tested |
| `ps5_controller_test.html` | ✅ Written, tested & validated |
| `start_dashboard.sh` | ✅ Created (one-click launcher) |
| `dashboard/backend/main.py` | ✅ Phase A complete (FastAPI + WS) |
| `dashboard/backend/serial_manager.py` | ✅ Phase A complete (Arduino Serial + E-Stop) |
| `dashboard/backend/requirements.txt` | ✅ Created |
| `dashboard/frontend/index.html` | ✅ Phase A Warm Cream UI shell |
| `dashboard/frontend/css/styles.css` | ✅ Phase A Warm Cream design system |
| `dashboard/frontend/js/app.js` | ✅ Phase A WS & Tab router |
| `dashboard/frontend/js/servo_panel.js` | ✅ Phase A Sliders, Lock 90°, Home, Sweep Test, E-stop |
| `dashboard/frontend/js/teleop_panel.js` | ✅ Phase A Live PS5 DualSense Tester + IK preview |
| `dashboard/README.md` | ✅ Created |
| `architecture.md` | ✅ Written |
| `agent_bible.md` | ✅ This file |
| `decisions.md` | ✅ Written |
| `robotic arm synopsis.pdf` | ✅ Completed, submitted to college |

### What Does NOT Exist Yet
- Physical robot assembly
- Any Python code (teleoperation, perception, dashboard, models)
- IK solver (waiting on physical arm measurements from user)
- Camera calibration
- Dataset
- Trained models
- Digital twin

---

## 3. Locked Engineering Decisions

These decisions have been discussed, debated, and finalized. Do NOT re-question them.

| # | Decision | Details |
|---|---|---|
| 1 | Perception Architecture | Hybrid: OpenCV extracts features → Neural network learns motion only |
| 2 | Stage 1 Perception | ArUco markers on sponge blocks (with cardboard backing for flatness) |
| 3 | Stage 2 Perception | Color & contour detection (HSV thresholding) |
| 4 | Coordinate System | Calibrated real-world coordinates (cm from robot base), NOT pixels |
| 5 | Teleoperation Control | Cartesian IK (PS5 joystick controls X,Y,Z end-effector position) |
| 6 | Serial Protocol | Binary 6-byte packets at 115200 baud, 30 Hz target |
| 7 | Safety | Physical emergency stop switch + 500ms watchdog auto-home on Arduino |
| 8 | Block Material | Sponge cubes (lightweight, prevents gripper stall) |
| 9 | Stage 1 Setup | Box is FIXED, block is randomly placed |
| 10 | Stage 2 Setup | All objects (2 blocks + 2 boxes) randomly placed |
| 11 | Dashboard | Web-based (HTML/CSS/JS + Python WebSocket backend) |
| 12 | Deployment Target | Raspberry Pi 5 (4GB RAM) |
| 13 | Camera 2 Role | Side camera is for dataset logging only; NOT used by the neural network |
| 14 | Home Position Assembly | Mount arm parts to maximize physical workspace range; use joint offsets in software to handle the math (do NOT compromise mechanical range for mathematical convenience) |
| 15 | Arduino Port Management | Use Arduino CLI (`arduino-cli`) for port detection & firmware flashing throughout development; switch to direct pyserial on Raspberry Pi 5 |
| 16 | Dashboard Auth | No authentication — local network only |
| 17 | Dashboard Responsiveness | Laptop + Tablet (min 768px width). Phone NOT supported |
| 18 | Dashboard Theme | Warm light mode — cream/linen/sand palette. NO white, NO dark mode, NO neon/electric colors. Fonts: DM Serif Display (headings), Source Sans 3 (body), IBM Plex Mono (data). NO generic vibe-coded fonts like Inter/Roboto |
| 19 | Assembly Strategy | Build Dashboard Phase A first so it serves as the live interactive tool for testing, locking at 90°, and testing range during physical assembly |
| 20 | Zero-Jerk Motion | All automated joint transitions (Home, Lock 90°, Sweep Test) use Cosine S-Curve trajectory interpolation to eliminate mechanical jerks and current spikes |

---

## 4. Important Context the Agent Must Remember

1. **The user prefers to build incrementally.** Never jump ahead. Always validate the current step before moving to the next.
2. **The user will push back if I get ahead of myself.** Respect the user's pace and engineering intuition.
3. **Dashboard Phase A is an active assembly tool.** The user wants to use the dashboard sliders, "Lock at 90°" button, and "Home" button while physically assembling the 6-DOF arm.
4. **The arm is NOT assembled yet.** We will build Dashboard Phase A first to assist in assembly, then assemble, then measure links (L1–L4).
5. **Variable lighting.** The workspace does NOT have fixed/controlled lighting. This is why ArUco markers are critical for Stage 1.
6. **The synopsis PDF is done.** It has been submitted. The user also created a PPT for it using Manus AI.
7. **The user has 3 team members** with distinct roles: Soham (software/integration), Divyansh (dataset/training), Toshal (CAD/digital twin).
8. **My role:** Act as robotics research supervisor, senior software engineer, embedded systems engineer, CV engineer, and AI researcher. Critically evaluate decisions. Do not just agree.

---

## 5. Conversation History Summary

### Session 1 (2026-07-06)
- Received full project brief from the user.
- Reviewed architecture and raised critical issues: servo feedback problem, perception robustness, coordinate frames, control loop latency.
- **Decisions made:** ArUco for Stage 1, real-world coordinates, IK for teleoperation, emergency stop.
- Wrote `servo_calibration.ino` and `robot_driver.ino`.
- Discussed optimal assembly angles: mount at midpoint of mechanical range, not necessarily 90° = straight up.
- Discussed sponge blocks with cardboard-backed ArUco markers.
- Clarified Camera 2 (side) is only for dataset recording, not for the neural network.

### Session 2 (2026-07-16)
- User requested PPT generation prompt for Manus AI.
- User requested image generation prompt for setup visualization.

### Session 3 (2026-07-23) — CURRENT
- User requested a web-based dashboard for the entire project lifecycle.
- Resolved open questions: Arduino CLI for port management, no auth, laptop+tablet only, warm light theme.
- Created `architecture.md`, `agent_bible.md`, `decisions.md`, `.gemini/rules.md`.
- Created `ps5_controller_test.html` — User tested and confirmed PS5 controller teleoperation via browser Gamepad API is 100% working.
- Configured GitHub remote & classic PAT. Successfully pushed project to `https://github.com/SohamBhavsar24/vision-autonomous-robotic-arm.git`.
- Decision #19: User clarified Dashboard Phase A will be built first as the live physical assembly & testing tool.

---

## 6. Next Steps (Immediate)

1. **Build Dashboard Phase A** — Construct FastAPI backend + WebSockets + Warm light UI shell + Robot Control Panel (6 sliders, Lock at 90°, Home button, E-stop, Arduino CLI port auto-connect).
2. **Physical Hardware Assembly (assisted by Dashboard)** — Connect Arduino + PCA9685, use Dashboard to lock servos at 90°, mount 3D parts at midpoints, test range using dashboard sliders, measure links (L1–L4).
3. **Write IK Solver** — Implement Python Cartesian IK solver once physical link measurements are provided by user.

---

## 7. File Structure (Current)

```
/Users/sohambhavsar/Desktop/Autonomoous arm/
├── architecture.md                        ← System architecture document
├── agent_bible.md                         ← THIS FILE (context continuity)
├── decisions.md                           ← Append-only decision log
├── ps5_controller_test.html              ← PS5 controller test & PoC
├── robotic arm synopsis.pdf               ← Submitted to college
├── firmware/
│   ├── servo_calibration/
│   │   └── servo_calibration.ino          ← Sets all servos to 90° for assembly
│   └── robot_driver/
│       └── robot_driver.ino               ← Production firmware (serial + PCA9685 + watchdog)
└── dashboard/                             ← NOT YET CREATED
```
