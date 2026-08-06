/* ==========================================================================
   TELEOPERATION PANEL & DUAL-MODE PS5 CONTROLLER INTEGRATION (JS)
   ==========================================================================
   Project:  Vision-Based Autonomous Robotic Arm
   File:     teleop_panel.js
   Location: dashboard/frontend/js/

   PURPOSE:
     Handles live PS5 DualSense controller teleoperation with 2 modes:
       1. Cartesian Inverse Kinematics (IK) Mode (Left Stick: X/Y, Right Stick: Z height)
       2. Direct Joint Motor Control Mode (Left Stick: Base/Shoulder, Right Stick: Elbow)
     Includes dynamic game-style controller mapping diagram switching.
   ========================================================================== */

const TeleopPanel = {
  gamepadIndex: null,
  animFrameId: null,
  activeMode: 'ik', // 'ik' or 'joint'
  isGripperLocked: false,
  targetGripperAngle: 90,

  buttonNames: [
    'Cross (×)', 'Circle (○)', 'Square (□)', 'Triangle (△)',
    'L1', 'R1', 'L2', 'R2',
    'Share', 'Options', 'L3', 'R3',
    'D-Pad ↑', 'D-Pad ↓', 'D-Pad ←', 'D-Pad →',
    'PS', 'Touchpad'
  ],

  init() {
    this.cacheDOM();
    this.buildButtonIndicators();
    this.bindEvents();
    this.startLoop();
    this.loadKinematicsConfig();
    this.updateModeUI();
  },

  cacheDOM() {
    this.statusPill = document.getElementById('ps5StatusPill');
    this.statusText = document.getElementById('ps5StatusText');
    this.leftDot = document.getElementById('ps5LeftDot');
    this.rightDot = document.getElementById('ps5RightDot');
    this.leftVal = document.getElementById('ps5LeftVal');
    this.rightVal = document.getElementById('ps5RightVal');
    this.l2Fill = document.getElementById('ps5L2Fill');
    this.r2Fill = document.getElementById('ps5R2Fill');
    this.l1Fill = document.getElementById('ps5L1Fill');
    this.r1Fill = document.getElementById('ps5R1Fill');
    this.l2Val = document.getElementById('ps5L2Val');
    this.r2Val = document.getElementById('ps5R2Val');
    this.l1Val = document.getElementById('ps5L1Val');
    this.r1Val = document.getElementById('ps5R1Val');
    this.buttonsGrid = document.getElementById('ps5ButtonsGrid');
    this.axesList = document.getElementById('ps5AxesList');
    this.btnSaveKinematics = document.getElementById('btnSaveKinematics');

    // Teleop Mode Switcher DOM elements
    this.btnToggleMode = document.getElementById('btnToggleTeleopMode');
    this.lblModeBtnText = document.getElementById('lblModeBtnText');
    this.lblDiagramTitle = document.getElementById('lblDiagramTitle');
    this.lblActiveModePill = document.getElementById('lblActiveModePill');
    this.lblDiagramSubtitle = document.getElementById('lblDiagramSubtitle');
    this.imgControllerDiagram = document.getElementById('imgControllerDiagram');
    this.cardArchitectureNotes = document.getElementById('cardArchitectureNotes');

    if (this.axesList) {
      this.axesList.innerHTML = '<div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); padding: 12px 0;">No controller connected.<br>Press any button on PS5 DualSense to display live axes.</div>';
    }
  },

  buildButtonIndicators() {
    if (!this.buttonsGrid) return;
    this.buttonsGrid.innerHTML = '';
    this.buttonNames.forEach((name, i) => {
      const div = document.createElement('div');
      div.className = 'btn-indicator';
      div.id = `ps5Btn${i}`;
      div.textContent = name;
      this.buttonsGrid.appendChild(div);
    });
  },

  bindEvents() {
    if (this.btnSaveKinematics) {
      this.btnSaveKinematics.addEventListener('click', () => this.saveKinematicsConfig());
    }

    if (this.btnToggleMode) {
      this.btnToggleMode.addEventListener('click', () => this.toggleMode());
    }

    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
      if (this.statusPill && this.statusText) {
        this.statusPill.className = 'status-pill connected';
        this.statusText.textContent = `Connected: ${e.gamepad.id}`;
      }
      App.log(`PS5 Controller Connected: ${e.gamepad.id}`);
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      if (e.gamepad.index === this.gamepadIndex) {
        this.gamepadIndex = null;
        if (this.statusPill && this.statusText) {
          this.statusPill.className = 'status-pill';
          this.statusText.textContent = 'PS5 Controller Disconnected';
        }
        App.log('PS5 Controller Disconnected.');
      }
    });
  },

  toggleMode() {
    this.activeMode = this.activeMode === 'ik' ? 'joint' : 'ik';
    this.cacheDOM();
    this.updateModeUI();
    if (window.App && App.log) {
      App.log(`Switched Teleoperation Mode to: ${this.activeMode === 'ik' ? 'Cartesian IK Mode' : 'Direct Joint Motor Control Mode'}`);
    }
  },

  updateModeUI() {
    if (this.activeMode === 'ik') {
      if (this.lblModeBtnText) this.lblModeBtnText.textContent = 'Direct Joint Control';
      if (this.lblDiagramTitle) this.lblDiagramTitle.textContent = 'Cartesian Inverse Kinematics (IK) Teleoperation Diagram';
      if (this.lblActiveModePill) {
        this.lblActiveModePill.textContent = 'Active Mode: Cartesian IK';
        this.lblActiveModePill.className = 'status-pill connected';
      }
      if (this.lblDiagramSubtitle) this.lblDiagramSubtitle.textContent = 'Left Stick: X/Y Translation • Right Stick: Z Height • Triggers: Gripper Close/Lock';
      if (this.imgControllerDiagram) this.imgControllerDiagram.src = 'img/ps5_controller_ik_mode.jpg';
    } else {
      if (this.lblModeBtnText) this.lblModeBtnText.textContent = 'Cartesian IK Mode';
      if (this.lblDiagramTitle) this.lblDiagramTitle.textContent = 'Direct Joint Motor Control Teleoperation Diagram';
      if (this.lblActiveModePill) {
        this.lblActiveModePill.textContent = 'Active Mode: Direct Joint Control';
        this.lblActiveModePill.className = 'status-pill';
      }
      if (this.lblDiagramSubtitle) this.lblDiagramSubtitle.textContent = 'Left Stick: Base & Shoulder Servos • Right Stick: Elbow Servo • Triggers: Gripper Close/Lock';
      if (this.imgControllerDiagram) this.imgControllerDiagram.src = 'img/ps5_controller_joint_mode.jpg';
    }
  },

  async loadKinematicsConfig() {
    try {
      const res = await fetch('/api/kinematics');
      if (!res.ok) return;
      const cfg = await res.json();
      
      const l1 = document.getElementById('inputL1');
      const l2 = document.getElementById('inputL2');
      const l3 = document.getElementById('inputL3');
      const l4 = document.getElementById('inputL4');
      const gc = document.getElementById('angleGripperClosed');
      const go = document.getElementById('angleGripperOpen');

      if (l1 && cfg.L1) l1.value = cfg.L1;
      if (l2 && cfg.L2) l2.value = cfg.L2;
      if (l3 && cfg.L3) l3.value = cfg.L3;
      if (l4 && cfg.L4) l4.value = cfg.L4;
      if (gc && cfg.gripper_closed) gc.value = cfg.gripper_closed;
      if (go && cfg.gripper_open) go.value = cfg.gripper_open;

      if (cfg.offsets) {
        for (let i = 0; i < 5; i++) {
          const el = document.getElementById(`offsetServo${i}`);
          if (el) el.value = cfg.offsets[i] || 0;
        }
      }
    } catch (e) {
      console.warn('Could not load kinematics config:', e);
    }
  },

  async saveKinematicsConfig() {
    const l1 = parseFloat(document.getElementById('inputL1')?.value || 10.0);
    const l2 = parseFloat(document.getElementById('inputL2')?.value || 14.0);
    const l3 = parseFloat(document.getElementById('inputL3')?.value || 12.0);
    const l4 = parseFloat(document.getElementById('inputL4')?.value || 8.0);
    const gc = parseInt(document.getElementById('angleGripperClosed')?.value || 10, 10);
    const go = parseInt(document.getElementById('angleGripperOpen')?.value || 90, 10);

    const offsets = [];
    for (let i = 0; i < 5; i++) {
      offsets.push(parseInt(document.getElementById(`offsetServo${i}`)?.value || 0, 10));
    }

    try {
      const res = await fetch('/api/kinematics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ L1: l1, L2: l2, L3: l3, L4: l4, offsets, gripper_closed: gc, gripper_open: go })
      });
      if (res.ok) {
        App.log(`Saved Kinematic Calibration: L1=${l1}cm, L2=${l2}cm, L3=${l3}cm, L4=${l4}cm`);
      }
    } catch (e) {
      App.log(`Failed to save kinematic calibration: ${e.message}`);
    }
  },

  applyDeadzone(val, deadzone = 0.08) {
    return Math.abs(val) < deadzone ? 0 : val;
  },

  startLoop() {
    const update = () => {
      if (this.gamepadIndex !== null) {
        const gp = navigator.getGamepads()[this.gamepadIndex];
        if (gp) {
          this.updateSticks(gp);
          this.updateTriggers(gp);
          this.updateButtons(gp);
          this.updateAxes(gp);
          this.processControlInputs(gp);
        }
      }
      this.animFrameId = requestAnimationFrame(update);
    };
    update();
  },

  updateSticks(gp) {
    const lx = this.applyDeadzone(gp.axes[0] || 0);
    const ly = this.applyDeadzone(gp.axes[1] || 0);
    const rx = this.applyDeadzone(gp.axes[2] || 0);
    const ry = this.applyDeadzone(gp.axes[3] || 0);

    const maxOffset = 50;
    if (this.leftDot) {
      this.leftDot.style.left = `calc(50% + ${lx * maxOffset}px)`;
      this.leftDot.style.top = `calc(50% + ${ly * maxOffset}px)`;
    }
    if (this.rightDot) {
      this.rightDot.style.left = `calc(50% + ${rx * maxOffset}px)`;
      this.rightDot.style.top = `calc(50% + ${ry * maxOffset}px)`;
    }

    if (this.leftVal) this.leftVal.textContent = `X: ${lx.toFixed(2)} Y: ${ly.toFixed(2)}`;
    if (this.rightVal) this.rightVal.textContent = `X: ${rx.toFixed(2)} Y: ${ry.toFixed(2)}`;
  },

  updateTriggers(gp) {
    const l2 = gp.buttons[6] ? gp.buttons[6].value : 0;
    const r2 = gp.buttons[7] ? gp.buttons[7].value : 0;
    const l1 = gp.buttons[4] ? gp.buttons[4].value : 0;
    const r1 = gp.buttons[5] ? gp.buttons[5].value : 0;

    if (this.l2Fill) this.l2Fill.style.width = `${l2 * 100}%`;
    if (this.r2Fill) this.r2Fill.style.width = `${r2 * 100}%`;
    if (this.l1Fill) this.l1Fill.style.width = `${l1 * 100}%`;
    if (this.r1Fill) this.r1Fill.style.width = `${r1 * 100}%`;

    if (this.l2Val) this.l2Val.textContent = `${Math.round(l2 * 100)}%`;
    if (this.r2Val) this.r2Val.textContent = `${Math.round(r2 * 100)}%`;
    if (this.l1Val) this.l1Val.textContent = `${Math.round(l1 * 100)}%`;
    if (this.r1Val) this.r1Val.textContent = `${Math.round(r1 * 100)}%`;
  },

  updateButtons(gp) {
    for (let i = 0; i < Math.min(gp.buttons.length, this.buttonNames.length); i++) {
      const el = document.getElementById(`ps5Btn${i}`);
      if (el) {
        if (gp.buttons[i].pressed) {
          el.style.backgroundColor = 'var(--accent-primary)';
          el.style.borderColor = 'var(--accent-primary)';
          el.style.color = '#FAF7F2';
        } else {
          el.style.backgroundColor = 'var(--bg-page)';
          el.style.borderColor = 'var(--border-subtle)';
          el.style.color = 'var(--text-muted)';
        }
      }
    }
  },

  updateAxes(gp) {
    if (!this.axesList) return;
    if (this.axesList.children.length !== gp.axes.length) {
      this.axesList.innerHTML = '';
      for (let i = 0; i < gp.axes.length; i++) {
        const row = document.createElement('div');
        row.className = 'axis-row';
        row.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-bottom: 6px;';
        row.innerHTML = `
          <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); width: 50px;">Axis ${i}</span>
          <div style="flex: 1; height: 8px; background: var(--bg-page); border: 1px solid var(--border-subtle); border-radius: 4px; overflow: hidden; position: relative;">
            <div id="ps5AxisBar${i}" style="position: absolute; height: 100%; background: var(--accent-primary); transition: all 0.05s linear;"></div>
          </div>
          <span id="ps5AxisVal${i}" style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-main); width: 45px; text-align: right;">0.00</span>
        `;
        this.axesList.appendChild(row);
      }
    }

    for (let i = 0; i < gp.axes.length; i++) {
      const val = gp.axes[i];
      const pct = ((val + 1) / 2) * 100;
      const bar = document.getElementById(`ps5AxisBar${i}`);
      const valEl = document.getElementById(`ps5AxisVal${i}`);
      if (bar) {
        bar.style.left = val >= 0 ? '50%' : `${pct}%`;
        bar.style.width = `${Math.abs(val) * 50}%`;
      }
      if (valEl) valEl.textContent = val.toFixed(2);
    }
  },

  processControlInputs(gp) {
    // Check Gripper Lock Button (L2)
    const l2Btn = gp.buttons[6];
    if (l2Btn && l2Btn.pressed) {
      this.isGripperLocked = true;
    }

    // Gripper R2 Trigger Control
    const r2Val = gp.buttons[7] ? gp.buttons[7].value : 0;
    if (!this.isGripperLocked) {
      if (r2Val > 0.05) {
        // Slowly close gripper from 90° down towards 10°
        this.targetGripperAngle = Math.max(10, Math.round(90 - (r2Val * 80)));
      } else {
        this.targetGripperAngle = 90; // Open position
      }
    }

    const currentAngles = [...ServoPanel.currentAngles];
    currentAngles[5] = this.targetGripperAngle;

    // Wrist Roll (R1 / L1)
    const r1Pressed = gp.buttons[5] && gp.buttons[5].pressed;
    const l1Pressed = gp.buttons[4] && gp.buttons[4].pressed;
    if (r1Pressed) {
      currentAngles[4] = Math.min(180, currentAngles[4] + 1); // Wrist Roll CW
    } else if (l1Pressed) {
      currentAngles[4] = Math.max(0, currentAngles[4] - 1);  // Wrist Roll CCW
    }

    // Wrist Pitch (Cross X / Circle O)
    const xPressed = gp.buttons[0] && gp.buttons[0].pressed;
    const circlePressed = gp.buttons[1] && gp.buttons[1].pressed;
    if (xPressed) {
      currentAngles[3] = Math.min(180, currentAngles[3] + 1); // Wrist Pitch Up
    } else if (circlePressed) {
      currentAngles[3] = Math.max(0, currentAngles[3] - 1);  // Wrist Pitch Down
    }

    if (this.activeMode === 'joint') {
      // Direct Joint Motor Control Mode
      const lx = this.applyDeadzone(gp.axes[0] || 0); // Base Servo (Ch 0)
      const ly = this.applyDeadzone(gp.axes[1] || 0); // Shoulder Servo (Ch 1)
      const ry = this.applyDeadzone(gp.axes[3] || 0); // Elbow Servo (Ch 2)

      if (Math.abs(lx) > 0) {
        currentAngles[0] = Math.max(0, Math.min(180, Math.round(90 + (lx * 90))));
      }
      if (Math.abs(ly) > 0) {
        currentAngles[1] = Math.max(0, Math.min(180, Math.round(90 + (ly * 90))));
      }
      if (Math.abs(ry) > 0) {
        currentAngles[2] = Math.max(0, Math.min(180, Math.round(90 + (ry * 90))));
      }

      ServoPanel.setAngles(currentAngles);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  TeleopPanel.init();
});
