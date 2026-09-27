/**
 * ==========================================================================
 * COMPUTER VISION PERCEPTION & SPATIAL WORKSPACE RADAR CONTROLLER
 * ==========================================================================
 * Project:  Vision-Based Autonomous Robotic Arm
 * File:     perception_panel.js
 * Location: dashboard/frontend/js/
 * 
 * PURPOSE:
 *   Manages the unified Perception panel:
 *   - Continuous 2D SVG Workspace Radar (25cm x 30cm manipulation platform)
 *   - Dynamic Target Block (ArUco Tag 0) puck with orientation heading vector
 *   - World Origin (ArUco Tag 2) spatial calibration anchor at (0, 0)
 *   - Real-world coordinate telemetry cards (X Lateral, Y Reach, Heading Theta)
 *   - Workspace reachability safety guard (Inside Bounds vs Out of Reach)
 *   - Multi-target detection diagnostics
 * ==========================================================================
 */

(function () {
  'use strict';

  class PerceptionPanelController {
    constructor() {
      // Physical workspace boundaries (continuous 25cm x 30cm platform)
      this.WORKSPACE_WIDTH_CM = 30.0;  // Horizontal lateral width (+X)
      this.WORKSPACE_DEPTH_CM = 25.0;  // Forward reach depth (+Y)

      // SVG Canvas coordinate mapping
      this.SVG_ORIGIN_X = 35;          // Margin left (px)
      this.SVG_ORIGIN_Y = 275;         // Margin bottom / origin Y (px)
      this.SCALE_PX_PER_CM = 10.0;     // 1 cm = 10 px
      this.GRID_WIDTH_PX = this.WORKSPACE_WIDTH_CM * this.SCALE_PX_PER_CM;  // 300 px
      this.GRID_HEIGHT_PX = this.WORKSPACE_DEPTH_CM * this.SCALE_PX_PER_CM; // 250 px

      // State
      this.currentPose = { x_cm: 0.0, y_cm: 0.0, theta_deg: 0.0, valid: false };

      // DOM elements cache
      this.dom = {};
    }

    init() {
      this.cacheDom();
      this.buildWorkspaceGridSvg();
      this.updateBlockPose({ x_cm: 0.0, y_cm: 0.0, theta_deg: 0.0, valid: false });
    }

    cacheDom() {
      this.dom.radarSvg = document.getElementById('workspaceRadarSvg');
      this.dom.valX = document.getElementById('percepValX');
      this.dom.valY = document.getElementById('percepValY');
      this.dom.valTheta = document.getElementById('percepValTheta');
      this.dom.boundsPill = document.getElementById('perceptionBoundsPill');
      this.dom.boundsText = document.getElementById('perceptionBoundsText');
      this.dom.tag0Badge = document.getElementById('percepTag0Badge');
      this.dom.tag0Coord = document.getElementById('percepTag0Coord');
      this.dom.tag2Coord = document.getElementById('percepTag2Coord');
    }

    /**
     * Builds the continuous 25cm x 30cm workspace canvas, axes, and origin anchor in SVG.
     */
    buildWorkspaceGridSvg() {
      if (!this.dom.radarSvg) return;

      const svg = this.dom.radarSvg;
      svg.innerHTML = ''; // Clear existing

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = `
        <marker id="arrowX" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#B53A2E" />
        </marker>
        <marker id="arrowY" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#2E7D32" />
        </marker>
        <marker id="arrowHeading" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#C4784A" />
        </marker>
      `;
      svg.appendChild(defs);

      // Background rect for the continuous 30cm x 25cm table workspace (6:5 aspect ratio)
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('x', this.SVG_ORIGIN_X);
      bgRect.setAttribute('y', this.SVG_ORIGIN_Y - this.GRID_HEIGHT_PX);
      bgRect.setAttribute('width', this.GRID_WIDTH_PX);
      bgRect.setAttribute('height', this.GRID_HEIGHT_PX);
      bgRect.setAttribute('fill', '#FFFFFF');
      bgRect.setAttribute('stroke', '#C4784A');
      bgRect.setAttribute('stroke-width', '2');
      bgRect.setAttribute('rx', '4');
      svg.appendChild(bgRect);

      // Coordinate axes
      const axesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      axesGroup.setAttribute('id', 'radarAxes');

      // Platform dimension indicator in top right of workspace
      const dimBadge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      dimBadge.setAttribute('x', this.SVG_ORIGIN_X + this.GRID_WIDTH_PX - 8);
      dimBadge.setAttribute('y', this.SVG_ORIGIN_Y - this.GRID_HEIGHT_PX + 16);
      dimBadge.setAttribute('text-anchor', 'end');
      dimBadge.setAttribute('fill', '#A89E90');
      dimBadge.setAttribute('font-family', 'IBM Plex Mono, monospace');
      dimBadge.setAttribute('font-size', '9px');
      dimBadge.setAttribute('font-weight', '600');
      dimBadge.textContent = '30 cm × 25 cm (6:5)';
      axesGroup.appendChild(dimBadge);

      // +X Axis (Horizontal Red)
      const lineX = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      lineX.setAttribute('x1', this.SVG_ORIGIN_X);
      lineX.setAttribute('y1', this.SVG_ORIGIN_Y);
      lineX.setAttribute('x2', this.SVG_ORIGIN_X + this.GRID_WIDTH_PX + 18);
      lineX.setAttribute('y2', this.SVG_ORIGIN_Y);
      lineX.setAttribute('stroke', '#B53A2E');
      lineX.setAttribute('stroke-width', '2');
      lineX.setAttribute('marker-end', 'url(#arrowX)');
      axesGroup.appendChild(lineX);

      const labelX = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelX.setAttribute('x', this.SVG_ORIGIN_X + this.GRID_WIDTH_PX + 4);
      labelX.setAttribute('y', this.SVG_ORIGIN_Y + 18);
      labelX.setAttribute('fill', '#B53A2E');
      labelX.setAttribute('font-family', 'IBM Plex Mono, monospace');
      labelX.setAttribute('font-weight', '600');
      labelX.setAttribute('font-size', '10px');
      labelX.textContent = '+X (30cm)';
      axesGroup.appendChild(labelX);

      // +Y Axis (Vertical Green)
      const lineY = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      lineY.setAttribute('x1', this.SVG_ORIGIN_X);
      lineY.setAttribute('y1', this.SVG_ORIGIN_Y);
      lineY.setAttribute('x2', this.SVG_ORIGIN_X);
      lineY.setAttribute('y2', this.SVG_ORIGIN_Y - this.GRID_HEIGHT_PX - 18);
      lineY.setAttribute('stroke', '#2E7D32');
      lineY.setAttribute('stroke-width', '2');
      lineY.setAttribute('marker-end', 'url(#arrowY)');
      axesGroup.appendChild(lineY);

      const labelY = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelY.setAttribute('x', this.SVG_ORIGIN_X - 6);
      labelY.setAttribute('y', this.SVG_ORIGIN_Y - this.GRID_HEIGHT_PX - 8);
      labelY.setAttribute('text-anchor', 'end');
      labelY.setAttribute('fill', '#2E7D32');
      labelY.setAttribute('font-family', 'IBM Plex Mono, monospace');
      labelY.setAttribute('font-weight', '600');
      labelY.setAttribute('font-size', '10px');
      labelY.textContent = '+Y (25cm)';
      axesGroup.appendChild(labelY);

      // Scale Ticks and numbers along X axis (every 5cm)
      for (let cm = 5; cm <= 30; cm += 5) {
        const tx = this.SVG_ORIGIN_X + cm * this.SCALE_PX_PER_CM;
        const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tick.setAttribute('x1', tx);
        tick.setAttribute('y1', this.SVG_ORIGIN_Y);
        tick.setAttribute('x2', tx);
        tick.setAttribute('y2', this.SVG_ORIGIN_Y + 4);
        tick.setAttribute('stroke', '#8C8275');
        tick.setAttribute('stroke-width', '1');
        axesGroup.appendChild(tick);

        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', tx - 4);
        txt.setAttribute('y', this.SVG_ORIGIN_Y + 15);
        txt.setAttribute('fill', '#8C8275');
        txt.setAttribute('font-family', 'IBM Plex Mono, monospace');
        txt.setAttribute('font-size', '9px');
        txt.textContent = cm;
        axesGroup.appendChild(txt);
      }

      // Scale Ticks and numbers along Y axis (every 5cm)
      for (let cm = 5; cm <= 25; cm += 5) {
        const ty = this.SVG_ORIGIN_Y - cm * this.SCALE_PX_PER_CM;
        const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tick.setAttribute('x1', this.SVG_ORIGIN_X - 4);
        tick.setAttribute('y1', ty);
        tick.setAttribute('x2', this.SVG_ORIGIN_X);
        tick.setAttribute('y2', ty);
        tick.setAttribute('stroke', '#8C8275');
        tick.setAttribute('stroke-width', '1');
        axesGroup.appendChild(tick);

        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', this.SVG_ORIGIN_X - 18);
        txt.setAttribute('y', ty + 3);
        txt.setAttribute('fill', '#8C8275');
        txt.setAttribute('font-family', 'IBM Plex Mono, monospace');
        txt.setAttribute('font-size', '9px');
        txt.textContent = cm;
        axesGroup.appendChild(txt);
      }

      // World Origin Anchor Marker (ArUco Tag 2) at (0, 0)
      const originAnchor = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      originAnchor.setAttribute('id', 'radarOriginAnchor');

      const originBox = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      originBox.setAttribute('x', this.SVG_ORIGIN_X - 7);
      originBox.setAttribute('y', this.SVG_ORIGIN_Y - 7);
      originBox.setAttribute('width', '14');
      originBox.setAttribute('height', '14');
      originBox.setAttribute('fill', '#D4A843');
      originBox.setAttribute('stroke', '#3D3529');
      originBox.setAttribute('stroke-width', '1.5');
      originBox.setAttribute('rx', '2');
      originAnchor.appendChild(originBox);

      const originDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      originDot.setAttribute('cx', this.SVG_ORIGIN_X);
      originDot.setAttribute('cy', this.SVG_ORIGIN_Y);
      originDot.setAttribute('r', '2.5');
      originDot.setAttribute('fill', '#FAF7F2');
      originAnchor.appendChild(originDot);

      const originText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      originText.setAttribute('x', this.SVG_ORIGIN_X - 28);
      originText.setAttribute('y', this.SVG_ORIGIN_Y + 26);
      originText.setAttribute('fill', '#8C8275');
      originText.setAttribute('font-family', 'IBM Plex Mono, monospace');
      originText.setAttribute('font-weight', '600');
      originText.setAttribute('font-size', '8.5px');
      originText.textContent = 'Tag 2 (0,0)';
      originAnchor.appendChild(originText);

      axesGroup.appendChild(originAnchor);
      svg.appendChild(axesGroup);

      // Dynamic Target Block Puck Group (ArUco Tag 0)
      const blockGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      blockGroup.setAttribute('id', 'radarBlockPuck');
      blockGroup.setAttribute('display', 'none');

      // Outer pulsing halo
      const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      halo.setAttribute('cx', '0');
      halo.setAttribute('cy', '0');
      halo.setAttribute('r', '18');
      halo.setAttribute('fill', 'rgba(196, 120, 74, 0.18)');
      halo.setAttribute('stroke', 'rgba(196, 120, 74, 0.4)');
      halo.setAttribute('stroke-width', '1');
      blockGroup.appendChild(halo);

      // Block representation square (simulating 4cm tag)
      const blockRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      blockRect.setAttribute('id', 'radarBlockRect');
      blockRect.setAttribute('x', '-12');
      blockRect.setAttribute('y', '-12');
      blockRect.setAttribute('width', '24');
      blockRect.setAttribute('height', '24');
      blockRect.setAttribute('fill', '#C4784A');
      blockRect.setAttribute('stroke', '#3D3529');
      blockRect.setAttribute('stroke-width', '1.5');
      blockRect.setAttribute('rx', '3');
      blockGroup.appendChild(blockRect);

      // Center crosshair dot
      const centerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      centerDot.setAttribute('cx', '0');
      centerDot.setAttribute('cy', '0');
      centerDot.setAttribute('r', '2.5');
      centerDot.setAttribute('fill', '#FAF7F2');
      blockGroup.appendChild(centerDot);

      // Heading vector line pointing in orientation direction theta
      const headingLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      headingLine.setAttribute('id', 'radarHeadingLine');
      headingLine.setAttribute('x1', '0');
      headingLine.setAttribute('y1', '0');
      headingLine.setAttribute('x2', '0');
      headingLine.setAttribute('y2', '-22');
      headingLine.setAttribute('stroke', '#FAF7F2');
      headingLine.setAttribute('stroke-width', '2');
      headingLine.setAttribute('marker-end', 'url(#arrowHeading)');
      blockGroup.appendChild(headingLine);

      // Label text
      const blockText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      blockText.setAttribute('id', 'radarBlockText');
      blockText.setAttribute('x', '16');
      blockText.setAttribute('y', '4');
      blockText.setAttribute('fill', '#3D3529');
      blockText.setAttribute('font-family', 'IBM Plex Mono, monospace');
      blockText.setAttribute('font-weight', '600');
      blockText.setAttribute('font-size', '9.5px');
      blockText.textContent = 'Block 1 (ID 0)';
      blockGroup.appendChild(blockText);

      svg.appendChild(blockGroup);

      // Empty state standby watermark text
      const standbyMsg = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      standbyMsg.setAttribute('id', 'radarStandbyMsg');
      standbyMsg.setAttribute('x', this.SVG_ORIGIN_X + this.GRID_WIDTH_PX / 2);
      standbyMsg.setAttribute('y', this.SVG_ORIGIN_Y - this.GRID_HEIGHT_PX / 2);
      standbyMsg.setAttribute('text-anchor', 'middle');
      standbyMsg.setAttribute('fill', '#A89F94');
      standbyMsg.setAttribute('font-family', 'Source Sans 3, sans-serif');
      standbyMsg.setAttribute('font-size', '12px');
      standbyMsg.textContent = 'Waiting for ArUco Marker ID 0 in workspace...';
      svg.appendChild(standbyMsg);
    }

    /**
     * Receives latest_block_pose from backend WebSocket stream.
     * Updates radar puck, heading vector, telemetry cards, and safety reachability.
     */
    updateBlockPose(pose) {
      if (!pose) return;

      const isValid = Boolean(pose.valid);
      this.currentPose = {
        x_cm: parseFloat(pose.x_cm) || 0.0,
        y_cm: parseFloat(pose.y_cm) || 0.0,
        theta_deg: parseFloat(pose.theta_deg) || 0.0,
        valid: isValid
      };

      const x = this.currentPose.x_cm;
      const y = this.currentPose.y_cm;
      const theta = this.currentPose.theta_deg;

      // Check workspace reachability boundaries (0-30cm x 0-25cm with 2cm tolerance margin)
      const isReachable = (x >= -2.0 && x <= 32.0 && y >= -2.0 && y <= 27.0);

      // Update Telemetry metric cards
      if (this.dom.valX) this.dom.valX.textContent = isValid ? `${x >= 0 ? '+' : ''}${x.toFixed(1)}` : '0.0';
      if (this.dom.valY) this.dom.valY.textContent = isValid ? `${y >= 0 ? '+' : ''}${y.toFixed(1)}` : '0.0';
      if (this.dom.valTheta) this.dom.valTheta.textContent = isValid ? `${theta.toFixed(1)}` : '0.0';

      // Update Reachability Status Badge
      if (this.dom.boundsPill && this.dom.boundsText) {
        if (!isValid) {
          this.dom.boundsPill.className = 'status-pill';
          this.dom.boundsPill.style.background = 'rgba(140, 130, 117, 0.12)';
          this.dom.boundsPill.style.color = 'var(--text-muted)';
          this.dom.boundsText.textContent = 'Workspace: SCANNING / IDLE';
        } else if (isReachable) {
          this.dom.boundsPill.className = 'status-pill connected';
          this.dom.boundsPill.style.background = 'rgba(46, 125, 50, 0.12)';
          this.dom.boundsPill.style.color = '#2E7D32';
          this.dom.boundsText.textContent = 'Workspace: INSIDE SAFE REACH';
        } else {
          this.dom.boundsPill.className = 'status-pill';
          this.dom.boundsPill.style.background = 'rgba(181, 58, 46, 0.15)';
          this.dom.boundsPill.style.color = '#B53A2E';
          this.dom.boundsText.textContent = 'Workspace: OUT OF BOUNDS';
        }
      }

      // Update Multi-Target Status Cards
      if (this.dom.tag0Badge) {
        this.dom.tag0Badge.textContent = isValid ? 'TRACKED' : 'LOST';
        this.dom.tag0Badge.style.color = isValid ? '#2E7D32' : '#8C8275';
        this.dom.tag0Badge.style.background = isValid ? 'rgba(46, 125, 50, 0.12)' : 'rgba(140, 130, 117, 0.12)';
      }
      if (this.dom.tag0Coord) {
        this.dom.tag0Coord.textContent = isValid
          ? `(X: ${x >= 0 ? '+' : ''}${x.toFixed(1)} cm, Y: ${y.toFixed(1)} cm, θ: ${theta.toFixed(1)}°)`
          : 'Searching in 30 FPS overhead stream...';
      }
      if (this.dom.tag2Coord) {
        this.dom.tag2Coord.textContent = `(0.0 cm, 0.0 cm) • Fixed Calibration Baseline (4.0 cm tag)`;
      }

      // Update SVG Visualizer
      this.updateRadarSvg(isValid, x, y, theta);
    }

    /**
     * Updates the SVG elements of the 2D workspace radar.
     */
    updateRadarSvg(isValid, x, y, theta) {
      const blockPuck = document.getElementById('radarBlockPuck');
      const standbyMsg = document.getElementById('radarStandbyMsg');
      const blockRect = document.getElementById('radarBlockRect');
      const headingLine = document.getElementById('radarHeadingLine');

      if (!isValid) {
        if (blockPuck) blockPuck.setAttribute('display', 'none');
        if (standbyMsg) standbyMsg.setAttribute('display', 'block');
        return;
      }

      if (standbyMsg) standbyMsg.setAttribute('display', 'none');

      // Clamp SVG display coordinates so puck does not fly completely out of view
      const clampedX = Math.min(32.0, Math.max(-2.0, x));
      const clampedY = Math.min(27.0, Math.max(-2.0, y));

      const svgX = this.SVG_ORIGIN_X + clampedX * this.SCALE_PX_PER_CM;
      const svgY = this.SVG_ORIGIN_Y - clampedY * this.SCALE_PX_PER_CM;

      // Update puck group position
      if (blockPuck) {
        blockPuck.setAttribute('display', 'block');
        blockPuck.setAttribute('transform', `translate(${svgX}, ${svgY})`);
      }

      // Rotate block rect and heading line to match orientation theta
      if (blockRect) {
        blockRect.setAttribute('transform', `rotate(${-theta})`);
      }
      if (headingLine) {
        // Invert theta for SVG Y downward coordinates
        const rad = (-theta * Math.PI) / 180.0;
        const headLen = 22;
        const hx = headLen * Math.cos(rad - Math.PI / 2);
        const hy = headLen * Math.sin(rad - Math.PI / 2);
        headingLine.setAttribute('x2', hx.toFixed(1));
        headingLine.setAttribute('y2', hy.toFixed(1));
      }
    }
  }

  // Initialize and attach to window
  window.PerceptionPanel = new PerceptionPanelController();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.PerceptionPanel.init();
    });
  } else {
    window.PerceptionPanel.init();
  }
})();
