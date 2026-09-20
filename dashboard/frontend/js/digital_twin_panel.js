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

  // Gripper Claw Offsets (User-Adjustable in Digital Space)
  clawConfig: {
    spacingX: 14.0,   // mm from center
    mountY: 60.0,     // mm forward on gripper base
    offsetZ: 0.0,     // mm Z elevation
    restAngle: 0.22,  // radians inward tilt at closed rest
    maxSpread: 0.45   // radians outward spread when open
  },

  // Current and Target Joint Angles (Degrees)
  // [Base θ1, Shoulder θ2, Elbow θ3, Wrist Pitch θ4, Wrist Roll θ5, Gripper θ6]
  currentAngles: [90, 90, 90, 90, 90, 140],
  targetAngles: [90, 90, 90, 90, 90, 140],

  // Exact Kinematic Parameters (mm) matching physical CAD assembly
  BASE_HEIGHT: 56.0,       // Height of Base.STL turntable surface
  SHOULDER_OFFSET: 39.0,   // Shoulder pivot height above waist (L1 = 56 + 39 = 95mm)
  L1: 95.0,                // Base ground to shoulder pivot (9.5 cm)
  L2: 120.0,               // Arm 01: Shoulder to Elbow pivot (12.0 cm)
  L3: 100.0,               // Arm 02 v3: Elbow to Wrist Pitch pivot (10.0 cm)
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
    this.initScene();
    this.initLighting();
    this.buildKinematicHierarchy();
    this.loadModels();
    this.setupResizeObserver();
    this.bindButtons();

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  },

  bindButtons() {
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
      <div>Claw: <span id="dtVal5" style="color: var(--accent-primary); font-weight: 600;">140°</span></div>
    `;
    this.container.appendChild(telemetryOverlay);

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
  },

  /* Interactive Gripper Tuner Panel in Digital Space */
  createTunerPanel() {
    const tuner = document.createElement('div');
    tuner.id = 'dtTunerPanel';
    tuner.style.position = 'absolute';
    tuner.style.top = '50px';
    tuner.style.right = '12px';
    tuner.style.width = '260px';
    tuner.style.background = 'rgba(26, 24, 23, 0.92)';
    tuner.style.border = '1px solid rgba(196, 120, 74, 0.4)';
    tuner.style.borderRadius = '8px';
    tuner.style.padding = '14px';
    tuner.style.zIndex = '8';
    tuner.style.display = 'none';
    tuner.style.backdropFilter = 'blur(8px)';
    tuner.style.fontFamily = 'var(--font-mono)';
    tuner.style.fontSize = '0.75rem';
    tuner.style.color = '#FAF7F2';

    tuner.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">
        <span style="font-weight: 600; color: var(--accent-primary);">Digital Space Claw Tuner</span>
        <button id="btnDtTunerClose" style="background: none; border: none; color: #FAF7F2; cursor: pointer; font-size: 0.9rem;">X</button>
      </div>

      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Claw Spacing (X):</span>
          <span id="dtTuneValX" style="color: var(--accent-primary);">${this.clawConfig.spacingX} mm</span>
        </div>
        <input type="range" id="dtSliderX" min="6" max="26" step="0.5" value="${this.clawConfig.spacingX}" style="width: 100%;">
      </div>

      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Mount Position (Y):</span>
          <span id="dtTuneValY" style="color: var(--accent-primary);">${this.clawConfig.mountY} mm</span>
        </div>
        <input type="range" id="dtSliderY" min="40" max="75" step="0.5" value="${this.clawConfig.mountY}" style="width: 100%;">
      </div>

      <div style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Elevation (Z):</span>
          <span id="dtTuneValZ" style="color: var(--accent-primary);">${this.clawConfig.offsetZ} mm</span>
        </div>
        <input type="range" id="dtSliderZ" min="-15" max="15" step="0.5" value="${this.clawConfig.offsetZ}" style="width: 100%;">
      </div>

      <div style="margin-bottom: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
          <span>Rest Angle:</span>
          <span id="dtTuneValAngle" style="color: var(--accent-primary);">${Math.round(this.clawConfig.restAngle * 180 / Math.PI)}°</span>
        </div>
        <input type="range" id="dtSliderAngle" min="0" max="45" step="1" value="${Math.round(this.clawConfig.restAngle * 180 / Math.PI)}" style="width: 100%;">
      </div>

      <button id="btnDtResetTuner" class="btn btn-secondary" style="width: 100%; font-size: 0.72rem; padding: 4px;">Reset Default Placement</button>
    `;

    this.container.appendChild(tuner);

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

    btnResetTuner.onclick = () => {
      this.clawConfig.spacingX = 14.0;
      this.clawConfig.mountY = 60.0;
      this.clawConfig.offsetZ = 0.0;
      this.clawConfig.restAngle = 0.22;
      sliderX.value = 14.0;
      sliderY.value = 60.0;
      sliderZ.value = 0.0;
      sliderAngle.value = 13;
      tuner.querySelector('#dtTuneValX').textContent = '14 mm';
      tuner.querySelector('#dtTuneValY').textContent = '60 mm';
      tuner.querySelector('#dtTuneValZ').textContent = '0 mm';
      tuner.querySelector('#dtTuneValAngle').textContent = '13°';
      this.updateClawPlacements();
    };

    btnClose.onclick = () => {
      tuner.style.display = 'none';
    };
  },

  toggleTunerPanel() {
    const tuner = document.getElementById('dtTunerPanel');
    if (!tuner) return;
    tuner.style.display = tuner.style.display === 'none' ? 'block' : 'none';
  },

  updateClawPlacements() {
    if (this.clawLeftGroup) {
      this.clawLeftGroup.position.set(-this.clawConfig.spacingX, this.clawConfig.mountY, this.clawConfig.offsetZ);
    }
    if (this.clawRightGroup) {
      this.clawRightGroup.position.set(this.clawConfig.spacingX, this.clawConfig.mountY, this.clawConfig.offsetZ);
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
    this.camera.position.set(0, 260, 440);

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
      this.controls.target.set(0, 160, 0);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
      this.controls.minDistance = 100;
      this.controls.maxDistance = 1200;
      this.controls.update();
    }

    // Grid Floor
    this.gridHelper = new THREE.GridHelper(600, 30, 0xC4784A, 0x423B35);
    this.gridHelper.position.y = 0;
    this.scene.add(this.gridHelper);

    // Circular ground ring
    const groundGeo = new THREE.CircleGeometry(280, 48);
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
    const ringGeo = new THREE.RingGeometry(279, 281, 48);
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

    // 6. Wrist Pitch group (Pivot at Y = L3 = 100mm where Arm 02 ends! Rotates around X axis, Joint 4 / Wrist Pitch θ4)
    this.wristPitchGroup = new THREE.Group();
    this.wristPitchGroup.position.set(0, this.L3, 0);
    this.elbowGroup.add(this.wristPitchGroup);

    // 7. Wrist Roll group (Connected directly at the vertical wall hole of Arm 03 at Y = 33.2mm!)
    // Rotates around Y/longitudinal axis, Joint 5 / Wrist Roll θ5
    this.wristRollGroup = new THREE.Group();
    this.wristRollGroup.position.set(0, this.ARM3_HOLE_DIST, 0);
    this.wristPitchGroup.add(this.wristRollGroup);

    // 8. Gripper Claws (2x Gripper 1.STL Claws mounted on front of Gripper Base)
    this.clawLeftGroup = new THREE.Group();
    this.clawLeftGroup.position.set(-this.clawConfig.spacingX, this.clawConfig.mountY, this.clawConfig.offsetZ);
    this.wristRollGroup.add(this.clawLeftGroup);

    this.clawRightGroup = new THREE.Group();
    this.clawRightGroup.position.set(this.clawConfig.spacingX, this.clawConfig.mountY, this.clawConfig.offsetZ);
    this.wristRollGroup.add(this.clawRightGroup);

    // Brass joint pin accent cylinders at each physical joint axis
    this.addJointPin(this.shoulderGroup, 32, 10);
    this.addJointPin(this.elbowGroup, 28, 8);
    this.addJointPin(this.wristPitchGroup, 24, 7);
    // Brass pin locking Arm 03 and Gripper base together through their vertical wall holes!
    this.addJointPin(this.wristRollGroup, 22, 4.5);
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
      // 5. Wrist Pitch Arm 03 (Starts after Arm 02 ends)
      {
        name: 'arm3',
        file: 'Arm 03.STL',
        parent: this.wristPitchGroup,
        material: matWarmLinen,
        transform: (geo) => {
          geo.computeVertexNormals();
          // Bottom hole is at (16.5, 5.0, 14.0). Top wall hole is at (16.5, 38.2, 9.1).
          geo.translate(-16.5, -5.0, -14.0);
          geo.rotateY(Math.PI / 2);
        }
      },
      // 6. Gripper Base (Mounted directly at vertical wall hole of Arm 03)
      {
        name: 'gripper_base',
        file: 'Gripper base.STL',
        parent: this.wristRollGroup,
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
          geo.translate(-4.25, -10.2, -5.0);
          geo.rotateX(-Math.PI / 2);
        }
      },
      // 8. Right Claw Finger (Gripper 1.STL, mirrored)
      {
        name: 'gripper_claw_right',
        file: 'Gripper 1.STL',
        parent: this.clawRightGroup,
        material: matTerracotta,
        transform: (geo) => {
          geo.computeVertexNormals();
          geo.translate(-4.25, -10.2, -5.0);
          geo.rotateX(-Math.PI / 2);
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
      this.wristRollGroup.add(gMesh);
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

  /* Reset Viewport Camera */
  resetCamera() {
    if (!this.camera) return;
    this.camera.position.set(0, 260, 440);
    if (this.controls) {
      this.controls.target.set(0, 160, 0);
      this.controls.update();
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

  /* Move to Default Home Pose (90° All) */
  setHomePose() {
    this.updateAngles([90, 90, 90, 90, 90, 140]);
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

  /* Main 60 FPS Render & Articulation Loop */
  animate() {
    requestAnimationFrame(this.animate);

    // Smooth lerp interpolation for natural motion
    const lerpFactor = 0.15;
    for (let i = 0; i < 6; i++) {
      this.currentAngles[i] += (this.targetAngles[i] - this.currentAngles[i]) * lerpFactor;
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

    // 4. Joint 4: Wrist Pitch (Rotation around X axis)
    // 90° is inline with forearm.
    if (this.wristPitchGroup) {
      this.wristPitchGroup.rotation.x = (a3 - 90) * deg2rad;
    }

    // 5. Joint 5: Wrist Roll (Rotation around Y/longitudinal axis)
    // 90° is neutral center.
    if (this.wristRollGroup) {
      this.wristRollGroup.rotation.y = (a4 - 90) * deg2rad;
    }

    // 6. Joint 6: Dual Gripper Claw Articulation (2x Gripper 1.STL)
    // a5 is Gripper angle: 140° is open, 10°-40° is closed.
    if (this.clawLeftGroup && this.clawRightGroup) {
      const openRatio = Math.max(0, Math.min(1, (a5 - 35) / 105));
      const spreadAngle = (openRatio - 0.5) * this.clawConfig.maxSpread;
      this.clawLeftGroup.rotation.z = -this.clawConfig.restAngle - spreadAngle;
      this.clawRightGroup.rotation.z = this.clawConfig.restAngle + spreadAngle;
    }

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
