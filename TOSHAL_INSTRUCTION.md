# TOSHAL_INSTRUCTION.md — ROS 2 Digital Twin Master Execution Guide

> **ATTENTION AI AGENT (FOR TOSHAL):** 
> You are acting as Toshal's lead ROS 2 Simulation and CAD Digital Twin Engineer for the **Vision-Based Autonomous Pick-and-Place Robotic Arm** Capstone Project.
> 
> **YOUR INSTRUCTION:** Read this document completely. Do NOT ask Toshal to design math, CAD specs, or write code manually. You have full context and end-to-end specifications below. Execute the work in step-by-step phases. After completing each step, automatically prompt Toshal with: `"Step X complete! Click Proceed/Next to execute Step X+1."`

---

## 1. Project Background & System Architecture

This project is a 6-DOF vision-guided autonomous pick-and-place robotic arm operating on a $50\text{cm} \times 50\text{cm}$ wooden platform workspace.

### Core Hardware Specifications:
- **Robot Arm:** 6-DOF Articulated Manipulator (Base, Shoulder, Elbow, Wrist Pitch, Wrist Roll, Gripper).
- **Actuators & Servos:**
  - **Joints 1–4 (Base, Shoulder, Elbow, Wrist Pitch):** TowerPro MG996R High-Torque Metal Gear Servos ($11\text{kg}\cdot\text{cm}$ torque, $0^\circ \text{ to } 180^\circ$ operating range, midpoint $90^\circ$).
  - **Joints 5–6 (Wrist Roll, Gripper):** SG90 / MG90S Micro Servos ($2\text{kg}\cdot\text{cm}$ torque, $0^\circ \text{ to } 180^\circ$ operating range).
  - **Gripper Calibration:** $10^\circ$ = Fully Closed, $90^\circ$ = Fully Open.
- **Physical Workspace Geometry:**
  - **Platform:** $50\text{cm} \times 50\text{cm}$ ($0.5\text{m} \times 0.5\text{m}$) wooden board.
  - **World Origin Frame $(0,0,0)$:** Positioned at ArUco Marker ID 2 at the bottom-left corner of the wooden board near the camera pole.
  - **Robot Base Position:** Mounted at $(X = 25\text{cm}, Y = 5\text{cm}, Z = 0)$ relative to World Origin $(0,0)$.
  - **Camera Setup:** Overhead Logitech USB Camera mounted on a vertical pole at $(X = 25\text{cm}, Y = 25\text{cm}, Z = 60\text{cm})$ looking straight down at the platform.

### Target Perception & Stages:
- **Stage 1 (ArUco Perception):**
  - Sponge block ($4\text{cm} \times 4\text{cm} \times 4\text{cm}$) with ArUco Marker ID 0 on top (cardboard-backed for flatness).
  - Destination box ($10\text{cm} \times 10\text{cm} \times 5\text{cm}$) with ArUco Marker ID 1 at fixed corner $(X = 40\text{cm}, Y = 35\text{cm})$.
  - World Reference Marker ID 2 at corner $(X = 0, Y = 0)$.
- **Stage 2 & 3 (Color Perception):**
  - Colored sponge blocks (Red, Blue, Green) tracked via HSV color thresholding.
  - Color-coded target destination boxes.

---

## 2. Your Mission: Build the Complete ROS 2 Digital Twin Package

You will build a production-grade ROS 2 package (`robotic_arm_description` + `robotic_arm_gazebo` + `robotic_arm_moveit_config`) for ROS 2 Humble / Iron / Jazzy.

### Key Deliverables:
1. **URDF / Xacro Model (`robotic_arm.urdf.xacro`):**
   - Exact 6-DOF kinematic tree with link visual meshes, collision geometries, mass/inertia tensors, and joint limits ($0 \text{ to } \pi$ radians).
   - Servo compatibility tags for MG996R (Joints 1–4) and MG90S (Joints 5–6).
   - `ros2_control` hardware interface tags for PositionController.
2. **Gazebo World File (`platform_workbench.world`):**
   - $50\text{cm} \times 50\text{cm}$ wooden platform board with ArUco Marker ID 2 texture at corner $(0,0)$.
   - Overhead camera pole at $(25\text{cm}, 25\text{cm}, 60\text{cm})$ with `<sensor type="camera">` streaming to ROS 2 topic `/camera/color/image_raw`.
   - Destination box with ArUco Marker ID 1.
   - Sponge block with ArUco Marker ID 0 (and Stage 3 color block variants).
3. **MoveIt 2 Kinematic Configuration (`robotic_arm_moveit_config`):**
   - Planning groups: `arm_group` (Joints 1–5) and `gripper_group` (Joint 6).
   - Kinematic solver: KDL / TRAC-IK.
4. **WebSocket Bridge (`rosbridge_suite`):**
   - Launch `rosbridge_websocket` on port `9090` so the team's Web Dashboard (`http://localhost:8050`) connects to ROS 2 topics `/joint_states`, `/cmd_joints`, and `/tf` over WebSockets to render the 3D twin live!

---

## 3. Step-by-Step Execution Plan for AI Agent

AI Agent: Execute these steps sequentially.

### STEP 1: Package Creation & Folder Structure
Create a ROS 2 workspace package named `robotic_arm_bringup` with sub-folders:
```
robotic_arm_bringup/
├── CMakeLists.txt
├── package.xml
├── urdf/
│   ├── robotic_arm.urdf.xacro
│   ├── ros2_control.xacro
│   └── materials.xacro
├── worlds/
│   └── platform_workbench.world
├── launch/
│   ├── display.launch.py
│   ├── gazebo.launch.py
│   └── moveit_rosbridge.launch.py
└── config/
    ├── joint_controllers.yaml
    └── moveit_config.yaml
```

### STEP 2: Write `robotic_arm.urdf.xacro`
- Define 6 revolute joints: `joint_base`, `joint_shoulder`, `joint_elbow`, `joint_wrist_pitch`, `joint_wrist_roll`, `joint_gripper`.
- Set joint upper/lower limits to $[0, 3.14159]$ radians ($0^\circ \text{ to } 180^\circ$).
- Map MG996R servo dynamics (max effort $= 1.1 \text{ Nm}$, max velocity $= 3.0 \text{ rad/s}$) to Joints 1–4.
- Map MG90S servo dynamics (max effort $= 0.2 \text{ Nm}$, max velocity $= 4.5 \text{ rad/s}$) to Joints 5–6.
- Add `<sensor type="camera" name="overhead_logitech">` positioned overhead at $(0, 0.20, 0.60)$ facing downwards.

### STEP 3: Build Gazebo Simulation World (`platform_workbench.world`)
- Define platform plane $0.5\text{m} \times 0.5\text{m} \times 0.02\text{m}$ with wood texture.
- Add ArUco ID 2 texture at corner $(0,0)$.
- Add Destination Box at $(0.40, 0.35, 0.025)$ with ArUco ID 1 texture.
- Add Sponge Block $0.04\text{m} \times 0.04\text{m} \times 0.04\text{m}$ at $(0.25, 0.25, 0.02)$ with ArUco ID 0 on top.
- Include Stage 3 Red, Blue, and Green colored sponge block SDF models.

### STEP 4: Configure `rosbridge_suite` & Dashboard Bridge
- Add `rosbridge_websocket` launch configuration to broadcast `/joint_states` and `/tf` over WebSocket port `9090`.

### STEP 5: Generate Verification & Test Script
- Create a test script `test_digital_twin.sh` that launches RViz 2, Gazebo, and `rosbridge`.

---

## 4. Summary Prompt for Toshal

Toshal, simply copy this file into your workspace and tell your AI Agent:

> *"Read `TOSHAL_INSTRUCTION.md` and build the ROS 2 Digital Twin package step-by-step. Start with STEP 1."*
