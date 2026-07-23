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

---

## 4. Important Context the Agent Must Remember

1. **The user prefers to build incrementally.** Never jump ahead. Always validate the current step before moving to the next.
2. **The user will push back if I get ahead of myself.** I was corrected for writing `robot_driver.ino` before even testing the servos. Respect the user's pace.
3. **The user thinks like an engineer.** They caught that mounting the elbow horizontally at 90° would waste half the range of motion. They also correctly identified this is NOT an EEZYbotARM MK2 (it's a true 6-DOF serial arm). Take their mechanical intuition seriously.
4. **The arm is NOT assembled yet.** I am waiting for: (a) the user to flash the calibration script, (b) physically assemble the arm, (c) provide the 4 link measurements (L1–L4), and (d) describe the Home Pose.
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
- User corrected me for jumping ahead to `robot_driver.ino` before testing servos.
- User corrected me that this is NOT an MK2 arm (it's true 6-DOF).
- Discussed optimal assembly angles: mount at midpoint of mechanical range, not necessarily 90° = straight up.
- Discussed sponge blocks with cardboard-backed ArUco markers.
- Clarified Camera 2 (side) is only for dataset recording, not for the neural network.
- Created and updated the project synopsis (markdown version).
- Added block diagram and flowchart (Mermaid) — user was unhappy with Mermaid rendering quality.
- Provided prompts for external tools (Manus AI for PPT, image generators for setup render).

### Session 2 (2026-07-16)
- User requested PPT generation prompt for Manus AI.
- User requested image generation prompt for setup visualization.
- Iteratively refined the image prompt (added boxes, electronics, proper wiring).

### Session 3 (2026-07-23) — CURRENT
- User requested a web-based dashboard for the entire project lifecycle.
- Proposed 8 dashboard modules: Robot Control, Camera Feeds, Perception, Teleoperation, Dataset, Training, Autonomous Execution, System Health.
- User approved web-based approach (HTML/CSS/JS + Python WebSocket backend).
- Resolved open questions: Arduino CLI for port management, no auth, laptop+tablet only.
- Created `architecture.md`, `agent_bible.md`, `decisions.md`, `.gemini/rules.md`.
- Created `ps5_controller_test.html` — User tested and confirmed PS5 controller teleoperation via browser Gamepad API is 100% working.
- Configured GitHub remote & created classic PAT authentication. Successfully pushed project to `https://github.com/SohamBhavsar24/vision-autonomous-robotic-arm.git`.
- Dashboard Implementation Plan created & finalized. Ready for Phase A build.

---

## 6. Next Steps (Immediate)

1. **Physical Hardware Assembly** — Flash calibration sketch (`servo_calibration.ino`) → assemble 6-DOF arm at midpoint angles → measure links (L1–L4).
2. **Write IK Solver** — Implement Python Cartesian IK solver once physical link measurements are provided by user.
3. **Dashboard Phase A Build** — Build control interface (FastAPI + WebSocket + Servo Control Panel).

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
