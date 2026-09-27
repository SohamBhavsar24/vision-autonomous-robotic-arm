/* ==========================================================================
   3D DIGITAL TWIN PANEL (Three.js WebGL Engine)
   ==========================================================================
   Project:  Vision-Based Autonomous Robotic Arm
   File:     digital_twin_panel.js
   Location: dashboard/frontend/js/

   PURPOSE:
     Real-time 3D WebGL digital twin rendering the physical arm structure
     using the 3D CAD STL files (Base, Waist, Arm 01, Arm 02 v3, Arm 03,
     Gripper base, and 2x Gripper 1 claws) with exact hole-to-hole mating
     and interactive digital space positioning controls.
   ========================================================================== */

const DigitalTwinPanel = {
  container: null,
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  gridHelper: null,
  groundMesh: null,
  ringMesh: null,
  isGridVisible: true,
  isLoading: true,

  // Camera Flight & Game Navigation State
  keysPressed: {
    w: false, a: false, s: false, d: false,
    q: false, e: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
    Space: false, Shift: false
  },
  activeNavDirs: {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false
  },
  lastNavTime: null,
  _toastTimer: null,

  // Geofencing & Table Penetration Protection (Zero Kinematics, Pure Three.js 3D Bounds)
  geofenceEnabled: false,
  tableFloorLimitY: 8.0, // mm above ground plane (wood tabletop is at Y=0, pad surface is at Y=1.6)
  lastSafeAngles: null, // Initialized dynamically to [90, 90, 90, 90, 90, openAngle]
  isCollisionTriggered: false,
  collisionAlertTimer: null,
  collisionBanner: null,
  lowestMeshY: 100.0,
  currentClearanceMm: 100.0,
  matCollisionRed: null,
  normalClawMat: null,
  normalBaseMat: null,

  // Kinematic Link Groups (Pivots)
  robotRoot: null,
  baseGroup: null,
  waistGroup: null,
  shoulderGroup: null,
  elbowGroup: null,
  wristPitchGroup: null,
  wristRollGroup: null,
  clawLeftGroup: null,
  clawRightGroup: null,

  // Comprehensive Gripper Claw Config (User-Adjustable in Digital Space)
  clawConfig: {
    // Global Spacing & Placement
    spacingX: 14.0,   // mm from center
    mountY: 60.0,     // mm forward on gripper base
    offsetZ: 0.0,     // mm Z elevation
    restAngle: 0.0,   // radians inward tilt at closed rest
    maxSpread: 0.52,  // radians outward spread when open (~30 deg)

    // Left Claw Fine Transformations
    leftPosX: 0.0,    // mm offset X
    leftPosY: 0.0,    // mm offset Y
    leftPosZ: 0.0,    // mm offset Z
    leftRotX: 0,      // degrees
    leftRotY: 0,      // degrees
    leftRotZ: 0,      // degrees
    leftMirrorX: false,
    leftFlipY: false, // upside down
    leftFlipZ: false,

    // Right Claw Fine Transformations
    rightPosX: 0.0,   // mm offset X
    rightPosY: 0.0,   // mm offset Y
    rightPosZ: 0.0,   // mm offset Z
    rightRotX: 0,     // degrees
    rightRotY: 0,     // degrees
    rightRotZ: 0,     // degrees
    rightMirrorX: false,
    rightFlipY: false, // upside down
    rightFlipZ: false
  },

  // Physical Workspace (25cm x 30cm) & Target Block Tracking Config
  workspaceConfig: {
    widthMm: 300.0,       // 30 cm horizontal width (X)
    depthMm: 250.0,       // 25 cm forward depth (Y in vision, Z in 3D)
    distFromArmCm: 3.8,   // 3.8 cm distance in front of arm base
    baseRadiusMm: 48.5,   // Physical base radius of robotic arm
    gridStepMm: 50.0,     // 5 cm grid squares (6 cols x 5 rows = 30 cells)
    blockSizeMm: 40.0,    // 4 cm cube block
    liveCameraSync: true, // Auto-sync from Camera 1 ArUco perception
    manualXCm: 15.0,      // Manual test X (cm)
    manualYCm: 12.5,      // Manual test Y (cm)
    manualThetaDeg: 0.0   // Manual test theta (deg)
  },

  // Workspace & Target Block Objects
  workspaceGroup: null,
  workspaceMesh: null,
  workspaceEdgeMesh: null,
  blockGroup: null,
  blockMesh: null,
  blockLabelSprite: null,
  labelCanvas: null,
  labelCtx: null,
  labelTexture: null,

  // Live Perception State
  blockPose: {
    x_cm: 15.0,
    y_cm: 12.5,
    theta_deg: 0.0,
    valid: false
  },
  currentBlock3D: {
    x: 0,
    y: 21.5,
    z: 211.5,
    theta: 0
  },
  targetBlock3D: {
    x: 0,
    y: 21.5,
    z: 211.5,
    theta: 0
  },

  // Current and Target Joint Angles (Degrees)
  // [Base θ1, Shoulder θ2, Elbow θ3, Wrist Roll θ4, Wrist Pitch θ5, Gripper θ6]
  currentAngles: [90, 90, 90, 90, 90, 140],
  targetAngles: [90, 90, 90, 90, 90, 140],

  // Exact Kinematic Parameters (mm) matching physical CAD assembly
  BASE_HEIGHT: 56.0,       // Height of Base.STL turntable surface
  SHOULDER_OFFSET: 39.0,   // Shoulder pivot height above waist (L1 = 56 + 39 = 95mm)
  L1: 95.0,                // Base ground to shoulder pivot (9.5 cm)
  L2: 120.0,               // Arm 01: Shoulder to Elbow pivot (12.0 cm)
  L3: 100.0,               // Arm 02 v3: Elbow to Wrist Roll pivot (10.0 cm)
  ARM3_HOLE_DIST: 33.2,    // Arm 03: Distance between bottom and top wall holes (33.2 mm)

  // Meshes dictionary
  meshes: {},

  init() {
    this.container = document.getElementById('digitalTwinViewport');
    if (!this.container) return;

    // Remove existing content
    this.container.innerHTML = '';

    this.createOverlayUI();
    this.createTunerPanel();
    this.loadSavedClawConfig();
    this.loadSavedCameraConfig();
    this.setupKeyboardControls();
    this.initScene();
    this.initLighting();
    this.buildKinematicHierarchy();
    this.buildWorkspace();
    this.buildTargetBlock();
    this.startVisionPolling();
    this.loadModels();
    this.setupResizeObserver();
    this.bindButtons();
    this.initGeofencing();

    const home = this.getHomeAngles();
    this.currentAngles = [...home];
    this.targetAngles = [...home];
    this.lastSafeAngles = [...home];

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  },

  bindButtons() {
    const btnGeofence = document.getElementById('btnDtToggleGeofence');
    if (btnGeofence) {
      btnGeofence.onclick = (e) => {
        e.preventDefault();
        this.toggleGeofence();
      };
    }

    const btnHome = document.getElementById('btnDtHome');
    if (btnHome) {
      btnHome.onclick = (e) => {
        e.preventDefault();
        this.setHomePose();
      };
    }

    const btnToggleGrid = document.getElementById('btnDtToggleGrid');
    if (btnToggleGrid) {
      btnToggleGrid.onclick = (e) => {
        e.preventDefault();
        this.toggleGrid();
      };
    }

    const btnSetDefaultCam = document.getElementById('btnDtSetDefaultCamera');
    if (btnSetDefaultCam) {
      btnSetDefaultCam.onclick = (e) => {
        e.preventDefault();
        this.setDefaultCamera();
      };
    }

    const btnResetCam = document.getElementById('btnDtResetCamera');
    if (btnResetCam) {
      btnResetCam.onclick = (e) => {
        e.preventDefault();
        this.resetCamera();
      };
    }

    const btnTune = document.getElementById('btnDtTune');
    if (btnTune) {
      btnTune.onclick = (e) => {
        e.preventDefault();
        this.toggleTunerPanel();
      };
    }
  },

  createOverlayUI() {
    // Loading indicator overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'dtLoadingOverlay';
    loadingOverlay.style.position = 'absolute';
    loadingOverlay.style.top = '0';
    loadingOverlay.style.left = '0';
    loadingOverlay.style.width = '100%';
    loadingOverlay.style.height = '100%';
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.flexDirection = 'column';
    loadingOverlay.style.alignItems = 'center';
    loadingOverlay.style.justifyContent = 'center';
    loadingOverlay.style.background = 'rgba(26, 24, 23, 0.75)';
    loadingOverlay.style.backdropFilter = 'blur(4px)';
    loadingOverlay.style.zIndex = '10';
    loadingOverlay.style.transition = 'opacity 0.4s ease';
    loadingOverlay.innerHTML = `
      <div style="font-family: var(--font-heading); font-size: 1.1rem; color: #FAF7F2; margin-bottom: 8px;">
        Loading 3D CAD Mesh Models...
      </div>
      <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--accent-primary); background: rgba(196,120,74,0.15); padding: 4px 12px; border-radius: 20px; border: 1px solid var(--accent-primary);">
        Aligning Wall Holes & 6-DOF Kinematics
      </div>
    `;
    this.container.appendChild(loadingOverlay);

    // Viewport telemetry pill overlay (bottom left)
    const telemetryOverlay = document.createElement('div');
    telemetryOverlay.id = 'dtTelemetryBar';
    telemetryOverlay.style.position = 'absolute';
    telemetryOverlay.style.bottom = '16px';
    telemetryOverlay.style.left = '16px';
    telemetryOverlay.style.zIndex = '5';
    telemetryOverlay.style.background = 'rgba(26, 24, 23, 0.85)';
    telemetryOverlay.style.border = '1px solid rgba(224, 214, 200, 0.2)';
    telemetryOverlay.style.padding = '8px 16px';
    telemetryOverlay.style.borderRadius = '8px';
    telemetryOverlay.style.fontFamily = 'var(--font-mono)';
    telemetryOverlay.style.fontSize = '0.75rem';
    telemetryOverlay.style.color = '#FAF7F2';
    telemetryOverlay.style.display = 'flex';
    telemetryOverlay.style.gap = '14px';
    telemetryOverlay.innerHTML = `
      <div>θ1: <span id="dtVal0" style="color: var(--accent-primary); font-weight: 600;">90°</span></div>
      <div>θ2: <span id="dtVal1" style="color: var(--accent-primary); font-weight: 600;">90°</span></div>
      <div>θ3: <span id="dtVal2" style="color: var(--accent-primary); font-weight: 600;">90°</span></div>
      <div>θ4: <span id="dtVal3" style="color: var(--accent-primary); font-weight: 600;">90°</span></div>
      <div>θ5: <span id="dtVal4" style="color: var(--accent-primary); font-weight: 600;">90°</span></div>
      <div>Claw: <span id="dtVal5" style="color: var(--accent-primary); font-weight: 600;">${this.getGripperOpenAngle()}°</span></div>
    `;
    this.container.appendChild(telemetryOverlay);

    // Live ArUco Perception Badge (bottom left, stacked above telemetry bar)
    const blockBadge = document.createElement('div');
    blockBadge.id = 'dtBlockVisionBadge';
    blockBadge.style.position = 'absolute';
    blockBadge.style.bottom = '58px';
    blockBadge.style.left = '16px';
    blockBadge.style.zIndex = '5';
    blockBadge.style.background = 'rgba(26, 24, 23, 0.88)';
    blockBadge.style.border = '1px solid rgba(196, 120, 74, 0.35)';
    blockBadge.style.padding = '5px 12px';
    blockBadge.style.borderRadius = '6px';
    blockBadge.style.fontFamily = 'var(--font-mono)';
    blockBadge.style.fontSize = '0.70rem';
    blockBadge.style.color = '#C4784A';
    blockBadge.style.backdropFilter = 'blur(6px)';
    blockBadge.style.pointerEvents = 'none';
    blockBadge.textContent = 'ArUco Vision: Standby (Camera 1)';
    this.container.appendChild(blockBadge);

    // Viewport helper pill (top right)
    const helperOverlay = document.createElement('div');
    helperOverlay.style.position = 'absolute';
    helperOverlay.style.top = '12px';
    helperOverlay.style.right = '12px';
    helperOverlay.style.zIndex = '5';
    helperOverlay.style.background = 'rgba(26, 24, 23, 0.75)';
    helperOverlay.style.border = '1px solid rgba(224, 214, 200, 0.15)';
    helperOverlay.style.padding = '4px 10px';
    helperOverlay.style.borderRadius = '6px';
    helperOverlay.style.fontFamily = 'var(--font-mono)';
    helperOverlay.style.fontSize = '0.7rem';
    helperOverlay.style.color = '#C4784A';
    helperOverlay.id = 'dtFpsCounter';
    helperOverlay.textContent = 'WebGL 60 FPS • Real-Time Sync';
    this.container.appendChild(helperOverlay);

    // Floating Table Penetration Collision Alert Banner (top center)
    const collisionBanner = document.createElement('div');
    collisionBanner.id = 'dtCollisionBanner';
    collisionBanner.style.position = 'absolute';
    collisionBanner.style.top = '16px';
    collisionBanner.style.left = '50%';
    collisionBanner.style.transform = 'translateX(-50%)';
    collisionBanner.style.background = 'rgba(229, 57, 53, 0.95)';
    collisionBanner.style.color = '#FFFFFF';
    collisionBanner.style.padding = '10px 24px';
    collisionBanner.style.borderRadius = '8px';
    collisionBanner.style.fontFamily = 'var(--font-mono)';
    collisionBanner.style.fontWeight = '700';
    collisionBanner.style.fontSize = '0.85rem';
    collisionBanner.style.boxShadow = '0 4px 20px rgba(229, 57, 53, 0.5)';
    collisionBanner.style.zIndex = '25';
    collisionBanner.style.textAlign = 'center';
    collisionBanner.style.border = '1px solid #FF8A80';
    collisionBanner.style.pointerEvents = 'none';
    collisionBanner.style.display = 'none';
    collisionBanner.style.transition = 'opacity 0.25s ease';
    collisionBanner.innerHTML = 'TABLE PENETRATION DETECTED: REVERTED TO SAFE POSE';
    this.container.appendChild(collisionBanner);
    this.collisionBanner = collisionBanner;

    // Inject styles for Navigation buttons if not already present
    if (!document.getElementById('dtNavStyles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'dtNavStyles';
      styleEl.textContent = `
        .dt-nav-btn {
          background: #3A3531;
          border: 1px solid rgba(224, 214, 200, 0.25);
          border-radius: 4px;
          color: #FAF7F2;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          transition: all 0.15s ease;
          user-select: none;
        }
        .dt-nav-btn:hover {
          background: #4E463E;
          border-color: var(--accent-primary);
        }
        .dt-nav-btn.active, .dt-nav-btn:active {
          background: var(--accent-primary) !important;
          color: #FFFFFF !important;
          border-color: var(--accent-primary) !important;
        }
      `;
      document.head.appendChild(styleEl);
    }

    // Interactive 3D Camera Flight Navigation Widget (Bottom-Right)
    const navHUD = document.createElement('div');
    navHUD.id = 'dtGameNavHUD';
    navHUD.style.position = 'absolute';
    navHUD.style.bottom = '16px';
    navHUD.style.right = '16px';
    navHUD.style.zIndex = '6';
    navHUD.style.background = 'rgba(26, 24, 23, 0.92)';
    navHUD.style.border = '1px solid rgba(224, 214, 200, 0.22)';
    navHUD.style.borderRadius = '8px';
    navHUD.style.padding = '8px 12px';
    navHUD.style.fontFamily = 'var(--font-mono)';
    navHUD.style.color = '#FAF7F2';
    navHUD.style.backdropFilter = 'blur(6px)';
    navHUD.style.userSelect = 'none';
    navHUD.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.35)';

    navHUD.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 0.70rem; color: var(--accent-primary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
        <span>Flight Navigation (WASD)</span>
        <button id="btnDtNavMinimize" style="background: none; border: none; color: #888888; cursor: pointer; font-family: var(--font-mono); font-size: 0.75rem; padding: 0 4px;" title="Toggle Controls">_</button>
      </div>
      <div id="dtNavControlsBody">
        <div style="display: flex; gap: 12px; align-items: center; justify-content: center;">
          <div style="display: grid; grid-template-columns: repeat(3, 28px); grid-template-rows: repeat(2, 28px); gap: 3px; justify-items: center; align-items: center;">
            <div></div>
            <button class="dt-nav-btn" data-dir="forward" id="dtBtnNavW" title="Fly Forward (W / Up Arrow)">W</button>
            <div></div>
            <button class="dt-nav-btn" data-dir="left" id="dtBtnNavA" title="Strafe Left (A / Left Arrow)">A</button>
            <button class="dt-nav-btn" data-dir="backward" id="dtBtnNavS" title="Fly Backward (S / Down Arrow)">S</button>
            <button class="dt-nav-btn" data-dir="right" id="dtBtnNavD" title="Strafe Right (D / Right Arrow)">D</button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <button class="dt-nav-btn" data-dir="up" id="dtBtnNavUp" style="padding: 0 10px; height: 28px; font-size: 0.68rem;" title="Elevate Up (+Y / E key / Space)">▲ Up (E)</button>
            <button class="dt-nav-btn" data-dir="down" id="dtBtnNavDown" style="padding: 0 10px; height: 28px; font-size: 0.68rem;" title="Elevate Down (-Y / Q key)">▼ Down (Q)</button>
          </div>
        </div>
        <div style="display: flex; gap: 6px; margin-top: 8px;">
          <button class="dt-nav-btn" id="dtBtnFocusBlock" style="flex: 1; height: 22px; font-size: 0.65rem;" title="Lock camera orbit to Yellow Sponge Block">Focus Block</button>
          <button class="dt-nav-btn" id="dtBtnFocusArm" style="flex: 1; height: 22px; font-size: 0.65rem;" title="Lock camera orbit to Robot Arm">Focus Arm</button>
        </div>
        <div style="font-size: 0.62rem; color: #888888; margin-top: 6px; line-height: 1.2; text-align: center;">
          WASD: Fly • Drag: Orbit • Scroll: Zoom • Shift: Fast
        </div>
      </div>
    `;
    this.container.appendChild(navHUD);

    // Bind navigation buttons and toggles
    const btnMin = navHUD.querySelector('#btnDtNavMinimize');
    const body = navHUD.querySelector('#dtNavControlsBody');
    if (btnMin && body) {
      btnMin.onclick = () => {
        const isHidden = body.style.display === 'none';
        body.style.display = isHidden ? 'block' : 'none';
        btnMin.textContent = isHidden ? '_' : '+';
      };
    }

    const btnFocusBlock = navHUD.querySelector('#dtBtnFocusBlock');
    if (btnFocusBlock) {
      btnFocusBlock.onclick = (e) => {
        e.preventDefault();
        this.focusOnBlock();
      };
    }

    const btnFocusArm = navHUD.querySelector('#dtBtnFocusArm');
    if (btnFocusArm) {
      btnFocusArm.onclick = (e) => {
        e.preventDefault();
        this.focusOnArm();
      };
    }

    navHUD.querySelectorAll('.dt-nav-btn[data-dir]').forEach(btn => {
      const dir = btn.getAttribute('data-dir');
      this.bindNavButtonHold(btn, dir);
    });
  },

  /* Persistence for Gripper Claw Configuration */
  loadSavedClawConfig() {
    // 1. Synchronously restore from localStorage for instant offline readiness
    try {
      const cached = localStorage.getItem('dt_claw_config');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          Object.assign(this.clawConfig, parsed);
          const tuner = document.getElementById('dtTunerPanel');
          if (tuner) this.syncTunerInputs(tuner);
          this.updateClawPlacements();
        }
      }
    } catch (e) {
      console.warn('Could not read cached claw config from localStorage:', e);
    }

    // 2. Asynchronously sync with backend if available
    fetch('/api/digital_twin/claw_config')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          Object.assign(this.clawConfig, data);
          try {
            localStorage.setItem('dt_claw_config', JSON.stringify(this.clawConfig));
          } catch (e) {}
          const tuner = document.getElementById('dtTunerPanel');
          if (tuner) this.syncTunerInputs(tuner);
          this.updateClawPlacements();
        }
      })
      .catch(() => {
        // Backend offline or unreachable, localStorage fallback already loaded
      });
  },

  /* Persistence for Default Camera Viewport (localStorage + Backend Disk) */
  loadSavedCameraConfig() {
    // 1. Synchronously restore from localStorage for instant offline readiness
    try {
      const cached = localStorage.getItem('dt_camera_default');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.pos && parsed.target) {
          if (this.camera) this.camera.position.set(parsed.pos.x, parsed.pos.y, parsed.pos.z);
          if (this.controls) {
            this.controls.target.set(parsed.target.x, parsed.target.y, parsed.target.z);
            this.controls.update();
          }
        }
      }
    } catch (e) {
      console.warn('Could not read cached camera config from localStorage:', e);
    }

    // 2. Asynchronously sync with backend server disk (survives browser data clearing & restarts)
    fetch('/api/digital_twin/camera_default')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.pos && data.target) {
          localStorage.setItem('dt_camera_default', JSON.stringify(data));
          // If camera was not moved by user yet, update to backend saved viewpoint
          if (this.camera && !this._userMovedCamera) {
            this.camera.position.set(data.pos.x, data.pos.y, data.pos.z);
            if (this.controls) {
              this.controls.target.set(data.target.x, data.target.y, data.target.z);
              this.controls.update();
            }
          }
        }
      })
      .catch(err => {
        console.warn('Could not sync camera_default with backend:', err);
      });
  },

  handleSaveClawConfig() {
    // 1. Persist to localStorage
    try {
      localStorage.setItem('dt_claw_config', JSON.stringify(this.clawConfig));
    } catch (e) {
      console.warn('Could not save claw config to localStorage:', e);
    }

    // 2. Persist to backend JSON
    fetch('/api/digital_twin/claw_config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.clawConfig)
    }).catch(err => {
      console.warn('Could not sync claw config to backend:', err);
    });

    // 3. Visual feedback across both top and bottom save buttons
    const tuner = document.getElementById('dtTunerPanel');
    const btnTop = tuner ? tuner.querySelector('#btnDtSaveClawConfigTop') : null;
    const btnBottom = tuner ? tuner.querySelector('#btnDtSaveClawConfigBottom') : null;
    const statusTop = tuner ? tuner.querySelector('#dtSaveStatusTop') : null;
    const statusBottom = tuner ? tuner.querySelector('#dtSaveStatusBottom') : null;

    const originalText = 'Save Configuration';
    if (btnTop) {
      btnTop.textContent = 'Saved Successfully!';
      btnTop.style.background = '#4E8046';
      btnTop.style.borderColor = '#4E8046';
    }
    if (btnBottom) {
      btnBottom.textContent = 'Saved Successfully!';
      btnBottom.style.background = '#4E8046';
      btnBottom.style.borderColor = '#4E8046';
    }
    if (statusTop) statusTop.style.display = 'block';
    if (statusBottom) statusBottom.style.display = 'block';

    setTimeout(() => {
      if (btnTop) {
        btnTop.textContent = originalText;
        btnTop.style.background = 'var(--accent-primary)';
        btnTop.style.borderColor = 'var(--accent-primary)';
      }
      if (btnBottom) {
        btnBottom.textContent = originalText;
        btnBottom.style.background = 'var(--accent-primary)';
        btnBottom.style.borderColor = 'var(--accent-primary)';
      }
      if (statusTop) statusTop.style.display = 'none';
      if (statusBottom) statusBottom.style.display = 'none';
    }, 2200);
  },

  /* Interactive Gripper Tuner Panel in Digital Space */
  createTunerPanel() {
    const tuner = document.createElement('div');
    tuner.id = 'dtTunerPanel';
    tuner.style.position = 'absolute';
    tuner.style.top = '50px';
    tuner.style.right = '12px';
    tuner.style.width = '340px';
    tuner.style.maxHeight = 'calc(100% - 65px)';
    tuner.style.overflowY = 'auto';
    tuner.style.background = 'rgba(26, 24, 23, 0.94)';
    tuner.style.border = '1px solid rgba(196, 120, 74, 0.4)';
    tuner.style.borderRadius = '8px';
    tuner.style.padding = '14px';
    tuner.style.zIndex = '8';
    tuner.style.display = 'none';
    tuner.style.backdropFilter = 'blur(8px)';
    tuner.style.fontFamily = 'var(--font-mono)';
    tuner.style.fontSize = '0.73rem';
    tuner.style.color = '#FAF7F2';
    tuner.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)';

    tuner.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 6px;">
        <span style="font-weight: 600; color: var(--accent-primary); font-size: 0.8rem;">Digital Space Claw Studio</span>
        <button id="btnDtTunerClose" style="background: none; border: none; color: #FAF7F2; cursor: pointer; font-size: 0.95rem;">X</button>
      </div>

      <!-- Save Action Controls (Top) -->
      <div style="margin-bottom: 12px;">
        <button id="btnDtSaveClawConfigTop" class="btn btn-primary" style="width: 100%; font-weight: 600; font-size: 0.74rem; padding: 7px; background: var(--accent-primary); border: 1px solid var(--accent-primary); color: #FAF7F2; cursor: pointer;">Save Configuration</button>
        <div id="dtSaveStatusTop" style="font-size: 0.65rem; color: #7DB26C; text-align: center; display: none; margin-top: 4px;">Configuration Saved Successfully</div>
      </div>

      <!-- Quick Orientation Presets -->
      <div style="margin-bottom: 14px; background: rgba(255,255,255,0.04); padding: 8px; border-radius: 6px;">
        <div style="font-weight: 600; color: #FAF7F2; margin-bottom: 6px;">Quick Presets</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          <button id="btnPresetFaceIn" class="btn btn-secondary" style="font-size: 0.68rem; padding: 4px;">Face Inward</button>
          <button id="btnPresetFaceOut" class="btn btn-secondary" style="font-size: 0.68rem; padding: 4px;">Face Outward</button>
          <button id="btnPresetFlipUpsideDown" class="btn btn-secondary" style="font-size: 0.68rem; padding: 4px;">Flip Upside Down</button>
          <button id="btnPresetSwapSides" class="btn btn-secondary" style="font-size: 0.68rem; padding: 4px;">Swap Left/Right</button>
        </div>
      </div>

      <!-- Mount Position & Pinch Spread -->
      <div style="margin-bottom: 14px; background: rgba(255,255,255,0.04); padding: 8px; border-radius: 6px;">
        <div style="font-weight: 600; color: #FAF7F2; margin-bottom: 8px;">Global Mount & Pinch</div>

        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Claw Base Spacing (X):</span>
            <span id="dtTuneValX" style="color: var(--accent-primary);">${this.clawConfig.spacingX} mm</span>
          </div>
          <input type="range" id="dtSliderX" min="4" max="32" step="0.5" value="${this.clawConfig.spacingX}" style="width: 100%;">
        </div>

        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Mount Forward (Y):</span>
            <span id="dtTuneValY" style="color: var(--accent-primary);">${this.clawConfig.mountY} mm</span>
          </div>
          <input type="range" id="dtSliderY" min="30" max="85" step="0.5" value="${this.clawConfig.mountY}" style="width: 100%;">
        </div>

        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Elevation (Z):</span>
            <span id="dtTuneValZ" style="color: var(--accent-primary);">${this.clawConfig.offsetZ} mm</span>
          </div>
          <input type="range" id="dtSliderZ" min="-25" max="25" step="0.5" value="${this.clawConfig.offsetZ}" style="width: 100%;">
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Rest Angle Offset:</span>
            <span id="dtTuneValAngle" style="color: var(--accent-primary);">${Math.round(this.clawConfig.restAngle * 180 / Math.PI)}°</span>
          </div>
          <input type="range" id="dtSliderAngle" min="-30" max="30" step="1" value="${Math.round(this.clawConfig.restAngle * 180 / Math.PI)}" style="width: 100%;">
        </div>
      </div>

      <!-- Left Claw Finger Settings -->
      <div style="margin-bottom: 14px; background: rgba(196, 120, 74, 0.08); border: 1px solid rgba(196, 120, 74, 0.25); padding: 10px; border-radius: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-weight: 600; color: var(--accent-primary);">Left Claw Finger</span>
          <button id="btnLeftClawReset" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.68rem; text-decoration: underline;">Reset Left</button>
        </div>

        <!-- Position Controls (X, Y, Z) -->
        <div style="margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Position X:</span>
            <span id="dtValLPosX" style="color: var(--accent-primary);">${this.clawConfig.leftPosX} mm</span>
          </div>
          <input type="range" id="dtSliderLPosX" min="-30" max="30" step="0.5" value="${this.clawConfig.leftPosX}" style="width: 100%;">
        </div>

        <div style="margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Position Y:</span>
            <span id="dtValLPosY" style="color: var(--accent-primary);">${this.clawConfig.leftPosY} mm</span>
          </div>
          <input type="range" id="dtSliderLPosY" min="-30" max="30" step="0.5" value="${this.clawConfig.leftPosY}" style="width: 100%;">
        </div>

        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Position Z:</span>
            <span id="dtValLPosZ" style="color: var(--accent-primary);">${this.clawConfig.leftPosZ} mm</span>
          </div>
          <input type="range" id="dtSliderLPosZ" min="-30" max="30" step="0.5" value="${this.clawConfig.leftPosZ}" style="width: 100%;">
        </div>

        <!-- Rotate X Slider -->
        <div style="margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Rotate X:</span>
            <span id="dtValLRotX" style="color: var(--accent-primary);">${this.clawConfig.leftRotX}°</span>
          </div>
          <input type="range" id="dtSliderLRotX" min="-180" max="180" step="5" value="${this.clawConfig.leftRotX}" style="width: 100%;">
        </div>

        <!-- Rotate Y Slider -->
        <div style="margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Rotate Y:</span>
            <span id="dtValLRotY" style="color: var(--accent-primary);">${this.clawConfig.leftRotY}°</span>
          </div>
          <input type="range" id="dtSliderLRotY" min="-180" max="180" step="5" value="${this.clawConfig.leftRotY}" style="width: 100%;">
        </div>

        <!-- Rotate Z Slider -->
        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Rotate Z:</span>
            <span id="dtValLRotZ" style="color: var(--accent-primary);">${this.clawConfig.leftRotZ}°</span>
          </div>
          <input type="range" id="dtSliderLRotZ" min="-180" max="180" step="5" value="${this.clawConfig.leftRotZ}" style="width: 100%;">
        </div>

        <!-- Quick Toggles -->
        <div style="display: flex; gap: 6px;">
          <button id="btnToggleLMirror" class="btn btn-secondary" style="flex: 1; font-size: 0.65rem; padding: 4px;">Mirror X</button>
          <button id="btnToggleLFlipY" class="btn btn-secondary" style="flex: 1; font-size: 0.65rem; padding: 4px;">Upside Down</button>
          <button id="btnToggleLFlipZ" class="btn btn-secondary" style="flex: 1; font-size: 0.65rem; padding: 4px;">Flip Z</button>
        </div>
      </div>

      <!-- Right Claw Finger Settings -->
      <div style="margin-bottom: 14px; background: rgba(196, 120, 74, 0.08); border: 1px solid rgba(196, 120, 74, 0.25); padding: 10px; border-radius: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-weight: 600; color: var(--accent-primary);">Right Claw Finger</span>
          <button id="btnRightClawReset" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.68rem; text-decoration: underline;">Reset Right</button>
        </div>

        <!-- Position Controls (X, Y, Z) -->
        <div style="margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Position X:</span>
            <span id="dtValRPosX" style="color: var(--accent-primary);">${this.clawConfig.rightPosX} mm</span>
          </div>
          <input type="range" id="dtSliderRPosX" min="-30" max="30" step="0.5" value="${this.clawConfig.rightPosX}" style="width: 100%;">
        </div>

        <div style="margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Position Y:</span>
            <span id="dtValRPosY" style="color: var(--accent-primary);">${this.clawConfig.rightPosY} mm</span>
          </div>
          <input type="range" id="dtSliderRPosY" min="-30" max="30" step="0.5" value="${this.clawConfig.rightPosY}" style="width: 100%;">
        </div>

        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Position Z:</span>
            <span id="dtValRPosZ" style="color: var(--accent-primary);">${this.clawConfig.rightPosZ} mm</span>
          </div>
          <input type="range" id="dtSliderRPosZ" min="-30" max="30" step="0.5" value="${this.clawConfig.rightPosZ}" style="width: 100%;">
        </div>

        <!-- Rotate X Slider -->
        <div style="margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Rotate X:</span>
            <span id="dtValRRotX" style="color: var(--accent-primary);">${this.clawConfig.rightRotX}°</span>
          </div>
          <input type="range" id="dtSliderRRotX" min="-180" max="180" step="5" value="${this.clawConfig.rightRotX}" style="width: 100%;">
        </div>

        <!-- Rotate Y Slider -->
        <div style="margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Rotate Y:</span>
            <span id="dtValRRotY" style="color: var(--accent-primary);">${this.clawConfig.rightRotY}°</span>
          </div>
          <input type="range" id="dtSliderRRotY" min="-180" max="180" step="5" value="${this.clawConfig.rightRotY}" style="width: 100%;">
        </div>

        <!-- Rotate Z Slider -->
        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Rotate Z:</span>
            <span id="dtValRRotZ" style="color: var(--accent-primary);">${this.clawConfig.rightRotZ}°</span>
          </div>
          <input type="range" id="dtSliderRRotZ" min="-180" max="180" step="5" value="${this.clawConfig.rightRotZ}" style="width: 100%;">
        </div>

        <!-- Quick Toggles -->
        <div style="display: flex; gap: 6px;">
          <button id="btnToggleRMirror" class="btn btn-secondary" style="flex: 1; font-size: 0.65rem; padding: 4px;">Mirror X</button>
          <button id="btnToggleRFlipY" class="btn btn-secondary" style="flex: 1; font-size: 0.65rem; padding: 4px;">Upside Down</button>
          <button id="btnToggleRFlipZ" class="btn btn-secondary" style="flex: 1; font-size: 0.65rem; padding: 4px;">Flip Z</button>
        </div>
      </div>

      <!-- Physical Workspace & ArUco Block Perception Controls -->
      <div style="border-top: 1px solid rgba(255,255,255,0.12); padding-top: 10px; margin-top: 10px;">
        <div style="font-weight: 600; color: var(--accent-primary); margin-bottom: 8px; font-size: 0.76rem; display: flex; justify-content: space-between; align-items: center;">
          <span>Workspace & ArUco Block</span>
          <span style="font-size: 0.65rem; color: #FAF7F2; background: rgba(196,120,74,0.2); padding: 2px 6px; border-radius: 4px;">25 x 30 cm</span>
        </div>

        <!-- Workspace Distance from Arm Base -->
        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <span>Distance from Arm:</span>
            <span id="dtValWsDist" style="color: var(--accent-primary);">${this.workspaceConfig.distFromArmCm} cm</span>
          </div>
          <input type="range" id="dtSliderWsDist" min="1.0" max="15.0" step="0.2" value="${this.workspaceConfig.distFromArmCm}" style="width: 100%;">
        </div>

        <!-- Live Camera Sync Toggle -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; background: rgba(255,255,255,0.04); padding: 6px; border-radius: 4px;">
          <span>Camera 1 Perception Sync:</span>
          <label style="position: relative; display: inline-block; width: 34px; height: 18px; margin: 0;">
            <input type="checkbox" id="dtCheckLiveVision" ${this.workspaceConfig.liveCameraSync ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
            <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${this.workspaceConfig.liveCameraSync ? 'var(--accent-primary)' : '#444'}; transition: .3s; border-radius: 18px;" id="dtCheckLiveVisionSlider"></span>
          </label>
        </div>

        <!-- Manual Block Test Coordinates -->
        <div id="dtManualBlockSection" style="opacity: ${this.workspaceConfig.liveCameraSync ? '0.45' : '1.0'};">
          <div style="font-size: 0.68rem; color: #C4784A; margin-bottom: 4px;">Manual Block Simulation:</div>
          <div style="margin-bottom: 6px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span>Block X (0-30cm):</span>
              <span id="dtValManualBlockX" style="color: var(--accent-primary);">${this.workspaceConfig.manualXCm} cm</span>
            </div>
            <input type="range" id="dtSliderManualBlockX" min="0" max="30" step="0.5" value="${this.workspaceConfig.manualXCm}" style="width: 100%;">
          </div>

          <div style="margin-bottom: 6px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span>Block Y (0-25cm):</span>
              <span id="dtValManualBlockY" style="color: var(--accent-primary);">${this.workspaceConfig.manualYCm} cm</span>
            </div>
            <input type="range" id="dtSliderManualBlockY" min="0" max="25" step="0.5" value="${this.workspaceConfig.manualYCm}" style="width: 100%;">
          </div>

          <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span>Block Angle:</span>
              <span id="dtValManualBlockTheta" style="color: var(--accent-primary);">${this.workspaceConfig.manualThetaDeg}°</span>
            </div>
            <input type="range" id="dtSliderManualBlockTheta" min="-180" max="180" step="5" value="${this.workspaceConfig.manualThetaDeg}" style="width: 100%;">
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 8px; margin-top: 10px;">
        <button id="btnDtSaveClawConfigBottom" class="btn btn-primary" style="flex: 2; font-weight: 600; font-size: 0.72rem; padding: 7px; background: var(--accent-primary); border: 1px solid var(--accent-primary); color: #FAF7F2; cursor: pointer;">Save Configuration</button>
        <button id="btnDtResetTuner" class="btn btn-secondary" style="flex: 1; font-size: 0.70rem; padding: 7px;">Reset Defaults</button>
      </div>
      <div id="dtSaveStatusBottom" style="font-size: 0.65rem; color: #7DB26C; text-align: center; display: none; margin-top: 4px;">Configuration Saved Successfully</div>
    `;

    this.container.appendChild(tuner);

    // Bind Tuner Save & Reset Action Controls
    const btnSaveTop = tuner.querySelector('#btnDtSaveClawConfigTop');
    if (btnSaveTop) {
      btnSaveTop.onclick = (e) => {
        e.preventDefault();
        this.handleSaveClawConfig();
      };
    }

    const btnSaveBottom = tuner.querySelector('#btnDtSaveClawConfigBottom');
    if (btnSaveBottom) {
      btnSaveBottom.onclick = (e) => {
        e.preventDefault();
        this.handleSaveClawConfig();
      };
    }

    // Bind Tuner slider events
    const sliderX = tuner.querySelector('#dtSliderX');
    const sliderY = tuner.querySelector('#dtSliderY');
    const sliderZ = tuner.querySelector('#dtSliderZ');
    const sliderAngle = tuner.querySelector('#dtSliderAngle');
    const btnResetTuner = tuner.querySelector('#btnDtResetTuner');
    const btnClose = tuner.querySelector('#btnDtTunerClose');

    sliderX.oninput = (e) => {
      this.clawConfig.spacingX = parseFloat(e.target.value);
      tuner.querySelector('#dtTuneValX').textContent = `${this.clawConfig.spacingX} mm`;
      this.updateClawPlacements();
    };

    sliderY.oninput = (e) => {
      this.clawConfig.mountY = parseFloat(e.target.value);
      tuner.querySelector('#dtTuneValY').textContent = `${this.clawConfig.mountY} mm`;
      this.updateClawPlacements();
    };

    sliderZ.oninput = (e) => {
      this.clawConfig.offsetZ = parseFloat(e.target.value);
      tuner.querySelector('#dtTuneValZ').textContent = `${this.clawConfig.offsetZ} mm`;
      this.updateClawPlacements();
    };

    sliderAngle.oninput = (e) => {
      this.clawConfig.restAngle = parseFloat(e.target.value) * Math.PI / 180;
      tuner.querySelector('#dtTuneValAngle').textContent = `${e.target.value}°`;
    };

    // Left Claw Sliders
    const sliderLPosX = tuner.querySelector('#dtSliderLPosX');
    const sliderLPosY = tuner.querySelector('#dtSliderLPosY');
    const sliderLPosZ = tuner.querySelector('#dtSliderLPosZ');
    const sliderLRotX = tuner.querySelector('#dtSliderLRotX');
    const sliderLRotY = tuner.querySelector('#dtSliderLRotY');
    const sliderLRotZ = tuner.querySelector('#dtSliderLRotZ');

    sliderLPosX.oninput = (e) => {
      this.clawConfig.leftPosX = parseFloat(e.target.value);
      tuner.querySelector('#dtValLPosX').textContent = `${this.clawConfig.leftPosX} mm`;
      this.updateClawPlacements();
    };
    sliderLPosY.oninput = (e) => {
      this.clawConfig.leftPosY = parseFloat(e.target.value);
      tuner.querySelector('#dtValLPosY').textContent = `${this.clawConfig.leftPosY} mm`;
      this.updateClawPlacements();
    };
    sliderLPosZ.oninput = (e) => {
      this.clawConfig.leftPosZ = parseFloat(e.target.value);
      tuner.querySelector('#dtValLPosZ').textContent = `${this.clawConfig.leftPosZ} mm`;
      this.updateClawPlacements();
    };

    sliderLRotX.oninput = (e) => {
      this.clawConfig.leftRotX = parseInt(e.target.value, 10);
      tuner.querySelector('#dtValLRotX').textContent = `${this.clawConfig.leftRotX}°`;
      this.updateClawPlacements();
    };
    sliderLRotY.oninput = (e) => {
      this.clawConfig.leftRotY = parseInt(e.target.value, 10);
      tuner.querySelector('#dtValLRotY').textContent = `${this.clawConfig.leftRotY}°`;
      this.updateClawPlacements();
    };
    sliderLRotZ.oninput = (e) => {
      this.clawConfig.leftRotZ = parseInt(e.target.value, 10);
      tuner.querySelector('#dtValLRotZ').textContent = `${this.clawConfig.leftRotZ}°`;
      this.updateClawPlacements();
    };

    // Right Claw Sliders
    const sliderRPosX = tuner.querySelector('#dtSliderRPosX');
    const sliderRPosY = tuner.querySelector('#dtSliderRPosY');
    const sliderRPosZ = tuner.querySelector('#dtSliderRPosZ');
    const sliderRRotX = tuner.querySelector('#dtSliderRRotX');
    const sliderRRotY = tuner.querySelector('#dtSliderRRotY');
    const sliderRRotZ = tuner.querySelector('#dtSliderRRotZ');

    sliderRPosX.oninput = (e) => {
      this.clawConfig.rightPosX = parseFloat(e.target.value);
      tuner.querySelector('#dtValRPosX').textContent = `${this.clawConfig.rightPosX} mm`;
      this.updateClawPlacements();
    };
    sliderRPosY.oninput = (e) => {
      this.clawConfig.rightPosY = parseFloat(e.target.value);
      tuner.querySelector('#dtValRPosY').textContent = `${this.clawConfig.rightPosY} mm`;
      this.updateClawPlacements();
    };
    sliderRPosZ.oninput = (e) => {
      this.clawConfig.rightPosZ = parseFloat(e.target.value);
      tuner.querySelector('#dtValRPosZ').textContent = `${this.clawConfig.rightPosZ} mm`;
      this.updateClawPlacements();
    };

    sliderRRotX.oninput = (e) => {
      this.clawConfig.rightRotX = parseInt(e.target.value, 10);
      tuner.querySelector('#dtValRRotX').textContent = `${this.clawConfig.rightRotX}°`;
      this.updateClawPlacements();
    };
    sliderRRotY.oninput = (e) => {
      this.clawConfig.rightRotY = parseInt(e.target.value, 10);
      tuner.querySelector('#dtValRRotY').textContent = `${this.clawConfig.rightRotY}°`;
      this.updateClawPlacements();
    };
    sliderRRotZ.oninput = (e) => {
      this.clawConfig.rightRotZ = parseInt(e.target.value, 10);
      tuner.querySelector('#dtValRRotZ').textContent = `${this.clawConfig.rightRotZ}°`;
      this.updateClawPlacements();
    };

    // Left Claw Toggles
    tuner.querySelector('#btnToggleLMirror').onclick = () => {
      this.clawConfig.leftMirrorX = !this.clawConfig.leftMirrorX;
      tuner.querySelector('#btnToggleLMirror').style.borderColor = this.clawConfig.leftMirrorX ? 'var(--accent-primary)' : '';
      this.updateClawPlacements();
    };
    tuner.querySelector('#btnToggleLFlipY').onclick = () => {
      this.clawConfig.leftFlipY = !this.clawConfig.leftFlipY;
      tuner.querySelector('#btnToggleLFlipY').style.borderColor = this.clawConfig.leftFlipY ? 'var(--accent-primary)' : '';
      this.updateClawPlacements();
    };
    tuner.querySelector('#btnToggleLFlipZ').onclick = () => {
      this.clawConfig.leftFlipZ = !this.clawConfig.leftFlipZ;
      tuner.querySelector('#btnToggleLFlipZ').style.borderColor = this.clawConfig.leftFlipZ ? 'var(--accent-primary)' : '';
      this.updateClawPlacements();
    };

    // Right Claw Toggles
    tuner.querySelector('#btnToggleRMirror').onclick = () => {
      this.clawConfig.rightMirrorX = !this.clawConfig.rightMirrorX;
      tuner.querySelector('#btnToggleRMirror').style.borderColor = this.clawConfig.rightMirrorX ? 'var(--accent-primary)' : '';
      this.updateClawPlacements();
    };
    tuner.querySelector('#btnToggleRFlipY').onclick = () => {
      this.clawConfig.rightFlipY = !this.clawConfig.rightFlipY;
      tuner.querySelector('#btnToggleRFlipY').style.borderColor = this.clawConfig.rightFlipY ? 'var(--accent-primary)' : '';
      this.updateClawPlacements();
    };
    tuner.querySelector('#btnToggleRFlipZ').onclick = () => {
      this.clawConfig.rightFlipZ = !this.clawConfig.rightFlipZ;
      tuner.querySelector('#btnToggleRFlipZ').style.borderColor = this.clawConfig.rightFlipZ ? 'var(--accent-primary)' : '';
      this.updateClawPlacements();
    };

    // Reset Left / Right Individual Buttons
    tuner.querySelector('#btnLeftClawReset').onclick = () => {
      this.clawConfig.leftPosX = 0;
      this.clawConfig.leftPosY = 0;
      this.clawConfig.leftPosZ = 0;
      this.clawConfig.leftRotX = 0;
      this.clawConfig.leftRotY = 0;
      this.clawConfig.leftRotZ = 0;
      this.clawConfig.leftMirrorX = false;
      this.clawConfig.leftFlipY = false;
      this.clawConfig.leftFlipZ = false;
      this.syncTunerInputs(tuner);
      this.updateClawPlacements();
    };

    tuner.querySelector('#btnRightClawReset').onclick = () => {
      this.clawConfig.rightPosX = 0;
      this.clawConfig.rightPosY = 0;
      this.clawConfig.rightPosZ = 0;
      this.clawConfig.rightRotX = 0;
      this.clawConfig.rightRotY = 0;
      this.clawConfig.rightRotZ = 0;
      this.clawConfig.rightMirrorX = false;
      this.clawConfig.rightFlipY = false;
      this.clawConfig.rightFlipZ = false;
      this.syncTunerInputs(tuner);
      this.updateClawPlacements();
    };

    // Quick Presets
    tuner.querySelector('#btnPresetFaceIn').onclick = () => {
      this.clawConfig.leftRotY = 0;
      this.clawConfig.rightRotY = 0;
      this.clawConfig.leftMirrorX = false;
      this.clawConfig.rightMirrorX = false;
      this.syncTunerInputs(tuner);
      this.updateClawPlacements();
    };

    tuner.querySelector('#btnPresetFaceOut').onclick = () => {
      this.clawConfig.leftRotY = 180;
      this.clawConfig.rightRotY = 180;
      this.syncTunerInputs(tuner);
      this.updateClawPlacements();
    };

    tuner.querySelector('#btnPresetFlipUpsideDown').onclick = () => {
      this.clawConfig.leftFlipY = !this.clawConfig.leftFlipY;
      this.clawConfig.rightFlipY = !this.clawConfig.rightFlipY;
      this.syncTunerInputs(tuner);
      this.updateClawPlacements();
    };

    tuner.querySelector('#btnPresetSwapSides').onclick = () => {
      const tempPosX = this.clawConfig.leftPosX;
      const tempPosY = this.clawConfig.leftPosY;
      const tempPosZ = this.clawConfig.leftPosZ;
      const tempRotX = this.clawConfig.leftRotX;
      const tempRotY = this.clawConfig.leftRotY;
      const tempRotZ = this.clawConfig.leftRotZ;
      const tempMirror = this.clawConfig.leftMirrorX;
      const tempFlipY = this.clawConfig.leftFlipY;
      const tempFlipZ = this.clawConfig.leftFlipZ;

      this.clawConfig.leftPosX = this.clawConfig.rightPosX;
      this.clawConfig.leftPosY = this.clawConfig.rightPosY;
      this.clawConfig.leftPosZ = this.clawConfig.rightPosZ;
      this.clawConfig.leftRotX = this.clawConfig.rightRotX;
      this.clawConfig.leftRotY = this.clawConfig.rightRotY;
      this.clawConfig.leftRotZ = this.clawConfig.rightRotZ;
      this.clawConfig.leftMirrorX = this.clawConfig.rightMirrorX;
      this.clawConfig.leftFlipY = this.clawConfig.rightFlipY;
      this.clawConfig.leftFlipZ = this.clawConfig.rightFlipZ;

      this.clawConfig.rightPosX = tempPosX;
      this.clawConfig.rightPosY = tempPosY;
      this.clawConfig.rightPosZ = tempPosZ;
      this.clawConfig.rightRotX = tempRotX;
      this.clawConfig.rightRotY = tempRotY;
      this.clawConfig.rightRotZ = tempRotZ;
      this.clawConfig.rightMirrorX = tempMirror;
      this.clawConfig.rightFlipY = tempFlipY;
      this.clawConfig.rightFlipZ = tempFlipZ;

      this.syncTunerInputs(tuner);
      this.updateClawPlacements();
    };

    btnResetTuner.onclick = () => {
      this.clawConfig.spacingX = 14.0;
      this.clawConfig.mountY = 60.0;
      this.clawConfig.offsetZ = 0.0;
      this.clawConfig.restAngle = 0.0;
      this.clawConfig.leftPosX = 0.0;
      this.clawConfig.leftPosY = 0.0;
      this.clawConfig.leftPosZ = 0.0;
      this.clawConfig.leftRotX = 0;
      this.clawConfig.leftRotY = 0;
      this.clawConfig.leftRotZ = 0;
      this.clawConfig.leftMirrorX = false;
      this.clawConfig.leftFlipY = false;
      this.clawConfig.leftFlipZ = false;
      this.clawConfig.rightPosX = 0.0;
      this.clawConfig.rightPosY = 0.0;
      this.clawConfig.rightPosZ = 0.0;
      this.clawConfig.rightRotX = 0;
      this.clawConfig.rightRotY = 0;
      this.clawConfig.rightRotZ = 0;
      this.clawConfig.rightMirrorX = false;
      this.clawConfig.rightFlipY = false;
      this.clawConfig.rightFlipZ = false;
      this.syncTunerInputs(tuner);
      this.updateClawPlacements();
    };

    // Workspace & Target Block Tuner Controls
    const sliderWsDist = tuner.querySelector('#dtSliderWsDist');
    const checkLiveVision = tuner.querySelector('#dtCheckLiveVision');
    const sliderBlockX = tuner.querySelector('#dtSliderManualBlockX');
    const sliderBlockY = tuner.querySelector('#dtSliderManualBlockY');
    const sliderBlockTheta = tuner.querySelector('#dtSliderManualBlockTheta');
    const manualBlockSection = tuner.querySelector('#dtManualBlockSection');

    if (sliderWsDist) {
      sliderWsDist.oninput = (e) => {
        this.workspaceConfig.distFromArmCm = parseFloat(e.target.value);
        tuner.querySelector('#dtValWsDist').textContent = `${this.workspaceConfig.distFromArmCm.toFixed(1)} cm`;
        this.updateWorkspacePosition();
      };
    }

    if (checkLiveVision) {
      checkLiveVision.onchange = (e) => {
        this.workspaceConfig.liveCameraSync = e.target.checked;
        const sliderBg = tuner.querySelector('#dtCheckLiveVisionSlider');
        if (sliderBg) {
          sliderBg.style.backgroundColor = this.workspaceConfig.liveCameraSync ? 'var(--accent-primary)' : '#444';
        }
        if (manualBlockSection) {
          manualBlockSection.style.opacity = this.workspaceConfig.liveCameraSync ? '0.45' : '1.0';
        }
        if (!this.workspaceConfig.liveCameraSync) {
          this.updateBlock3DPosition(
            this.workspaceConfig.manualXCm,
            this.workspaceConfig.manualYCm,
            this.workspaceConfig.manualThetaDeg,
            true
          );
        }
      };
    }

    if (sliderBlockX) {
      sliderBlockX.oninput = (e) => {
        this.workspaceConfig.manualXCm = parseFloat(e.target.value);
        tuner.querySelector('#dtValManualBlockX').textContent = `${this.workspaceConfig.manualXCm.toFixed(1)} cm`;
        if (!this.workspaceConfig.liveCameraSync) {
          this.updateBlock3DPosition(
            this.workspaceConfig.manualXCm,
            this.workspaceConfig.manualYCm,
            this.workspaceConfig.manualThetaDeg,
            true
          );
        }
      };
    }

    if (sliderBlockY) {
      sliderBlockY.oninput = (e) => {
        this.workspaceConfig.manualYCm = parseFloat(e.target.value);
        tuner.querySelector('#dtValManualBlockY').textContent = `${this.workspaceConfig.manualYCm.toFixed(1)} cm`;
        if (!this.workspaceConfig.liveCameraSync) {
          this.updateBlock3DPosition(
            this.workspaceConfig.manualXCm,
            this.workspaceConfig.manualYCm,
            this.workspaceConfig.manualThetaDeg,
            true
          );
        }
      };
    }

    if (sliderBlockTheta) {
      sliderBlockTheta.oninput = (e) => {
        this.workspaceConfig.manualThetaDeg = parseFloat(e.target.value);
        tuner.querySelector('#dtValManualBlockTheta').textContent = `${this.workspaceConfig.manualThetaDeg}°`;
        if (!this.workspaceConfig.liveCameraSync) {
          this.updateBlock3DPosition(
            this.workspaceConfig.manualXCm,
            this.workspaceConfig.manualYCm,
            this.workspaceConfig.manualThetaDeg,
            true
          );
        }
      };
    }

    btnClose.onclick = () => {
      tuner.style.display = 'none';
    };
  },

  syncTunerInputs(tuner) {
    if (!tuner) return;
    const setVal = (id, val) => {
      const el = tuner.querySelector(id);
      if (el) el.value = val;
    };
    const setText = (id, txt) => {
      const el = tuner.querySelector(id);
      if (el) el.textContent = txt;
    };
    setVal('#dtSliderX', this.clawConfig.spacingX);
    setText('#dtTuneValX', `${this.clawConfig.spacingX} mm`);
    setVal('#dtSliderY', this.clawConfig.mountY);
    setText('#dtTuneValY', `${this.clawConfig.mountY} mm`);
    setVal('#dtSliderZ', this.clawConfig.offsetZ);
    setText('#dtTuneValZ', `${this.clawConfig.offsetZ} mm`);
    setVal('#dtSliderAngle', Math.round(this.clawConfig.restAngle * 180 / Math.PI));
    setText('#dtTuneValAngle', `${Math.round(this.clawConfig.restAngle * 180 / Math.PI)}°`);

    // Left Claw
    setVal('#dtSliderLPosX', this.clawConfig.leftPosX);
    setText('#dtValLPosX', `${this.clawConfig.leftPosX} mm`);
    setVal('#dtSliderLPosY', this.clawConfig.leftPosY);
    setText('#dtValLPosY', `${this.clawConfig.leftPosY} mm`);
    setVal('#dtSliderLPosZ', this.clawConfig.leftPosZ);
    setText('#dtValLPosZ', `${this.clawConfig.leftPosZ} mm`);
    setVal('#dtSliderLRotX', this.clawConfig.leftRotX);
    setText('#dtValLRotX', `${this.clawConfig.leftRotX}°`);
    setVal('#dtSliderLRotY', this.clawConfig.leftRotY);
    setText('#dtValLRotY', `${this.clawConfig.leftRotY}°`);
    setVal('#dtSliderLRotZ', this.clawConfig.leftRotZ);
    setText('#dtValLRotZ', `${this.clawConfig.leftRotZ}°`);

    // Right Claw
    setVal('#dtSliderRPosX', this.clawConfig.rightPosX);
    setText('#dtValRPosX', `${this.clawConfig.rightPosX} mm`);
    setVal('#dtSliderRPosY', this.clawConfig.rightPosY);
    setText('#dtValRPosY', `${this.clawConfig.rightPosY} mm`);
    setVal('#dtSliderRPosZ', this.clawConfig.rightPosZ);
    setText('#dtValRPosZ', `${this.clawConfig.rightPosZ} mm`);
    setVal('#dtSliderRRotX', this.clawConfig.rightRotX);
    setText('#dtValRRotX', `${this.clawConfig.rightRotX}°`);
    setVal('#dtSliderRRotY', this.clawConfig.rightRotY);
    setText('#dtValRRotY', `${this.clawConfig.rightRotY}°`);
    setVal('#dtSliderRRotZ', this.clawConfig.rightRotZ);
    setText('#dtValRRotZ', `${this.clawConfig.rightRotZ}°`);

    // Workspace & Block
    setVal('#dtSliderWsDist', this.workspaceConfig.distFromArmCm);
    setText('#dtValWsDist', `${this.workspaceConfig.distFromArmCm.toFixed(1)} cm`);
    const checkLive = tuner.querySelector('#dtCheckLiveVision');
    if (checkLive) checkLive.checked = this.workspaceConfig.liveCameraSync;
    setVal('#dtSliderManualBlockX', this.workspaceConfig.manualXCm);
    setText('#dtValManualBlockX', `${this.workspaceConfig.manualXCm.toFixed(1)} cm`);
    setVal('#dtSliderManualBlockY', this.workspaceConfig.manualYCm);
    setText('#dtValManualBlockY', `${this.workspaceConfig.manualYCm.toFixed(1)} cm`);
    setVal('#dtSliderManualBlockTheta', this.workspaceConfig.manualThetaDeg);
    setText('#dtValManualBlockTheta', `${this.workspaceConfig.manualThetaDeg}°`);

    const setBorder = (id, cond) => {
      const el = tuner.querySelector(id);
      if (el) el.style.borderColor = cond ? 'var(--accent-primary)' : '';
    };
    setBorder('#btnToggleLMirror', this.clawConfig.leftMirrorX);
    setBorder('#btnToggleLFlipY', this.clawConfig.leftFlipY);
    setBorder('#btnToggleLFlipZ', this.clawConfig.leftFlipZ);
    setBorder('#btnToggleRMirror', this.clawConfig.rightMirrorX);
    setBorder('#btnToggleRFlipY', this.clawConfig.rightFlipY);
    setBorder('#btnToggleRFlipZ', this.clawConfig.rightFlipZ);
  },

  toggleTunerPanel() {
    const tuner = document.getElementById('dtTunerPanel');
    if (!tuner) return;
    tuner.style.display = tuner.style.display === 'none' ? 'block' : 'none';
  },

  updateClawPlacements() {
    const deg2rad = Math.PI / 180;

    // Update parent mount positions (base spacing + individual offsets)
    if (this.clawLeftGroup) {
      this.clawLeftGroup.position.set(
        -(this.clawConfig.spacingX + this.clawConfig.leftPosX),
        this.clawConfig.mountY + this.clawConfig.leftPosY,
        this.clawConfig.offsetZ + this.clawConfig.leftPosZ
      );
    }
    if (this.clawRightGroup) {
      this.clawRightGroup.position.set(
        (this.clawConfig.spacingX + this.clawConfig.rightPosX),
        this.clawConfig.mountY + this.clawConfig.rightPosY,
        this.clawConfig.offsetZ + this.clawConfig.rightPosZ
      );
    }

    // Apply individual rotation and mirror/flip transforms to Left Claw mesh
    const meshLeft = this.meshes['gripper_claw_left'];
    if (meshLeft) {
      meshLeft.rotation.set(
        this.clawConfig.leftRotX * deg2rad,
        this.clawConfig.leftRotY * deg2rad,
        this.clawConfig.leftRotZ * deg2rad
      );
      meshLeft.scale.set(
        this.clawConfig.leftMirrorX ? -1 : 1,
        this.clawConfig.leftFlipY ? -1 : 1,
        this.clawConfig.leftFlipZ ? -1 : 1
      );
    }

    // Apply individual rotation and mirror/flip transforms to Right Claw mesh
    const meshRight = this.meshes['gripper_claw_right'];
    if (meshRight) {
      meshRight.rotation.set(
        this.clawConfig.rightRotX * deg2rad,
        this.clawConfig.rightRotY * deg2rad,
        this.clawConfig.rightRotZ * deg2rad
      );
      meshRight.scale.set(
        this.clawConfig.rightMirrorX ? -1 : 1,
        this.clawConfig.rightFlipY ? -1 : 1,
        this.clawConfig.rightFlipZ ? -1 : 1
      );
    }
  },

  initScene() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 620;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x23201D);

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    const initialCam = this.getDefaultCameraView();
    this.camera.position.set(initialCam.pos.x, initialCam.pos.y, initialCam.pos.z);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.container.appendChild(this.renderer.domElement);

    // OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.set(initialCam.target.x, initialCam.target.y, initialCam.target.z);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
      this.controls.minDistance = 100;
      this.controls.maxDistance = 1200;
      this.controls.addEventListener('start', () => {
        this._userMovedCamera = true;
      });
      this.controls.update();
    }

    // Grid Floor
    this.gridHelper = new THREE.GridHelper(800, 40, 0xC4784A, 0x423B35);
    this.gridHelper.position.y = 0;
    this.scene.add(this.gridHelper);

    // Circular ground ring
    const groundGeo = new THREE.CircleGeometry(420, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1E1B19,
      roughness: 0.85,
      metalness: 0.1
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.y = -0.5;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // Work table border ring
    const ringGeo = new THREE.RingGeometry(419, 421, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xC4784A, side: THREE.DoubleSide, opacity: 0.4, transparent: true });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.ringMesh.rotation.x = -Math.PI / 2;
    this.ringMesh.position.y = -0.4;
    this.scene.add(this.ringMesh);
  },

  initLighting() {
    const ambientLight = new THREE.AmbientLight(0xFFF6EE, 0.85);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xFFF3E0, 1.25);
    keyLight.position.set(200, 400, 250);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 50;
    keyLight.shadow.camera.far = 1000;
    const d = 250;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.001;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xD8D0C5, 0.6);
    fillLight.position.set(-200, 200, -200);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xC4784A, 0.4);
    rimLight.position.set(0, -100, -300);
    this.scene.add(rimLight);
  },

  buildKinematicHierarchy() {
    // 1. Robot Root
    this.robotRoot = new THREE.Group();
    this.robotRoot.position.set(0, 0, 0);
    this.scene.add(this.robotRoot);

    // 2. Base group (Stationary base sitting flat on floor at Y = 0)
    this.baseGroup = new THREE.Group();
    this.robotRoot.add(this.baseGroup);

    // 3. Waist group (Rotates around Y axis, Joint 1 / Base θ1)
    // Sits directly on top of the Base turntable at Y = 56.0 mm!
    this.waistGroup = new THREE.Group();
    this.waistGroup.position.set(0, this.BASE_HEIGHT, 0);
    this.robotRoot.add(this.waistGroup);

    // 4. Shoulder group (Pivot at Y = 39.0 mm above waist, giving total height 56 + 39 = 95mm = L1)
    // Rotates around X axis (pitch), Joint 2 / Shoulder θ2
    this.shoulderGroup = new THREE.Group();
    this.shoulderGroup.position.set(0, this.SHOULDER_OFFSET, 0);
    this.waistGroup.add(this.shoulderGroup);

    // 5. Elbow group (Pivot at Y = L2 = 120mm along shoulder link, Rotates around X axis, Joint 3 / Elbow θ3)
    this.elbowGroup = new THREE.Group();
    this.elbowGroup.position.set(0, this.L2, 0);
    this.shoulderGroup.add(this.elbowGroup);

    // 6. Wrist Roll group (Rotates around Y/longitudinal axis, Joint 4 / Wrist Roll θ4)
    // Pivot at Y = L3 = 100mm where Arm 02 ends! Arm 03 is attached inside here.
    this.wristRollGroup = new THREE.Group();
    this.wristRollGroup.position.set(0, this.L3, 0);
    this.elbowGroup.add(this.wristRollGroup);

    // 7. Wrist Pitch group (Rotates around X axis, Joint 5 / Wrist Pitch θ5 - tilts UP AND DOWN)
    // Connected directly at the vertical wall hole of Arm 03 at Y = 33.2mm! Gripper base sits inside here.
    this.wristPitchGroup = new THREE.Group();
    this.wristPitchGroup.position.set(0, this.ARM3_HOLE_DIST, 0);
    this.wristRollGroup.add(this.wristPitchGroup);

    // 8. Gripper Claws (2x Gripper 1.STL Claws mounted on front of Gripper Base inside wristPitchGroup)
    this.clawLeftGroup = new THREE.Group();
    this.clawLeftGroup.position.set(-this.clawConfig.spacingX, this.clawConfig.mountY, this.clawConfig.offsetZ);
    this.wristPitchGroup.add(this.clawLeftGroup);

    this.clawRightGroup = new THREE.Group();
    this.clawRightGroup.position.set(this.clawConfig.spacingX, this.clawConfig.mountY, this.clawConfig.offsetZ);
    this.wristPitchGroup.add(this.clawRightGroup);

    // Brass joint pin accent cylinders at each physical joint axis
    this.addJointPin(this.shoulderGroup, 32, 10);
    this.addJointPin(this.elbowGroup, 28, 8);
    // Brass pin at wrist roll base
    this.addJointPin(this.wristRollGroup, 24, 7);
    // Brass pin locking Arm 03 and Gripper base together through their vertical wall holes!
    this.addJointPin(this.wristPitchGroup, 22, 4.5);
  },

  addJointPin(parent, length, radius) {
    const pinGeo = new THREE.CylinderGeometry(radius, radius, length, 24);
    const pinMat = new THREE.MeshStandardMaterial({
      color: 0xD4A843,
      metalness: 0.75,
      roughness: 0.25
    });
    const pinMesh = new THREE.Mesh(pinGeo, pinMat);
    pinMesh.rotation.z = Math.PI / 2;
    parent.add(pinMesh);
  },

  loadModels() {
    if (typeof THREE.STLLoader === 'undefined') {
      console.warn('STLLoader not found, rendering procedural robot arm.');
      this.buildProceduralFallbacks();
      this.hideLoadingOverlay();
      return;
    }

    const loader = new THREE.STLLoader();

    // Material Palette matching Warm Light Design System
    const matCharcoal = new THREE.MeshStandardMaterial({
      color: 0x3E3832,
      roughness: 0.5,
      metalness: 0.35
    });

    const matTerracotta = new THREE.MeshStandardMaterial({
      color: 0xC4784A,
      roughness: 0.4,
      metalness: 0.25
    });

    const matWarmLinen = new THREE.MeshStandardMaterial({
      color: 0x6E6356,
      roughness: 0.45,
      metalness: 0.3
    });

    this.normalClawMat = matTerracotta;
    this.normalBaseMat = matCharcoal;
    this.matCollisionRed = new THREE.MeshStandardMaterial({
      color: 0xFF1E1E,
      emissive: 0x990000,
      emissiveIntensity: 0.8,
      roughness: 0.3,
      metalness: 0.4
    });

    const modelsToLoad = [
      // 1. Base Foundation
      {
        name: 'base',
        file: 'Base.STL',
        parent: this.baseGroup,
        material: matCharcoal,
        transform: (geo) => {
          geo.computeVertexNormals();
          geo.translate(-60.64, 0, -60.63);
        }
      },
      // 2. Rotating Waist (on top of Base)
      {
        name: 'waist',
        file: 'Waist.STL',
        parent: this.waistGroup,
        material: matTerracotta,
        transform: (geo) => {
          geo.computeVertexNormals();
          geo.translate(-48.43, 0, -49.23);
          geo.rotateY(Math.PI);
        }
      },
      // 3. Shoulder Arm 01
      {
        name: 'arm1',
        file: 'Arm 01.STL',
        parent: this.shoulderGroup,
        material: matWarmLinen,
        transform: (geo) => {
          geo.computeVertexNormals();
          geo.translate(-25.1, -23.7, -9.3);
          geo.rotateY(Math.PI / 2);
        }
      },
      // 4. Forearm Arm 02 v3
      {
        name: 'arm2',
        file: 'Arm 02 v3.STL',
        parent: this.elbowGroup,
        material: matTerracotta,
        transform: (geo) => {
          geo.computeVertexNormals();
          geo.translate(-19.2, -11.5, -16.8);
          geo.rotateY(Math.PI / 2);
        }
      },
      // 5. Wrist Roll Arm 03 (Starts after Arm 02 ends, rolls around Y)
      {
        name: 'arm3',
        file: 'Arm 03.STL',
        parent: this.wristRollGroup,
        material: matWarmLinen,
        transform: (geo) => {
          geo.computeVertexNormals();
          // Bottom hole is at (16.5, 5.0, 14.0). Top wall hole is at (16.5, 38.2, 9.1).
          geo.translate(-16.5, -5.0, -14.0);
          geo.rotateY(Math.PI / 2);
        }
      },
      // 6. Gripper Base (Mounted directly at vertical wall hole of Arm 03 inside wristPitchGroup)
      {
        name: 'gripper_base',
        file: 'Gripper base.STL',
        parent: this.wristPitchGroup,
        material: matCharcoal,
        transform: (geo) => {
          geo.computeVertexNormals();
          // The vertical wall mount hole in Gripper base is at (10.4, 14.0, 12.2).
          // Centering this hole to (0, 0, 0) makes it mate directly into Arm 03!
          geo.translate(-22.2, -14.0, -12.2);
          geo.rotateX(-Math.PI / 2);
        }
      },
      // 7. Left Claw Finger (Gripper 1.STL)
      {
        name: 'gripper_claw_left',
        file: 'Gripper 1.STL',
        parent: this.clawLeftGroup,
        material: matTerracotta,
        transform: (geo) => {
          geo.computeVertexNormals();
          // Opposite end pivot hole is at (4.25, 5.0, 60.3)
          geo.translate(-4.25, -5.0, -60.3);
          geo.rotateY(Math.PI / 2);
          geo.rotateZ(-Math.PI / 2);
        }
      },
      // 8. Right Claw Finger (Gripper 1.STL)
      {
        name: 'gripper_claw_right',
        file: 'Gripper 1.STL',
        parent: this.clawRightGroup,
        material: matTerracotta,
        transform: (geo) => {
          geo.computeVertexNormals();
          // Opposite end pivot hole is at (4.25, 5.0, 60.3)
          geo.translate(-4.25, -5.0, -60.3);
          geo.rotateY(Math.PI / 2);
          geo.rotateZ(-Math.PI / 2);
          geo.rotateY(Math.PI);
        }
      }
    ];

    let loadedCount = 0;
    const totalCount = modelsToLoad.length;

    modelsToLoad.forEach(item => {
      const url = `/assets/models/stl/${encodeURIComponent(item.file)}`;
      loader.load(
        url,
        (geometry) => {
          if (item.transform) item.transform(geometry);
          const mesh = new THREE.Mesh(geometry, item.material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          item.parent.add(mesh);
          this.meshes[item.name] = mesh;

          loadedCount++;
          if (loadedCount === totalCount) {
            this.updateClawPlacements();
            this.hideLoadingOverlay();
            this.updateStatusPill(true);
          }
        },
        undefined,
        (error) => {
          console.warn(`Could not load STL ${item.file}:`, error);
          loadedCount++;
          if (loadedCount === totalCount) {
            this.buildProceduralFallbacks();
            this.updateClawPlacements();
            this.hideLoadingOverlay();
            this.updateStatusPill(true);
          }
        }
      );
    });
  },

  buildProceduralFallbacks() {
    const matAccent = new THREE.MeshStandardMaterial({ color: 0xC4784A, roughness: 0.4, metalness: 0.2 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x3E3832, roughness: 0.5, metalness: 0.3 });

    if (!this.meshes['base']) {
      const bGeo = new THREE.CylinderGeometry(55, 60, 56, 32);
      const bMesh = new THREE.Mesh(bGeo, matDark);
      bMesh.position.y = 28;
      bMesh.castShadow = true;
      this.baseGroup.add(bMesh);
    }

    if (!this.meshes['waist']) {
      const wGeo = new THREE.CylinderGeometry(45, 48, 40, 32);
      const wMesh = new THREE.Mesh(wGeo, matAccent);
      wMesh.position.y = 20;
      wMesh.castShadow = true;
      this.waistGroup.add(wMesh);
    }

    if (!this.meshes['arm1']) {
      const a1Geo = new THREE.BoxGeometry(24, this.L2, 28);
      const a1Mesh = new THREE.Mesh(a1Geo, matDark);
      a1Mesh.position.y = this.L2 / 2;
      a1Mesh.castShadow = true;
      this.shoulderGroup.add(a1Mesh);
    }

    if (!this.meshes['arm2']) {
      const a2Geo = new THREE.BoxGeometry(20, this.L3, 24);
      const a2Mesh = new THREE.Mesh(a2Geo, matAccent);
      a2Mesh.position.y = this.L3 / 2;
      a2Mesh.castShadow = true;
      this.elbowGroup.add(a2Mesh);
    }

    if (!this.meshes['gripper_base']) {
      const gGeo = new THREE.BoxGeometry(36, 65, 26);
      const gMesh = new THREE.Mesh(gGeo, matDark);
      gMesh.position.y = 32.5;
      gMesh.castShadow = true;
      this.wristPitchGroup.add(gMesh);
    }
  },

  hideLoadingOverlay() {
    this.isLoading = false;
    const overlay = document.getElementById('dtLoadingOverlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.style.display = 'none'; }, 400);
    }
  },

  updateStatusPill(isReady) {
    const pill = document.getElementById('dtStatusPill');
    if (!pill) return;
    if (isReady) {
      pill.className = 'status-pill connected';
      pill.innerHTML = `
        <span class="status-dot"></span>
        <span>Digital Twin: 3D CAD Synced with Live Telemetry</span>
      `;
    } else {
      pill.className = 'status-pill';
      pill.innerHTML = `
        <span class="status-dot"></span>
        <span>Digital Twin: Standing By</span>
      `;
    }
  },

  /* Dynamically retrieve calibrated Gripper Open Angle */
  getGripperOpenAngle() {
    const el = document.getElementById('angleGripperOpen') || document.getElementById('inputGripperOpenCard');
    const stored = localStorage.getItem('gripper_open');
    const val = parseInt(el ? el.value : (stored || 140), 10);
    return (isNaN(val) || val <= 0) ? 140 : Math.max(0, Math.min(180, val));
  },

  /* Get Default Safe Home Pose dynamically utilizing openAngle */
  getHomeAngles() {
    return [90, 90, 90, 90, 90, this.getGripperOpenAngle()];
  },

  /* Initialize Geofencing and Table Protection State */
  initGeofencing() {
    this.lastSafeAngles = this.getHomeAngles();
    try {
      const stored = localStorage.getItem('dt_geofence_enabled');
      if (stored !== null) {
        this.geofenceEnabled = (stored === 'true');
      } else {
        this.geofenceEnabled = false;
      }
    } catch (e) {
      this.geofenceEnabled = false;
    }
    this.updateGeofenceButtonUI();
    this.updateClearanceDisplay(this.currentClearanceMm, false);
  },

  /* Toggle Geofencing ON / OFF via User Button */
  toggleGeofence() {
    this.geofenceEnabled = !this.geofenceEnabled;
    try {
      localStorage.setItem('dt_geofence_enabled', this.geofenceEnabled ? 'true' : 'false');
    } catch (e) {}

    this.updateGeofenceButtonUI();

    if (!this.geofenceEnabled) {
      if (this.collisionBanner) {
        this.collisionBanner.style.display = 'none';
      }
      this.updateClearanceDisplay(0, false);
      if (window.App && App.log) {
        App.log('Digital Twin: Table Geofencing Protection BYPASSED (OFF).');
      }
    } else {
      if (window.App && App.log) {
        App.log(`Digital Twin: Table Geofencing Protection ACTIVE (ON). Safety ceiling: ${this.tableFloorLimitY}mm.`);
      }
    }
  },

  /* Update Geofence Toggle Button UI styling */
  updateGeofenceButtonUI() {
    const btn = document.getElementById('btnDtToggleGeofence');
    if (btn) {
      if (this.geofenceEnabled) {
        btn.textContent = 'Table Safety: ON';
        btn.style.background = '#00B048';
        btn.style.borderColor = '#00B048';
        btn.style.color = '#FFFFFF';
      } else {
        btn.textContent = 'Table Safety: OFF';
        btn.style.background = '#555555';
        btn.style.borderColor = '#444444';
        btn.style.color = '#BBBBBB';
      }
    }
  },

  /* Update Live Vertical Clearance Readout Meter */
  updateClearanceDisplay(clearanceMm, isBreached) {
    const meter = document.getElementById('dtClearanceMeter');
    if (!meter) return;
    if (!this.geofenceEnabled) {
      meter.textContent = 'Safety: BYPASSED';
      meter.style.color = '#888888';
      meter.style.background = 'rgba(150, 150, 150, 0.12)';
      meter.style.borderColor = 'rgba(150, 150, 150, 0.25)';
      return;
    }

    if (isBreached) {
      meter.textContent = 'Clearance: 0.0 mm (BLOCKED)';
      meter.style.color = '#E53935';
      meter.style.background = 'rgba(229, 57, 53, 0.15)';
      meter.style.borderColor = 'rgba(229, 57, 53, 0.35)';
    } else {
      meter.textContent = `Clearance: ${Math.round(clearanceMm)} mm`;
      meter.style.color = '#00B048';
      meter.style.background = 'rgba(0, 176, 72, 0.12)';
      meter.style.borderColor = 'rgba(0, 176, 72, 0.25)';
    }
  },

  /* Display Floating Table Collision Alert and Highlight Meshes Red */
  triggerTableCollisionAlert(lowestY) {
    if (!this.geofenceEnabled) return;

    if (!this.collisionBanner) {
      this.collisionBanner = document.getElementById('dtCollisionBanner');
    }
    if (this.collisionBanner) {
      this.collisionBanner.textContent = `TABLE PENETRATION DETECTED (${lowestY.toFixed(1)}mm <= ${this.tableFloorLimitY.toFixed(1)}mm): REVERTED TO SAFE POSE`;
      this.collisionBanner.style.display = 'block';
      this.collisionBanner.style.opacity = '1';
    }

    // Highlight claws in bright red
    if (this.matCollisionRed) {
      if (this.meshes['gripper_claw_left']) this.meshes['gripper_claw_left'].material = this.matCollisionRed;
      if (this.meshes['gripper_claw_right']) this.meshes['gripper_claw_right'].material = this.matCollisionRed;
      if (this.meshes['gripper_base']) this.meshes['gripper_base'].material = this.matCollisionRed;
    }

    if (this.collisionAlertTimer) {
      clearTimeout(this.collisionAlertTimer);
    }
    this.collisionAlertTimer = setTimeout(() => {
      if (this.collisionBanner) {
        this.collisionBanner.style.opacity = '0';
        setTimeout(() => {
          if (this.collisionBanner) this.collisionBanner.style.display = 'none';
        }, 250);
      }
      // Restore normal materials
      if (this.normalClawMat) {
        if (this.meshes['gripper_claw_left']) this.meshes['gripper_claw_left'].material = this.normalClawMat;
        if (this.meshes['gripper_claw_right']) this.meshes['gripper_claw_right'].material = this.normalClawMat;
      }
      if (this.normalBaseMat && this.meshes['gripper_base']) {
        this.meshes['gripper_base'].material = this.normalBaseMat;
      }
    }, 1400);
  },

  /* Evaluates whether candidate angles cause arm/gripper meshes to penetrate table safety floor */
  evaluateAnglesSafety(candidateAngles) {
    if (!this.geofenceEnabled) {
      return { isSafe: true, lowestY: 50.0, clearanceMm: 50.0 };
    }
    if (!this.robotRoot || !this.wristPitchGroup) {
      return { isSafe: true, lowestY: 100.0, clearanceMm: 100.0 };
    }
    if (!Array.isArray(candidateAngles) || candidateAngles.length < 6) {
      return { isSafe: true, lowestY: 100.0, clearanceMm: 100.0 };
    }

    const deg2rad = Math.PI / 180;
    const [a0, a1, a2, a3, a4, a5] = candidateAngles;

    // Cache current group rotations
    const prevW = this.waistGroup ? this.waistGroup.rotation.y : 0;
    const prevS = this.shoulderGroup ? this.shoulderGroup.rotation.x : 0;
    const prevE = this.elbowGroup ? this.elbowGroup.rotation.x : 0;
    const prevWR = this.wristRollGroup ? this.wristRollGroup.rotation.y : 0;
    const prevWP = this.wristPitchGroup ? this.wristPitchGroup.rotation.x : 0;
    const prevCL = this.clawLeftGroup ? this.clawLeftGroup.rotation.z : 0;
    const prevCR = this.clawRightGroup ? this.clawRightGroup.rotation.z : 0;

    // Apply candidate rotations to scene graph
    if (this.waistGroup) this.waistGroup.rotation.y = (a0 - 90) * deg2rad;
    if (this.shoulderGroup) this.shoulderGroup.rotation.x = (90 - a1) * deg2rad;
    if (this.elbowGroup) this.elbowGroup.rotation.x = (a2 - 45) * deg2rad;
    if (this.wristRollGroup) this.wristRollGroup.rotation.y = (a3 - 90) * deg2rad;
    if (this.wristPitchGroup) this.wristPitchGroup.rotation.x = (a4 - 90) * deg2rad;
    if (this.clawLeftGroup && this.clawRightGroup) {
      const openRatio = Math.max(0, Math.min(1, (a5 - 35) / 105));
      const spreadAngle = openRatio * this.clawConfig.maxSpread;
      this.clawLeftGroup.rotation.z = this.clawConfig.restAngle + spreadAngle;
      this.clawRightGroup.rotation.z = -this.clawConfig.restAngle - spreadAngle;
    }

    // Force world transform matrix computation
    this.robotRoot.updateMatrixWorld(true);

    // Compute bounding box of wristPitchGroup (which holds gripper base & claws)
    const box = new THREE.Box3();
    box.setFromObject(this.wristPitchGroup);
    let lowestY = box.min.y;

    // Also check elbow group for extreme backward dip
    if (this.elbowGroup) {
      const ebBox = new THREE.Box3();
      ebBox.setFromObject(this.elbowGroup);
      lowestY = Math.min(lowestY, ebBox.min.y);
    }

    // Restore previous rotations
    if (this.waistGroup) this.waistGroup.rotation.y = prevW;
    if (this.shoulderGroup) this.shoulderGroup.rotation.x = prevS;
    if (this.elbowGroup) this.elbowGroup.rotation.x = prevE;
    if (this.wristRollGroup) this.wristRollGroup.rotation.y = prevWR;
    if (this.wristPitchGroup) this.wristPitchGroup.rotation.x = prevWP;
    if (this.clawLeftGroup) this.clawLeftGroup.rotation.z = prevCL;
    if (this.clawRightGroup) this.clawRightGroup.rotation.z = prevCR;
    this.robotRoot.updateMatrixWorld(true);

    const isSafe = (lowestY > this.tableFloorLimitY);
    const clearanceMm = Math.max(0, lowestY - this.tableFloorLimitY);

    if (isSafe) {
      this.lastSafeAngles = [...candidateAngles];
      this.lowestMeshY = lowestY;
      this.currentClearanceMm = clearanceMm;
      this.updateClearanceDisplay(clearanceMm, false);
    } else {
      this.triggerTableCollisionAlert(lowestY);
      this.updateClearanceDisplay(0, true);
    }

    return { isSafe, lowestY, clearanceMm };
  },

  /* Update Joint Angles from Backend WebSocket Status */
  updateAngles(angles) {
    if (!Array.isArray(angles) || angles.length < 6) return;

    for (let i = 0; i < 6; i++) {
      this.targetAngles[i] = Number(angles[i]);
      const readout = document.getElementById(`dtVal${i}`);
      if (readout) {
        readout.textContent = `${Math.round(angles[i])}°`;
      }
    }
  },

  /* Get Default Camera View (from localStorage or factory isometric perspective) */
  getDefaultCameraView() {
    try {
      const saved = localStorage.getItem('dt_camera_default');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.pos && parsed.target) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read dt_camera_default from localStorage:', e);
    }

    // High-visibility factory 3/4 isometric perspective:
    // Captures 6-DOF arm articulation, tabletop workspace, and yellow sponge block in clear 3D depth
    return {
      pos: { x: 260, y: 280, z: 380 },
      target: { x: 0, y: 110, z: 150 }
    };
  },

  /* Set Current Camera View as User Default */
  setDefaultCamera() {
    if (!this.camera || !this.controls) return;
    const customView = {
      pos: {
        x: Math.round(this.camera.position.x * 10) / 10,
        y: Math.round(this.camera.position.y * 10) / 10,
        z: Math.round(this.camera.position.z * 10) / 10
      },
      target: {
        x: Math.round(this.controls.target.x * 10) / 10,
        y: Math.round(this.controls.target.y * 10) / 10,
        z: Math.round(this.controls.target.z * 10) / 10
      }
    };
    try {
      localStorage.setItem('dt_camera_default', JSON.stringify(customView));
    } catch (e) {
      console.warn('Failed to save dt_camera_default:', e);
    }

    // Persist to backend server disk so it survives server restarts, hard refreshes, and multi-device access
    fetch('/api/digital_twin/camera_default', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customView)
    }).catch(err => {
      console.warn('Could not persist camera_default to backend:', err);
    });

    this.showCameraToast('Camera View Saved as Default');

    const btn = document.getElementById('btnDtSetDefaultCamera');
    if (btn) {
      const origText = btn.textContent;
      btn.textContent = 'Default Saved!';
      btn.style.color = 'var(--accent-primary)';
      btn.style.borderColor = 'var(--accent-primary)';
      setTimeout(() => {
        btn.textContent = origText;
        btn.style.color = '';
        btn.style.borderColor = '';
      }, 1500);
    }
  },

  /* Reset Viewport Camera to Saved Default or Factory View */
  resetCamera() {
    if (!this.camera) return;
    const view = this.getDefaultCameraView();
    this.camera.position.set(view.pos.x, view.pos.y, view.pos.z);
    if (this.controls) {
      this.controls.target.set(view.target.x, view.target.y, view.target.z);
      this.controls.update();
    }
    this.showCameraToast('Camera Reset to Default View');
  },

  /* Floating Toast Notification in 3D Viewport */
  showCameraToast(message) {
    if (!this.container) return;
    let toast = document.getElementById('dtCameraToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'dtCameraToast';
      toast.style.position = 'absolute';
      toast.style.top = '16px';
      toast.style.left = '50%';
      toast.style.transform = 'translateX(-50%)';
      toast.style.background = 'rgba(26, 24, 23, 0.94)';
      toast.style.border = '1px solid var(--accent-primary)';
      toast.style.color = '#FAF7F2';
      toast.style.fontFamily = 'var(--font-mono)';
      toast.style.fontSize = '0.78rem';
      toast.style.padding = '8px 18px';
      toast.style.borderRadius = '20px';
      toast.style.zIndex = '30';
      toast.style.pointerEvents = 'none';
      toast.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.35)';
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      this.container.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-8px)';
    }, 1800);
  },

  /* Quick Focus Camera Orbit Target on Yellow Sponge Block */
  focusOnBlock() {
    if (!this.controls) return;
    const bx = this.currentBlock3D.x;
    const by = this.currentBlock3D.y;
    const bz = this.currentBlock3D.z;
    this.controls.target.set(bx, by, bz);
    this.controls.update();
    this.showCameraToast('Orbit Target Locked to Yellow Sponge Block');
  },

  /* Quick Focus Camera Orbit Target on Robot Arm */
  focusOnArm() {
    if (!this.controls) return;
    this.controls.target.set(0, 110, 80);
    this.controls.update();
    this.showCameraToast('Orbit Target Locked to Robot Arm');
  },

  /* Keyboard Event Handlers for WASD + Elevation Camera Movement */
  setupKeyboardControls() {
    window.addEventListener('keydown', (e) => {
      // Do not capture keys if typing in form inputs
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable)) {
        return;
      }

      // Only active when digital twin panel is active
      const dtPanel = document.getElementById('panel-digital-twin');
      if (!dtPanel || !dtPanel.classList.contains('active')) {
        return;
      }

      const key = e.key.toLowerCase();
      let handled = false;

      if (key === 'w' || e.key === 'ArrowUp') { this.keysPressed.w = true; handled = true; }
      if (key === 's' || e.key === 'ArrowDown') { this.keysPressed.s = true; handled = true; }
      if (key === 'a' || e.key === 'ArrowLeft') { this.keysPressed.a = true; handled = true; }
      if (key === 'd' || e.key === 'ArrowRight') { this.keysPressed.d = true; handled = true; }
      if (key === 'e' || e.key === 'PageUp' || e.code === 'Space') { this.keysPressed.e = true; handled = true; }
      if (key === 'q' || e.key === 'PageDown') { this.keysPressed.q = true; handled = true; }
      if (e.key === 'Shift') { this.keysPressed.Shift = true; }

      if (handled) {
        e.preventDefault();
        this._userMovedCamera = true;
        this.syncNavButtonsUI();
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') this.keysPressed.w = false;
      if (key === 's' || e.key === 'ArrowDown') this.keysPressed.s = false;
      if (key === 'a' || e.key === 'ArrowLeft') this.keysPressed.a = false;
      if (key === 'd' || e.key === 'ArrowRight') this.keysPressed.d = false;
      if (key === 'e' || e.key === 'PageUp' || e.code === 'Space') this.keysPressed.e = false;
      if (key === 'q' || e.key === 'PageDown') this.keysPressed.q = false;
      if (e.key === 'Shift') this.keysPressed.Shift = false;

      this.syncNavButtonsUI();
    });
  },

  /* Update On-Screen Navigation Button Styles */
  syncNavButtonsUI() {
    const updateBtn = (id, active) => {
      const el = document.getElementById(id);
      if (el) {
        if (active) {
          el.style.background = 'var(--accent-primary)';
          el.style.color = '#FFFFFF';
          el.style.borderColor = 'var(--accent-primary)';
        } else {
          el.style.background = '';
          el.style.color = '';
          el.style.borderColor = '';
        }
      }
    };

    updateBtn('dtBtnNavW', this.keysPressed.w || this.activeNavDirs.forward);
    updateBtn('dtBtnNavS', this.keysPressed.s || this.activeNavDirs.backward);
    updateBtn('dtBtnNavA', this.keysPressed.a || this.activeNavDirs.left);
    updateBtn('dtBtnNavD', this.keysPressed.d || this.activeNavDirs.right);
    updateBtn('dtBtnNavUp', this.keysPressed.e || this.activeNavDirs.up);
    updateBtn('dtBtnNavDown', this.keysPressed.q || this.activeNavDirs.down);
  },

  /* Bind Mouse/Touch Hold Listeners for Directional Buttons */
  bindNavButtonHold(buttonEl, dirName) {
    if (!buttonEl) return;
    const startMove = (e) => {
      e.preventDefault();
      this.activeNavDirs[dirName] = true;
      this.syncNavButtonsUI();
    };
    const stopMove = (e) => {
      e.preventDefault();
      this.activeNavDirs[dirName] = false;
      this.syncNavButtonsUI();
    };

    buttonEl.addEventListener('mousedown', startMove);
    buttonEl.addEventListener('mouseup', stopMove);
    buttonEl.addEventListener('mouseleave', stopMove);
    buttonEl.addEventListener('touchstart', startMove, { passive: false });
    buttonEl.addEventListener('touchend', stopMove, { passive: false });
    buttonEl.addEventListener('touchcancel', stopMove, { passive: false });
  },

  /* 60 FPS Camera Free Flight & Coupled Orbit Target Movement */
  updateCameraMovement() {
    if (!this.camera) return;

    const forwardKey = this.keysPressed.w || this.activeNavDirs.forward;
    const backwardKey = this.keysPressed.s || this.activeNavDirs.backward;
    const leftKey = this.keysPressed.a || this.activeNavDirs.left;
    const rightKey = this.keysPressed.d || this.activeNavDirs.right;
    const upKey = this.keysPressed.e || this.activeNavDirs.up;
    const downKey = this.keysPressed.q || this.activeNavDirs.down;

    const isMoving = forwardKey || backwardKey || leftKey || rightKey || upKey || downKey;
    const now = performance.now();

    if (!isMoving) {
      this.lastNavTime = now;
      return;
    }

    const dt = this.lastNavTime ? Math.min((now - this.lastNavTime) / 1000, 0.1) : 0.016;
    this.lastNavTime = now;

    // Movement speed: 240 mm/s (Shift boost: 520 mm/s)
    const speed = (this.keysPressed.Shift ? 520 : 240) * dt;

    // Camera forward vector in horizontal ground plane
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 0.0001) {
      forward.set(0, 0, -1);
    } else {
      forward.normalize();
    }

    // Right vector (perpendicular to forward in XZ plane)
    const right = new THREE.Vector3();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const moveVec = new THREE.Vector3(0, 0, 0);

    if (forwardKey) moveVec.add(forward);
    if (backwardKey) moveVec.sub(forward);
    if (rightKey) moveVec.add(right);
    if (leftKey) moveVec.sub(right);
    if (upKey) moveVec.y += 1.0;
    if (downKey) moveVec.y -= 1.0;

    if (moveVec.lengthSq() > 0.0001) {
      moveVec.normalize().multiplyScalar(speed);

      // Translate BOTH camera position and orbit target together so orbit center moves with camera
      this.camera.position.add(moveVec);
      if (this.controls) {
        this.controls.target.add(moveVec);
      }
    }
  },

  /* Toggle Ground Grid */
  toggleGrid() {
    this.isGridVisible = !this.isGridVisible;
    if (this.gridHelper) {
      this.gridHelper.visible = this.isGridVisible;
    }
    if (this.groundMesh) {
      this.groundMesh.visible = this.isGridVisible;
    }
    if (this.ringMesh) {
      this.ringMesh.visible = this.isGridVisible;
    }
  },

  /* Move to Default Home Pose (90° All with dynamic open angle) */
  setHomePose() {
    this.updateAngles(this.getHomeAngles());
  },

  setupResizeObserver() {
    if (!window.ResizeObserver) return;
    const ro = new ResizeObserver(() => {
      this.onResize();
    });
    ro.observe(this.container);
  },

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  },

  /* Build Physical Workspace Pad (25cm x 30cm) directly in front of the arm */
  buildWorkspace() {
    this.workspaceGroup = new THREE.Group();
    this.workspaceGroup.name = 'workspace_pad';

    const width = this.workspaceConfig.widthMm;   // 300 mm (X)
    const depth = this.workspaceConfig.depthMm;   // 250 mm (Z)
    const thickness = 1.6;

    // Create high-resolution canvas texture for white mat with clean grid lines
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024 * (depth / width); // maintain aspect ratio
    const ctx = canvas.getContext('2d');

    // Fill white background with subtle warmth
    ctx.fillStyle = '#FAFAF8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw outer border
    ctx.strokeStyle = '#D5CEC5';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

    // Inner accent border
    ctx.strokeStyle = '#C4784A';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Grid: 6 columns (X) by 5 rows (Y), 50mm (5cm) squares
    const numCols = 6;
    const numRows = 5;
    const stepX = (canvas.width - 20) / numCols;
    const stepY = (canvas.height - 20) / numRows;

    // Grid lines
    ctx.strokeStyle = '#E2DDD6';
    ctx.lineWidth = 1.5;
    for (let c = 1; c < numCols; c++) {
      ctx.beginPath();
      ctx.moveTo(10 + c * stepX, 10);
      ctx.lineTo(10 + c * stepX, canvas.height - 10);
      ctx.stroke();
    }
    for (let r = 1; r < numRows; r++) {
      ctx.beginPath();
      ctx.moveTo(10, 10 + r * stepY);
      ctx.lineTo(canvas.width - 10, 10 + r * stepY);
      ctx.stroke();
    }

    // Origin Badge (ArUco ID 2 at bottom-left corner of workspace)
    // Physical origin (X=0, Y=0) for vision coordinates
    const markerSize = Math.min(stepX, stepY) * 0.75;
    const markerX = 16;
    const markerY = canvas.height - markerSize - 16;

    // Marker background (black border)
    ctx.fillStyle = '#000000';
    ctx.fillRect(markerX, markerY, markerSize, markerSize);

    // Inner 4x4 ArUco Marker ID 2 bit representation
    // ID 2 in 4x4: row0: [1,1,0,0], row1: [1,1,0,0], row2: [1,1,0,1], row3: [0,0,1,0]
    const bitMatrix = [
      [1, 1, 0, 0],
      [1, 1, 0, 0],
      [1, 1, 0, 1],
      [0, 0, 1, 0]
    ];
    const cellSize = (markerSize * 0.66) / 4;
    const innerOffset = markerSize * 0.17;
    ctx.fillStyle = '#FFFFFF';
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if (bitMatrix[row][col] === 1) {
          ctx.fillRect(
            markerX + innerOffset + col * cellSize,
            markerY + innerOffset + row * cellSize,
            cellSize,
            cellSize
          );
        }
      }
    }

    // Grid coordinate numbers & text labels
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#8B847E';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Origin (ID: 2) (0,0)', markerX + markerSize + 8, markerY + markerSize / 2);

    // Size text top-right
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = '#C4784A';
    ctx.textAlign = 'right';
    ctx.fillText('WORKSPACE 25cm x 30cm', canvas.width - 24, 38);

    // Coordinate axis arrows on pad
    ctx.font = 'bold 18px monospace';
    ctx.fillStyle = '#D9534F';
    ctx.fillText('+X (Width 30cm) ->', markerX + markerSize + 8, markerY + markerSize + 2);
    ctx.fillStyle = '#4E8046';
    ctx.fillText('^ +Y (Depth 25cm)', markerX, markerY - 12);

    // Grid dimension numbers along edges
    ctx.font = '16px monospace';
    ctx.fillStyle = '#A89E96';
    ctx.textAlign = 'center';
    for (let c = 1; c < numCols; c++) {
      const xCm = c * 5;
      ctx.fillText(`${xCm}cm`, 10 + c * stepX, canvas.height - 12);
    }
    ctx.textAlign = 'right';
    for (let r = 1; r < numRows; r++) {
      const yCm = (numRows - r) * 5;
      ctx.fillText(`${yCm}cm`, canvas.width - 14, 10 + r * stepY + 4);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;

    const padGeo = new THREE.BoxGeometry(width, thickness, depth);
    const padMat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.7,
      metalness: 0.05
    });

    this.workspaceMesh = new THREE.Mesh(padGeo, padMat);
    this.workspaceMesh.receiveShadow = true;
    this.workspaceGroup.add(this.workspaceMesh);

    // Subtle edge rim around the pad
    const rimMat = new THREE.MeshBasicMaterial({ color: 0xD5CEC5 });
    const edgeGeo = new THREE.EdgesGeometry(padGeo);
    this.workspaceEdgeMesh = new THREE.LineSegments(edgeGeo, rimMat);
    this.workspaceGroup.add(this.workspaceEdgeMesh);

    // 3D Axis Helper at Marker ID 2 (Bottom-left origin of physical workspace at near edge)
    const originAxis = new THREE.AxesHelper(35);
    originAxis.position.set(-width / 2 + 15, thickness / 2 + 1, -depth / 2 + 15);
    // Orient axes: Red = +X (along width), Green = +Y (up), Blue = +Z (along depth)
    this.workspaceGroup.add(originAxis);

    this.scene.add(this.workspaceGroup);
    this.updateWorkspacePosition();
  },

  /* Position workspace pad in front of arm based on distFromArmCm */
  updateWorkspacePosition() {
    if (!this.workspaceGroup) return;

    const distMm = this.workspaceConfig.distFromArmCm * 10.0;
    const baseRadius = this.workspaceConfig.baseRadiusMm;
    const depth = this.workspaceConfig.depthMm;
    const thickness = 1.6;

    // Near edge of workspace sits (baseRadius + distMm) in front of robot base (+Z)
    // Center Z = near edge + (depth / 2)
    const centerZ = baseRadius + distMm + (depth / 2.0);
    const centerY = thickness / 2.0;

    this.workspaceGroup.position.set(0, centerY, centerZ);

    // Recompute current block 3D target coordinates when workspace moves
    this.updateBlock3DPosition(
      this.blockPose.x_cm,
      this.blockPose.y_cm,
      this.blockPose.theta_deg,
      this.blockPose.valid
    );
  },

  /* Build 3D ArUco Target Block (40mm x 40mm x 40mm) */
  buildTargetBlock() {
    this.blockGroup = new THREE.Group();
    this.blockGroup.name = 'aruco_target_block';

    const size = this.workspaceConfig.blockSizeMm; // 40 mm cube

    // 1. Create top face ArUco Marker ID 0 texture
    // Bit matrix for ArUco 4x4 ID 0:
    // row0: [0, 1, 0, 0], row1: [1, 0, 1, 0], row2: [1, 1, 0, 0], row3: [1, 1, 0, 1]
    const tagCanvas = document.createElement('canvas');
    tagCanvas.width = 256;
    tagCanvas.height = 256;
    const tctx = tagCanvas.getContext('2d');

    // Foam block color border (vibrant sponge foam yellow)
    tctx.fillStyle = '#E5B824';
    tctx.fillRect(0, 0, 256, 256);

    // Black marker border
    tctx.fillStyle = '#000000';
    tctx.fillRect(24, 24, 208, 208);

    // 4x4 bit grid
    const bitMatrix0 = [
      [0, 1, 0, 0],
      [1, 0, 1, 0],
      [1, 1, 0, 0],
      [1, 1, 0, 1]
    ];
    const cellSize = 140 / 4;
    tctx.fillStyle = '#FFFFFF';
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (bitMatrix0[r][c] === 1) {
          tctx.fillRect(58 + c * cellSize, 58 + r * cellSize, cellSize, cellSize);
        }
      }
    }

    // Direction indicator on block top face (+Y heading dot)
    tctx.fillStyle = '#FF4444';
    tctx.beginPath();
    tctx.arc(128, 14, 8, 0, Math.PI * 2);
    tctx.fill();

    const tagTexture = new THREE.CanvasTexture(tagCanvas);

    // Materials: top has ArUco marker, sides are yellow sponge foam
    const sideMat = new THREE.MeshStandardMaterial({
      color: 0xE5B824,
      roughness: 0.6,
      metalness: 0.1,
      transparent: true,
      opacity: 0.95
    });
    const topMat = new THREE.MeshStandardMaterial({
      map: tagTexture,
      roughness: 0.4,
      metalness: 0.1,
      transparent: true,
      opacity: 0.98
    });
    const bottomMat = new THREE.MeshStandardMaterial({
      color: 0xC89C18,
      roughness: 0.8,
      transparent: true,
      opacity: 0.95
    });

    const cubeMats = [
      sideMat,   // +X
      sideMat,   // -X
      topMat,    // +Y (Top face with ArUco ID 0)
      bottomMat, // -Y (Bottom)
      sideMat,   // +Z (Front)
      sideMat    // -Z (Back)
    ];

    const blockGeo = new THREE.BoxGeometry(size, size, size);
    this.blockMesh = new THREE.Mesh(blockGeo, cubeMats);
    this.blockMesh.castShadow = true;
    this.blockMesh.receiveShadow = true;
    this.blockMesh.position.y = size / 2.0; // rest on ground plane
    this.blockGroup.add(this.blockMesh);

    // Heading arrow on block
    const arrowDir = new THREE.Vector3(0, 0, -1);
    const arrowOrigin = new THREE.Vector3(0, size + 2, 0);
    this.blockArrow = new THREE.ArrowHelper(arrowDir, arrowOrigin, 20, 0xFF4444, 8, 4);
    this.blockGroup.add(this.blockArrow);

    // 2. Floating HUD Billboard Label above the block
    this.labelCanvas = document.createElement('canvas');
    this.labelCanvas.width = 512;
    this.labelCanvas.height = 160;
    this.labelCtx = this.labelCanvas.getContext('2d');
    this.labelTexture = new THREE.CanvasTexture(this.labelCanvas);

    const spriteMat = new THREE.SpriteMaterial({
      map: this.labelTexture,
      transparent: true,
      depthTest: false
    });
    this.blockLabelSprite = new THREE.Sprite(spriteMat);
    this.blockLabelSprite.position.set(0, size + 34, 0);
    this.blockLabelSprite.scale.set(68, 21.25, 1);
    this.blockGroup.add(this.blockLabelSprite);

    this.updateBlockLabel('Block 1 (Tag 0)', 'X: 15.0cm  Y: 12.5cm  θ: 0°');

    // Initial position on workspace center
    this.scene.add(this.blockGroup);
    this.updateBlock3DPosition(15.0, 12.5, 0.0, false);
  },

  /* Update floating 2D text label over target block */
  updateBlockLabel(title, coordsText) {
    if (!this.labelCtx || !this.labelTexture) return;

    const ctx = this.labelCtx;
    ctx.clearRect(0, 0, 512, 160);

    // Pill background
    ctx.fillStyle = 'rgba(26, 24, 23, 0.92)';
    ctx.strokeStyle = this.blockPose.valid ? '#C4784A' : 'rgba(224, 214, 200, 0.3)';
    ctx.lineWidth = 4;

    const r = 18;
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(512 - r, 0);
    ctx.quadraticCurveTo(512, 0, 512, r);
    ctx.lineTo(512, 160 - r);
    ctx.quadraticCurveTo(512, 160, 512 - r, 160);
    ctx.lineTo(r, 160);
    ctx.quadraticCurveTo(0, 160, 0, 160 - r);
    ctx.lineTo(0, r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Status dot
    ctx.fillStyle = this.blockPose.valid ? '#4E8046' : '#C4784A';
    ctx.beginPath();
    ctx.arc(28, 44, 10, 0, Math.PI * 2);
    ctx.fill();

    // Title line
    ctx.font = 'bold 34px sans-serif';
    ctx.fillStyle = '#FAF7F2';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 50, 44);

    // Coordinates line
    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = '#C4784A';
    ctx.fillText(coordsText, 24, 104);

    this.labelTexture.needsUpdate = true;
  },

  /* Transform real-world workspace coordinates (cm) to 3D Three.js world coordinates (mm) */
  updateBlock3DPosition(x_cm, y_cm, theta_deg, valid) {
    this.blockPose.x_cm = x_cm;
    this.blockPose.y_cm = y_cm;
    this.blockPose.theta_deg = theta_deg;
    this.blockPose.valid = Boolean(valid);

    const distMm = this.workspaceConfig.distFromArmCm * 10.0;
    const baseRadius = this.workspaceConfig.baseRadiusMm;
    const thickness = 1.6;

    // Coordinate conversion:
    // Physical Workspace width X = 30cm, robot base is aligned at X = 15cm (center)
    // Three.js X_3D (mm) = (X_cm - 15.0) * 10.0
    const x_3d = (x_cm - 15.0) * 10.0;

    // Physical Workspace depth Y = 25cm (0cm is near edge 3.8cm from arm, 25cm is far edge)
    // Inverted Y axis fix: When Y=0 (near edge closest to arm), Z_3D = baseRadius + distMm
    // When Y=25 (far edge away from arm), Z_3D = baseRadius + distMm + (25.0 * 10.0)
    const z_3d = baseRadius + distMm + ((25.0 - y_cm) * 10.0);

    // Block rests on top of the workspace pad surface
    const y_3d = thickness;

    // Heading rotation: ArUco rotation around vertical Y-axis
    const theta_rad = -theta_deg * (Math.PI / 180.0);

    this.targetBlock3D.x = x_3d;
    this.targetBlock3D.y = y_3d;
    this.targetBlock3D.z = z_3d;
    this.targetBlock3D.theta = theta_rad;

    // Update HUD text
    const statusStr = this.blockPose.valid ? 'Active Track' : 'Simulated / Standby';
    this.updateBlockLabel(
      `ArUco 0 • ${statusStr}`,
      `X: ${x_cm.toFixed(1)}cm  Y: ${y_cm.toFixed(1)}cm  θ: ${Math.round(theta_deg)}°`
    );

    // Update badge in viewport
    const badge = document.getElementById('dtBlockVisionBadge');
    if (badge) {
      if (this.blockPose.valid) {
        badge.style.color = '#7DB26C';
        badge.style.borderColor = 'rgba(125, 178, 108, 0.4)';
        badge.textContent = `ArUco Block: Tracking (${x_cm.toFixed(1)}cm, ${y_cm.toFixed(1)}cm, ${Math.round(theta_deg)}°)`;
      } else {
        badge.style.color = '#C4784A';
        badge.style.borderColor = 'rgba(196, 120, 74, 0.35)';
        badge.textContent = `ArUco Vision: Standby (${x_cm.toFixed(1)}cm, ${y_cm.toFixed(1)}cm)`;
      }
    }
  },

  /* Update Block Pose from Camera 1 Perception Streaming */
  updateBlockPose(pose) {
    if (!pose || typeof pose !== 'object') return;
    if (!this.workspaceConfig.liveCameraSync) return; // Ignore live vision if user is in manual mode

    const x_cm = pose.x_cm !== undefined ? Number(pose.x_cm) : (pose.x !== undefined ? Number(pose.x) : 15.0);
    const y_cm = pose.y_cm !== undefined ? Number(pose.y_cm) : (pose.y !== undefined ? Number(pose.y) : 12.5);
    const theta_deg = pose.theta_deg !== undefined ? Number(pose.theta_deg) : (pose.theta !== undefined ? Number(pose.theta) : 0.0);
    const valid = pose.valid !== undefined ? Boolean(pose.valid) : true;

    this.updateBlock3DPosition(x_cm, y_cm, theta_deg, valid);
  },

  /* Start periodic perception polling fallback for offline / low-rate states */
  startVisionPolling() {
    setInterval(() => {
      if (!this.workspaceConfig.liveCameraSync) return;

      fetch('/api/vision/status')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.latest_block_pose) {
            this.updateBlockPose(data.latest_block_pose);
          }
        })
        .catch(() => {
          // Camera/backend offline; maintain last pose in standby state
        });
    }, 250);
  },

  /* Main 60 FPS Render & Articulation Loop */
  animate() {
    requestAnimationFrame(this.animate);

    // Smooth lerp interpolation for arm joint motion
    const lerpFactor = 0.15;
    for (let i = 0; i < 6; i++) {
      this.currentAngles[i] += (this.targetAngles[i] - this.currentAngles[i]) * lerpFactor;
    }

    // Smooth lerp interpolation for target block movement across workspace
    if (this.blockGroup) {
      const blockLerp = 0.18;
      this.currentBlock3D.x += (this.targetBlock3D.x - this.currentBlock3D.x) * blockLerp;
      this.currentBlock3D.y += (this.targetBlock3D.y - this.currentBlock3D.y) * blockLerp;
      this.currentBlock3D.z += (this.targetBlock3D.z - this.currentBlock3D.z) * blockLerp;
      this.currentBlock3D.theta += (this.targetBlock3D.theta - this.currentBlock3D.theta) * blockLerp;

      this.blockGroup.position.set(
        this.currentBlock3D.x,
        this.currentBlock3D.y,
        this.currentBlock3D.z
      );
      this.blockGroup.rotation.y = this.currentBlock3D.theta;

      // Adjust block mesh opacity based on detection validity
      if (this.blockMesh) {
        const targetOpacity = this.blockPose.valid ? 0.95 : 0.45;
        this.blockMesh.material.forEach(mat => {
          mat.opacity += (targetOpacity - mat.opacity) * 0.1;
        });
      }
    }

    const [a0, a1, a2, a3, a4, a5] = this.currentAngles;
    const deg2rad = Math.PI / 180;

    // 1. Joint 1: Base Yaw (Waist rotation around Y axis)
    // 90° is forward center. >90° turns left (+Y), <90° turns right (-Y).
    if (this.waistGroup) {
      this.waistGroup.rotation.y = (a0 - 90) * deg2rad;
    }

    // 2. Joint 2: Shoulder Pitch (Rotation around X axis)
    // 90° is upright vertical. <90° tilts forward (+X tilt), >90° tilts backwards (-X tilt).
    if (this.shoulderGroup) {
      this.shoulderGroup.rotation.x = (90 - a1) * deg2rad;
    }

    // 3. Joint 3: Elbow Pitch (Rotation around X axis)
    // 45° is inline with shoulder. 90° is 45° forward tilt. 135° is horizontal forward.
    if (this.elbowGroup) {
      this.elbowGroup.rotation.x = (a2 - 45) * deg2rad;
    }

    // 4. Joint 4: Wrist Roll (Rotation around Y/longitudinal axis, θ4 / Servo 3)
    // 90° is neutral roll orientation. Rolls Arm 03 and Gripper together.
    if (this.wristRollGroup) {
      this.wristRollGroup.rotation.y = (a3 - 90) * deg2rad;
    }

    // 5. Joint 5: Wrist Pitch (Rotation around X axis, θ5 / Servo 4)
    // 90° is inline with Arm 03. Tilts Gripper Base and Claws UP AND DOWN!
    if (this.wristPitchGroup) {
      this.wristPitchGroup.rotation.x = (a4 - 90) * deg2rad;
    }

    // 6. Joint 6: Dual Gripper Claw Articulation (2x Gripper 1.STL, θ6 / Servo 5)
    // a5 is Gripper angle: 140° is open, 10°-40° is closed.
    if (this.clawLeftGroup && this.clawRightGroup) {
      const openRatio = Math.max(0, Math.min(1, (a5 - 35) / 105));
      const spreadAngle = openRatio * this.clawConfig.maxSpread;
      this.clawLeftGroup.rotation.z = this.clawConfig.restAngle + spreadAngle;
      this.clawRightGroup.rotation.z = -this.clawConfig.restAngle - spreadAngle;
    }

    // Compute real-time lowest mesh elevation for live clearance meter
    if (this.wristPitchGroup && this.robotRoot && !this.isLoading) {
      const liveBox = new THREE.Box3();
      liveBox.setFromObject(this.wristPitchGroup);
      const curLowestY = liveBox.min.y;
      const curClearance = Math.max(0, curLowestY - this.tableFloorLimitY);
      if (Math.abs(curClearance - this.currentClearanceMm) > 0.5) {
        this.currentClearanceMm = curClearance;
        this.lowestMeshY = curLowestY;
        this.updateClearanceDisplay(curClearance, curLowestY <= this.tableFloorLimitY);
      }
    }

    // Update Camera Navigation (WASD + Elevate / Fly)
    this.updateCameraMovement();

    // Update OrbitControls
    if (this.controls) {
      this.controls.update();
    }

    // Render Scene
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
};

// Explicitly export to window scope so buttons and App.js can access it
window.DigitalTwinPanel = DigitalTwinPanel;

// Initialize when DOM and Three.js are ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    DigitalTwinPanel.init();
  }, 200);
});
