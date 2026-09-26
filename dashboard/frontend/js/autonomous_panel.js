/* ==========================================================================
   AUTONOMOUS POLICY EXECUTION & MODEL REGISTRY PANEL (JS)
   ==========================================================================
   Project:  Vision-Based Autonomous Robotic Arm
   File:     autonomous_panel.js
   Location: dashboard/frontend/js/

   PURPOSE:
     Manages Phase D Continuous Autonomous Mode & Model Registry.
     Features a single Master Autonomous Run/Stop control bar, dynamic model
     selection dropdown, live 1.0s block stability verification meter,
     closed-loop 30Hz trajectory execution telemetry, and safe Standby Home
     positioning.
   ========================================================================== */

const AutonomousPanel = {
  models: [],
  activeModelId: 'v1',
  isRunning: false,
  isLoopActive: false,
  pollTimer: null,
  visionTimer: null,
  lastKnownBlockPose: null,

  init() {
    this.cacheDOM();
    this.bindEvents();
    this.fetchModels();
    this.startVisionPolling();
    this.startStatusPolling();
  },

  cacheDOM() {
    this.blockPoseStatus = document.getElementById('lblAutoBlockPoseStatus');
    this.modelsList = document.getElementById('autonomousModelsList');
    this.selModel = document.getElementById('selAutonomousModel');
    this.btnToggleLoop = document.getElementById('btnToggleAutonomousLoop');
    this.lblLoopState = document.getElementById('lblAutoLoopState');
    this.dotLoopState = document.getElementById('dotAutoLoopState');
    this.txtLoopState = document.getElementById('txtAutoLoopState');
    this.executionCard = document.getElementById('autonomousExecutionCard');
    this.autoStatusIndicator = document.getElementById('autoStatusIndicator');
    this.autoStatusTitle = document.getElementById('autoStatusTitle');
    this.progressFill = document.getElementById('autoProgressFill');
    this.progressText = document.getElementById('autoProgressText');
    this.phaseText = document.getElementById('autoPhaseText');
    this.stepText = document.getElementById('autoStepText');
    this.anglesText = document.getElementById('autoAnglesText');
    this.btnAbort = document.getElementById('btnAbortAutonomous');
    this.btnTrainNew = document.getElementById('btnTrainNewModel');
  },

  bindEvents() {
    if (this.btnToggleLoop) {
      this.btnToggleLoop.addEventListener('click', () => this.toggleAutonomousLoop());
    }

    if (this.selModel) {
      this.selModel.addEventListener('change', (e) => {
        this.activeModelId = e.target.value;
        this.renderModels();
      });
    }

    if (this.btnAbort) {
      this.btnAbort.addEventListener('click', () => this.stopAutonomousLoop());
    }

    if (this.btnTrainNew) {
      this.btnTrainNew.addEventListener('click', () => this.triggerRetrain());
    }
  },

  startVisionPolling() {
    const pollVision = async () => {
      try {
        const res = await fetch('/api/vision/status');
        if (res.ok) {
          const data = await res.json();
          if (data.latest_block_pose && data.latest_block_pose.valid) {
            this.lastKnownBlockPose = { ...data.latest_block_pose };
            if (this.blockPoseStatus) {
              this.blockPoseStatus.innerHTML = `Target Block: <strong>X=${data.latest_block_pose.x_cm}cm, Y=${data.latest_block_pose.y_cm}cm, θ=${data.latest_block_pose.theta_deg}°</strong>`;
              this.blockPoseStatus.style.background = 'rgba(0, 255, 102, 0.1)';
              this.blockPoseStatus.style.borderColor = 'rgba(0, 255, 102, 0.3)';
              this.blockPoseStatus.style.color = '#00B048';
            }
          } else {
            if (this.blockPoseStatus) {
              const ids = (data.detected_marker_ids && data.detected_marker_ids.length > 0)
                ? `(IDs: ${data.detected_marker_ids.join(',')})`
                : '(Searching for Tags 0 & 2)';
              this.blockPoseStatus.textContent = `Target Block: Searching... ${ids}`;
              this.blockPoseStatus.style.background = 'rgba(0, 165, 255, 0.08)';
              this.blockPoseStatus.style.borderColor = 'rgba(0, 165, 255, 0.25)';
              this.blockPoseStatus.style.color = '#0088DD';
            }
          }
        }
      } catch (e) {}
    };
    pollVision();
    this.visionTimer = setInterval(pollVision, 800);
  },

  startStatusPolling() {
    const pollStatus = async () => {
      try {
        const res = await fetch('/api/autonomous/status');
        if (res.ok) {
          const status = await res.json();
          this.updateExecutionUI(status);
        }
      } catch (e) {}
    };
    this.pollTimer = setInterval(pollStatus, 300);
  },

  async fetchModels() {
    try {
      const res = await fetch('/api/models');
      if (res.ok) {
        const data = await res.json();
        this.models = data.models || [];
        this.renderModels();
      }
    } catch (e) {
      console.warn('Failed to fetch models:', e);
    }
  },

  selectModel(modelId) {
    if (this.isLoopActive || this.isRunning) {
      alert('Cannot switch models while Autonomous Mode is running. Please stop autonomous mode first.');
      return;
    }
    this.activeModelId = modelId;
    if (this.selModel) {
      this.selModel.value = modelId;
    }
    this.renderModels();
  },

  async toggleAutonomousLoop() {
    if (this.isLoopActive || this.isRunning) {
      await this.stopAutonomousLoop();
    } else {
      await this.startAutonomousLoop(this.activeModelId);
    }
  },

  async startAutonomousLoop(modelId) {
    const selectedModel = modelId || this.activeModelId || 'v1';
    
    if (this.btnToggleLoop) {
      this.btnToggleLoop.disabled = true;
      this.btnToggleLoop.textContent = 'Starting Standby...';
    }

    try {
      const res = await fetch('/api/autonomous/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: selectedModel, continuous: true })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(`Autonomous loop launch failed: ${data.detail || data.message || 'Unknown error'}`);
      } else {
        if (window.App && App.log) {
          App.log(`AUTONOMOUS MODE ACTIVATED: Arm entering Standby at Home. Monitoring workspace using Model ${selectedModel}.`);
        }
      }
    } catch (e) {
      alert(`Network error starting autonomous mode: ${e.message}`);
    } finally {
      if (this.btnToggleLoop) {
        this.btnToggleLoop.disabled = false;
      }
    }
  },

  async stopAutonomousLoop() {
    if (this.btnToggleLoop) {
      this.btnToggleLoop.disabled = true;
      this.btnToggleLoop.textContent = 'Stopping...';
    }

    try {
      const res = await fetch('/api/autonomous/stop', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        if (window.App && App.log) {
          App.log('AUTONOMOUS MODE STOPPED: Arm returning to Home.');
        }
      } else {
        console.warn('Stop autonomous error:', data);
      }
    } catch (e) {
      console.warn('Network error stopping autonomous mode:', e);
    } finally {
      if (this.btnToggleLoop) {
        this.btnToggleLoop.disabled = false;
      }
    }
  },

  async deleteModel(modelId, modelName) {
    if (this.isRunning || this.isLoopActive) {
      alert('Cannot delete model while autonomous execution is actively running.');
      return;
    }
    const confirmed = confirm(`Delete trained model "${modelName}" (${modelId})?\n\nThis will permanently delete the model file from disk and remove it from the registry.`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/models/${modelId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        if (window.App && App.log) {
          App.log(`Model ${modelName} (${modelId}) deleted successfully.`);
        }
        await this.fetchModels();
      } else {
        alert(`Failed to delete model: ${data.detail || data.message || 'Unknown error'}`);
      }
    } catch (e) {
      alert(`Network error deleting model: ${e.message}`);
    }
  },

  async triggerRetrain() {
    const versionName = prompt('Enter version identifier for new model:', `v${this.models.length + 1} (${this.models.length * 30 || 30} Demos)`);
    if (!versionName) return;

    const versionId = `v${this.models.length + 1}`;
    if (window.App && App.log) App.log(`Action: Training new Behavior Cloning policy ${versionName}...`);

    try {
      const res = await fetch('/api/models/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version_id: versionId,
          model_name: versionName,
          epochs: 80
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Model ${versionName} trained successfully! Loss: ${data.model.loss}`);
        await this.fetchModels();
      } else {
        alert(`Training failed: ${data.detail || 'Error'}`);
      }
    } catch (e) {
      alert(`Error during training: ${e.message}`);
    }
  },

  updateExecutionUI(status) {
    this.isRunning = Boolean(status.is_running);
    this.isLoopActive = Boolean(status.is_loop_active);
    const loopState = status.loop_state || (this.isRunning ? 'executing' : 'idle');
    const isActive = this.isLoopActive || this.isRunning;

    // 1. Update Master Toggle Button
    if (this.btnToggleLoop) {
      if (isActive) {
        this.btnToggleLoop.textContent = 'Stop Autonomous Mode';
        this.btnToggleLoop.style.background = '#E53935';
        this.btnToggleLoop.style.borderColor = '#E53935';
        this.btnToggleLoop.style.boxShadow = '0 4px 14px rgba(229, 57, 53, 0.3)';
      } else {
        this.btnToggleLoop.textContent = 'Start Autonomous Mode';
        this.btnToggleLoop.style.background = '#00B048';
        this.btnToggleLoop.style.borderColor = '#00B048';
        this.btnToggleLoop.style.boxShadow = '0 4px 14px rgba(0, 176, 72, 0.25)';
      }
    }

    // 2. Disable/Enable Model Dropdown while loop is active
    if (this.selModel) {
      this.selModel.disabled = isActive;
      if (status.model_id && this.selModel.value !== status.model_id && isActive) {
        this.selModel.value = status.model_id;
        this.activeModelId = status.model_id;
      }
    }

    // 3. Update Master Loop Status Badge
    if (this.lblLoopState && this.dotLoopState && this.txtLoopState) {
      if (loopState === 'standby') {
        this.txtLoopState.textContent = 'STANDBY (ARM AT HOME)';
        this.dotLoopState.style.background = '#0099FF';
        this.lblLoopState.style.background = 'rgba(0, 153, 255, 0.1)';
        this.lblLoopState.style.borderColor = 'rgba(0, 153, 255, 0.3)';
        this.lblLoopState.style.color = '#0099FF';
      } else if (loopState === 'stabilizing') {
        const cd = (typeof status.stability_countdown === 'number') ? status.stability_countdown.toFixed(1) : '1.0';
        this.txtLoopState.textContent = `STABILIZING (${cd}s)`;
        this.dotLoopState.style.background = '#FFB800';
        this.lblLoopState.style.background = 'rgba(255, 184, 0, 0.15)';
        this.lblLoopState.style.borderColor = 'rgba(255, 184, 0, 0.4)';
        this.lblLoopState.style.color = '#D9822B';
      } else if (loopState === 'executing') {
        this.txtLoopState.textContent = 'EXECUTING PICK & PLACE';
        this.dotLoopState.style.background = '#00B048';
        this.lblLoopState.style.background = 'rgba(0, 176, 72, 0.12)';
        this.lblLoopState.style.borderColor = 'rgba(0, 176, 72, 0.3)';
        this.lblLoopState.style.color = '#00B048';
      } else {
        this.txtLoopState.textContent = 'IDLE';
        this.dotLoopState.style.background = '#888';
        this.lblLoopState.style.background = 'rgba(0, 0, 0, 0.05)';
        this.lblLoopState.style.borderColor = 'var(--border-subtle)';
        this.lblLoopState.style.color = 'var(--text-muted)';
      }
    }

    // 4. Update Live Execution Card
    if (this.executionCard) {
      this.executionCard.style.display = isActive ? 'block' : 'none';
    }

    if (isActive) {
      if (loopState === 'standby') {
        if (this.autoStatusIndicator) this.autoStatusIndicator.style.background = '#0099FF';
        if (this.autoStatusTitle) {
          this.autoStatusTitle.textContent = 'AUTONOMOUS STANDBY ACTIVE';
          this.autoStatusTitle.style.color = '#0099FF';
        }
        if (this.executionCard) this.executionCard.style.borderLeftColor = '#0099FF';
        if (this.phaseText) this.phaseText.textContent = status.phase || 'Waiting for block in workspace...';
        if (this.stepText) this.stepText.textContent = 'Arm Parked at Home [90, 90, 90, 90, 90, OPEN]';
        if (this.progressFill) {
          this.progressFill.style.width = '0%';
          this.progressFill.style.background = '#0099FF';
        }
        if (this.progressText) {
          this.progressText.textContent = 'Standby';
          this.progressText.style.color = '#0099FF';
        }
      } else if (loopState === 'stabilizing') {
        const pct = Math.round((status.stability_progress || 0.0) * 100);
        const cd = (typeof status.stability_countdown === 'number') ? status.stability_countdown.toFixed(1) : '1.0';
        if (this.autoStatusIndicator) this.autoStatusIndicator.style.background = '#FFB800';
        if (this.autoStatusTitle) {
          this.autoStatusTitle.textContent = 'VERIFYING BLOCK STABILITY';
          this.autoStatusTitle.style.color = '#D9822B';
        }
        if (this.executionCard) this.executionCard.style.borderLeftColor = '#FFB800';
        if (this.phaseText) this.phaseText.textContent = status.phase || `Stationary countdown: ${cd}s remaining`;
        if (this.stepText) this.stepText.textContent = `Hold block stationary: ${cd}s remaining`;
        if (this.progressFill) {
          this.progressFill.style.width = `${pct}%`;
          this.progressFill.style.background = '#FFB800';
        }
        if (this.progressText) {
          this.progressText.textContent = `${pct}%`;
          this.progressText.style.color = '#D9822B';
        }
      } else if (loopState === 'executing') {
        if (this.autoStatusIndicator) this.autoStatusIndicator.style.background = '#00B048';
        if (this.autoStatusTitle) {
          this.autoStatusTitle.textContent = 'AUTONOMOUS EXECUTION ACTIVE';
          this.autoStatusTitle.style.color = '#00B048';
        }
        if (this.executionCard) this.executionCard.style.borderLeftColor = '#00B048';
        if (this.phaseText) this.phaseText.textContent = status.phase || 'Executing rollout...';
        if (this.stepText) this.stepText.textContent = `Step ${status.current_step} / ${status.total_steps}`;
        if (this.progressFill) {
          this.progressFill.style.width = `${status.progress_pct}%`;
          this.progressFill.style.background = '#00B048';
        }
        if (this.progressText) {
          this.progressText.textContent = `${status.progress_pct}%`;
          this.progressText.style.color = '#00B048';
        }
      }

      if (this.anglesText && Array.isArray(status.current_angles)) {
        const j = status.current_angles;
        const gStr = j[5] <= 110 ? 'CLOSED' : 'OPEN';
        this.anglesText.textContent = `Base: ${j[0]}° | Shoulder: ${j[1]}° | Elbow: ${j[2]}° | Wrist: ${j[3]}° | Roll: ${j[4]}° | Claw: ${gStr}`;

        // Digital Twin Geofence Safety Guard for Autonomous Execution
        if (status.is_running && window.DigitalTwinPanel && typeof window.DigitalTwinPanel.evaluateAnglesSafety === 'function') {
          const safety = window.DigitalTwinPanel.evaluateAnglesSafety(j);
          if (!safety.isSafe) {
            this.stopAutonomousLoop();
            window.DigitalTwinPanel.triggerTableCollisionAlert(safety.lowestY);
            const safe = window.DigitalTwinPanel.lastSafeAngles || (window.DigitalTwinPanel.getHomeAngles ? window.DigitalTwinPanel.getHomeAngles() : [90, 90, 90, 90, 90, 140]);
            if (window.App && App.sendWS) {
              App.sendWS('set_angles', { angles: safe });
            }
            if (window.App && App.log) {
              App.log(`CRITICAL: Autonomous execution halted by Digital Twin Table Safety (${safety.lowestY.toFixed(1)}mm). Arm reverted to safe pose.`);
            }
            return;
          }
        }
      }
    }
  },

  renderModels() {
    // 1. Sync Dropdown Options
    if (this.selModel) {
      const currentVal = this.selModel.value || this.activeModelId;
      this.selModel.innerHTML = this.models.map(m => `
        <option value="${m.id}" ${m.id === currentVal ? 'selected' : ''}>
          ${m.name || m.id} (${m.episodes_count || 30} Demos)
        </option>
      `).join('');

      if (this.models.some(m => m.id === currentVal)) {
        this.selModel.value = currentVal;
        this.activeModelId = currentVal;
      } else if (this.models.length > 0) {
        this.activeModelId = this.models[0].id;
        this.selModel.value = this.models[0].id;
      }
    }

    // 2. Render Models Card List
    if (!this.modelsList) return;

    if (this.models.length === 0) {
      this.modelsList.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-muted); font-family: var(--font-mono); font-size: 0.85rem; border: 2px dashed var(--border-subtle); border-radius: 12px; margin-top: 16px;">
          No trained models registered yet. Click "Retrain Policy" to train model v1.
        </div>
      `;
      return;
    }

    this.modelsList.innerHTML = this.models.map(m => {
      const isCurrentActive = (m.id === this.activeModelId);
      const safeName = (m.name || m.id).replace(/'/g, "\\'");
      return `
        <div class="card" style="margin-top: 16px; border-left: 4px solid ${isCurrentActive ? '#00B048' : 'var(--accent-primary)'}; background: var(--bg-card);">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
            <div>
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                <h4 style="font-family: var(--font-heading); font-size: 1.15rem; color: var(--text-main); margin: 0;">
                  ${m.name || m.id}
                </h4>
                <span style="font-family: var(--font-mono); font-size: 0.72rem; color: #00B048; background: rgba(0, 255, 102, 0.1); border: 1px solid rgba(0, 255, 102, 0.25); padding: 2px 8px; border-radius: 4px; font-weight: 600;">
                  ${m.status || 'Ready'}
                </span>
                <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--accent-primary); background: rgba(224, 90, 71, 0.1); border: 1px solid rgba(224, 90, 71, 0.25); padding: 2px 8px; border-radius: 4px; font-weight: 600;">
                  ${m.episodes_count || 30} Demos
                </span>
                ${isCurrentActive ? `
                <span style="font-family: var(--font-mono); font-size: 0.72rem; color: #00B048; background: rgba(0, 176, 72, 0.12); border: 1px solid rgba(0, 176, 72, 0.3); padding: 2px 8px; border-radius: 4px; font-weight: 700;">
                  ACTIVE IN DROPDOWN
                </span>` : ''}
              </div>
              <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted); line-height: 1.5;">
                Dataset: ${m.transitions_count || 17824} transitions • Train Loss: ${m.loss || 0.51} • Speed: 30Hz Closed-Loop<br>
                Trained: ${m.created_at || 'Just now'} • Architecture: 3-Layer Deep BC Policy Net
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <button class="btn ${isCurrentActive ? 'btn-primary' : 'btn-secondary'}" onclick="AutonomousPanel.selectModel('${m.id}')" style="padding: 9px 18px; font-size: 0.86rem; font-weight: 600; cursor: pointer; ${isCurrentActive ? 'background: #00B048; border-color: #00B048;' : ''}">
                ${isCurrentActive ? 'Selected in Dropdown' : 'Select in Dropdown'}
              </button>
              <button class="btn btn-secondary" onclick="AutonomousPanel.deleteModel('${m.id}', '${safeName}')" style="padding: 9px 14px; font-size: 0.85rem; font-weight: 600; cursor: pointer; color: #E53935; border-color: rgba(229, 57, 53, 0.4);">
                Delete
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }
};

window.AutonomousPanel = AutonomousPanel;

document.addEventListener('DOMContentLoaded', () => {
  AutonomousPanel.init();
});
