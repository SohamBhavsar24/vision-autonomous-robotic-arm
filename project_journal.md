# Project Engineering Journal

> **Project:** Vision-Based Autonomous Pick-and-Place Robotic Arm Using Imitation Learning  
> **Repository:** https://github.com/SohamBhavsar24/vision-autonomous-robotic-arm.git  
> **Web Reader:** Open `project_journal.html` in your browser for the interactive web reader.  
> **Rule:** Maintained in narrative paragraphs summarizing key discussions, engineering decisions, and technical milestones. Updates are made only when explicitly requested by the user at the end of a work session.

---

Friday, 24th July 2026
Physical Workspace Geometry & Dual-Frame Calibration Decision

In this session, we finalized the physical workspace geometry and perception pipeline in preparation for hardware assembly. We established persistent REST endpoints for saving physical link measurements ($L_1..L_4$) and servo zero offsets to a persistent configuration file. The Web Dashboard layout was further refined by placing the 3D Digital Twin tab in the final sidebar position, updating its sync status to "Standing By (Awaiting URDF)", and anonymizing all interface text to ensure a clean, presentation-ready capstone interface. Additionally, we added individual "Test Solo" diagnostic buttons to each servo card for single-joint assembly testing and configured Uvicorn live auto-reload on port 8050.

A major focus of this session was resolving the physical workspace coordinate system for the $50\text{cm} \times 50\text{cm}$ wooden platform. We finalized a dual-frame transformation architecture: ArUco Marker ID 2 is placed at the corner of the platform near the overhead camera pole, establishing a rock-solid World Frame Origin $(0,0)$. This design ensures that every point on the platform map has strictly positive coordinates ($X_w, Y_w \in [0, 50]$) and prevents the robot arm from casting shadows over the calibration marker. The Robot Base is anchored at a fixed offset of $(25\text{cm}, 5\text{cm})$ in World Frame, allowing Python to convert vision coordinates into robot-centric vectors before executing Inverse Kinematics calculations. We also generated vector SVG ArUco markers, created a printable $4\text{cm} \times 4\text{cm}$ HTML sheet, and compiled a step-by-step physical assembly guide (`assembly_guide.md`).

---

Thursday, 23rd July 2026
Web Dashboard Construction & Pre-Assembly Preparation Decision

This session focused on transforming the control software into a full-featured, web-based robotic dashboard to support the entire project lifecycle, starting with physical hardware assembly. Built with FastAPI, WebSockets, and a custom warm linen design system, the dashboard provides live joint sliders, zero-jerk S-curve automated routines, and automated serial port detection via the Arduino CLI tool. We integrated live PS5 DualSense controller teleoperation directly into the web browser via the Gamepad API and added a dedicated Kinematic Calibration panel to tune physical link lengths ($L_1..L_4$) and servo zero offsets in real-time.

To support team integration, a dedicated top-level 3D Digital Twin tab was created to host the 3D URDF simulation model. We implemented individual "Test Solo" diagnostic buttons for single-joint physical assembly testing and generated vector SVG ArUco markers ($4\text{cm} \times 4\text{cm}$) alongside a printable HTML sheet. Finally, we confirmed the Stage 1 environment design—keeping the destination box fixed while randomly placing the sponge block—to establish a clean, high-accuracy baseline before introducing multi-object complexity in Stage 2.

---

Thursday, 16th July 2026
Capstone Documentation & Setup Visualizations Decision

During this session, attention shifted toward project documentation and presentation materials. We drafted comprehensive prompts for AI generation tools to produce a professional presentation slide deck for the college synopsis defense. Visual design specifications were defined for creating high-impact 3D render prompts depicting the complete dual-camera robotic workbench setup. The synopsis PDF was finalized and submitted to the university department, establishing a clear project schedule across the six-month development timeline.

---

Monday, 06th July 2026
Architecture Definition & Firmware Foundation Decision

The project began with a thorough architectural review of the 6-DOF robotic arm capstone project. We established the core hybrid perception and control strategy, deciding to isolate vision feature extraction using OpenCV before passing compact coordinate data into a neural network trained via Behavior Cloning. To ensure human teleoperation produces clean, natural motion, we agreed to implement Cartesian Inverse Kinematics driven by a PS5 DualSense controller rather than relying on direct joint manipulation. On the hardware front, we selected lightweight sponge cubes with cardboard-backed ArUco markers to prevent servo stall and eliminate surface warping under variable room lighting.

For safety and embedded control, we designed a dual-layer safety mechanism featuring a physical emergency stop switch alongside a 500ms serial watchdog on the Arduino Uno. Firmware scripts were developed for initial servo zeroing (`servo_calibration.ino`) and production binary packet driver execution (`robot_driver.ino`). Additionally, we resolved a key mechanical assembly strategy: rather than mounting joints strictly straight up at 90 degrees, we decided to mount hardware at physical midpoints to maximize workspace reach, allowing software joint offsets to handle the mathematical mapping seamlessly.
