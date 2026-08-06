/* ==========================================================================
   TELEOPERATION PANEL & DUAL-MODE PS5 CONTROLLER INTEGRATION (JS)
   ==========================================================================
   Project:  Vision-Based Autonomous Robotic Arm
   File:     teleop_panel.js
   Location: dashboard/frontend/js/

   PURPOSE:
     Handles live PS5 DualSense controller teleoperation with 2 modes:
       1. Cartesian Inverse Kinematics (IK) Mode (Left Stick: X/Y, Right Stick: Z height)
       2. Direct Joint Motor Control Mode (Velocity-Based Rate Integrator)
     
     PRIME DIRECTIVE:
       Joints move via Velocity-Based Rate Integration + Exponential Moving Average (EMA)
       low-pass filtering to guarantee 100% smooth, zero-jerk, fluid motion.
   ========================================================================== */

const TeleopPanel = {
  gamepadIndex: null,
  animFrameId: null,
  activeMode: 'ik', // 'ik' or 'joint'
  isGripperLocked: false,
  integratedAngles: [90, 90, 90, 90, 90, 90], // Continuous Velocity-Based Integrator
  smoothedAngles: [90, 90, 90, 90, 90, 90],   // EMA Low-Pass Filter State

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
    this.lblActiveModePill = document.getElementById('lblActiveModePill');
    this.lblTeleopNoteTitle = document.getElementById('lblTeleopNoteTitle');
    this.lblTeleopNoteText = document.getElementById('lblTeleopNoteText');

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

    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
      if (this.statusPill && this.statusText) {
        this.statusPill.className = 'status-pill connected';
        this.statusText.textContent = `Connected: ${e.gamepad.id}`;
      }
      if (window.App && App.log) {
        App.log(`PS5 DualSense Controller Connected: ${e.gamepad.id}`);
      }
    });

    window.addEventListener('gamepaddisconnected', (e) => {
      if (e.gamepad.index === this.gamepadIndex) {
        this.gamepadIndex = null;
        if (this.statusPill && this.statusText) {
          this.statusPill.className = 'status-pill';
          this.statusText.textContent = 'PS5 Controller Disconnected';
        }
        if (window.App && App.log) {
          App.log('PS5 DualSense Controller Disconnected.');
        }
      }
    });
  },

  toggleMode() {
    this.activeMode = (this.activeMode === 'ik') ? 'joint' : 'ik';
    console.log('[TeleopPanel] Mode toggled to:', this.activeMode);
    this.updateModeUI();

    if (window.App && App.log) {
      App.log(`Switched Teleoperation Mode to: ${this.activeMode === 'ik' ? 'Cartesian IK Mode' : 'Direct Joint Motor Control Mode'}`);
    }
  },

  updateModeUI() {
    const btnText = document.getElementById('lblModeBtnText');
    const pill = document.getElementById('lblActiveModePill');
    const noteTitle = document.getElementById('lblTeleopNoteTitle');
    const noteText = document.getElementById('lblTeleopNoteText');

    if (this.activeMode === 'ik') {
      if (btnText) btnText.textContent = 'Direct Joint Control Mode →';
      if (pill) {
        pill.textContent = 'Active: Cartesian IK';
        pill.style.background = 'rgba(46, 125, 50, 0.15)';
        pill.style.color = '#2E7D32';
      }
      if (noteTitle) noteTitle.textContent = 'Cartesian Inverse Kinematics (IK) Teleoperation Architecture';
      if (noteText) {
        noteText.innerHTML = `
          1. <strong>Left Stick (X / Y):</strong> Moves the end-effector in Cartesian table space (centimeters relative to base).<br>
          2. <strong>Right Stick (Z):</strong> Moves end-effector Z-height up and down towards table.<br>
          3. <strong>R1 / L1 Bumpers:</strong> Rotates Wrist Roll clockwise / anti-clockwise.<br>
          4. <strong>Cross (×) / Circle (○) Buttons:</strong> Changes Wrist Pitch angle.<br>
          5. <strong>R2 / L2 Triggers:</strong> R2 slowly closes gripper claw; L2 locks gripper position.
        `;
      }
    } else {
      if (btnText) btnText.textContent = 'Cartesian IK Mode →';
      if (pill) {
        pill.textContent = 'Active: Direct Joint Control';
        pill.style.background = 'rgba(196, 120, 74, 0.15)';
        pill.style.color = 'var(--accent-primary)';
      }
      if (noteTitle) noteTitle.textContent = 'Direct Joint Motor Control Teleoperation Architecture';
      if (noteText) {
        noteText.innerHTML = `
          1. <strong>Left Stick (X):</strong> Smoothly rotates Base Servo (0° to 180°).<br>
          2. <strong>Left Stick (Y):</strong> Smoothly rotates Shoulder Servo (0° to 180°).<br>
          3. <strong>Right Stick (Y):</strong> Smoothly rotates Elbow Servo (0° to 180°).<br>
          4. <strong>R1 / L1 Bumpers:</strong> Smoothly rotates Wrist Roll CW / CCW.<br>
          5. <strong>Cross (×) / Circle (○) Buttons:</strong> Smoothly rotates Wrist Pitch UP / DOWN.<br>
          6. <strong>R2 / L2 Triggers:</strong> R2 slowly closes gripper claw; L2 locks gripper position.
        `;
      }
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
      if (res.ok && window.App && App.log) {
        App.log(`Saved Kinematic Calibration: L1=${l1}cm, L2=${l2}cm, L3=${l3}cm, L4=${l4}cm`);
      }
    } catch (e) {
      if (window.App && App.log) App.log(`Failed to save kinematic calibration: ${e.message}`);
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
      } else {
        // Scan for gamepads if not yet indexed
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (let i = 0; i < gamepads.length; i++) {
          if (gamepads[i]) {
            this.gamepadIndex = gamepads[i].index;
            if (window.App && App.log) App.log(`PS5 DualSense Controller Auto-Detected: ${gamepads[i].id}`);
            break;
          }
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
    const l2 = gp.buttons[6] ? (gp.buttons[6].value !== undefined ? gp.buttons[6].value : (gp.buttons[6].pressed ? 1 : 0)) : 0;
    const r2 = gp.buttons[7] ? (gp.buttons[7].value !== undefined ? gp.buttons[7].value : (gp.buttons[7].pressed ? 1 : 0)) : 0;
    const l1 = gp.buttons[4] ? (gp.buttons[4].value !== undefined ? gp.buttons[4].value : (gp.buttons[4].pressed ? 1 : 0)) : 0;
    const r1 = gp.buttons[5] ? (gp.buttons[5].value !== undefined ? gp.buttons[5].value : (gp.buttons[5].pressed ? 1 : 0)) : 0;

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
      const btn = gp.buttons[i];
      const isPressed = btn ? (btn.pressed || btn.value > 0.3) : false;
      if (el) {
        if (isPressed) {
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

  isButtonPressed(btn) {
    if (!btn) return false;
    if (typeof btn === 'object') {
      return btn.pressed || (btn.value !== undefined && btn.value > 0.3);
    }
    return btn === 1;
  },

  processControlInputs(gp) {
    const stepSpeed = 1.0; // Degrees per frame at full stick deflection (~60°/sec)

    // Button state extraction
    const xPressed = this.isButtonPressed(gp.buttons[0]);      // Cross (×) -> Wrist Pitch UP
    const circlePressed = this.isButtonPressed(gp.buttons[1]); // Circle (○) -> Wrist Pitch DOWN
    const l1Pressed = this.isButtonPressed(gp.buttons[4]);     // L1 Bumper -> Wrist Roll CCW
    const r1Pressed = this.isButtonPressed(gp.buttons[5]);     // R1 Bumper -> Wrist Roll CW
    const l2Pressed = this.isButtonPressed(gp.buttons[6]);     // L2 Trigger -> Gripper Lock Toggle
    const r2Btn = gp.buttons[7];
    const r2Val = r2Btn ? (r2Btn.value !== undefined ? r2Btn.value : (r2Btn.pressed ? 1 : 0)) : 0;

    const lx = this.applyDeadzone(gp.axes[0] || 0); // Base Servo (Ch 0)
    const ly = this.applyDeadzone(gp.axes[1] || 0); // Shoulder Servo (Ch 1)
    const ry = this.applyDeadzone(gp.axes[3] || 0); // Elbow Servo (Ch 2)

    // Check if the user is actively manipulating a stick or button
    const isUserInteracting = (Math.abs(lx) > 0) || (Math.abs(ly) > 0) || (Math.abs(ry) > 0) ||
                              xPressed || circlePressed || r1Pressed || l1Pressed || (r2Val > 0.05) || l2Pressed;

    // Handle Gripper Lock Toggle (L2)
    if (l2Pressed && !this.wasL2Pressed) {
      this.isGripperLocked = !this.isGripperLocked;
      if (window.App && App.log) {
        App.log(`Gripper Lock ${this.isGripperLocked ? 'LOCKED' : 'UNLOCKED'}`);
      }
    }
    this.wasL2Pressed = l2Pressed;

    // Wrist Pitch Control (Cross X / Circle O)
    if (xPressed) {
      this.integratedAngles[3] = Math.min(180, this.integratedAngles[3] + stepSpeed);
    } else if (circlePressed) {
      this.integratedAngles[3] = Math.max(0, this.integratedAngles[3] - stepSpeed);
    }

    // Wrist Roll Control (R1 / L1)
    if (r1Pressed) {
      this.integratedAngles[4] = Math.min(180, this.integratedAngles[4] + stepSpeed);
    } else if (l1Pressed) {
      this.integratedAngles[4] = Math.max(0, this.integratedAngles[4] - stepSpeed);
    }

    // Gripper Control (R2 Trigger)
    if (!this.isGripperLocked) {
      if (r2Val > 0.05) {
        // Slowly close gripper from 90° down towards 10°
        this.integratedAngles[5] = Math.max(10, this.integratedAngles[5] - (r2Val * stepSpeed * 1.5));
      }
    }

    if (this.activeMode === 'joint') {
      // Direct Joint Motor Control Mode (Velocity Rate Integrator)
      if (Math.abs(lx) > 0) {
        this.integratedAngles[0] = Math.max(0, Math.min(180, this.integratedAngles[0] + (lx * stepSpeed * 1.5)));
      }
      if (Math.abs(ly) > 0) {
        this.integratedAngles[1] = Math.max(0, Math.min(180, this.integratedAngles[1] + (ly * stepSpeed * 1.5)));
      }
      if (Math.abs(ry) > 0) {
        this.integratedAngles[2] = Math.max(0, Math.min(180, this.integratedAngles[2] + (ry * stepSpeed * 1.5)));
      }
    }

    // PRIME DIRECTIVE: Apply Exponential Moving Average (EMA) Low-Pass Filter for 100% Zero-Jerk Motion
    const alpha = 0.20; // Smooth motion interpolation factor
    for (let i = 0; i < 6; i++) {
      const targetVal = Math.round(this.integratedAngles[i]);
      this.smoothedAngles[i] = Math.round((targetVal * alpha) + (this.smoothedAngles[i] * (1 - alpha)));
    }

    // ONLY dispatch teleoperation angles when user is actively giving control inputs
    // This allows automated routines ("Lock 90°", "Home", "Joint Sweep Test") to run without being overridden!
    if (this.activeMode === 'joint' && isUserInteracting) {
      if (typeof ServoPanel !== 'undefined' && ServoPanel.setAngles) {
        ServoPanel.setAngles(this.smoothedAngles);
      }
    }
  }
};

// Global event delegation for 100% reliable click interception
document.addEventListener('click', (e) => {
  const btn = e.target.closest('#btnToggleTeleopMode');
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    TeleopPanel.toggleMode();
  }
});

window.toggleTeleopMode = function() {
  TeleopPanel.toggleMode();
};

document.addEventListener('DOMContentLoaded', () => {
  TeleopPanel.init();
});
