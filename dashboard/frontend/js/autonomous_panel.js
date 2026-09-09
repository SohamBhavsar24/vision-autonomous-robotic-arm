/* ==========================================================================
   AUTONOMOUS POLICY EXECUTION & MODEL REGISTRY PANEL (JS)
   ==========================================================================
   Project:  Vision-Based Autonomous Robotic Arm
   File:     autonomous_panel.js
   Location: dashboard/frontend/js/

   PURPOSE:
     Manages Phase D Autonomous Policy Execution. Displays registered
     model versions (v1 (30 Demos)), real-time camera perception status,
     triggers autonomous pick-and-place policy execution, displays live
     execution progress/phases, and provides an immediate emergency abort.
   ========================================================================== */

const AutonomousPanel = {
  models: [],
  activeModelId: 'v1',
  isRunning: false,
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
    this.executionCard = document.getElementById('autonomousExecutionCard');
    this.progressFill = document.getElementById('autoProgressFill');
    this.progressText = document.getElementById('autoProgressText');
    this.phaseText = document.getElementById('autoPhaseText');
    this.stepText = document.getElementById('autoStepText');
    this.anglesText = document.getElementById('autoAnglesText');
    this.btnAbort = document.getElementById('btnAbortAutonomous');
    this.btnTrainNew = document.getElementById('btnTrainNewModel');
  },

  bindEvents() {
    if (this.btnAbort) {
      this.btnAbort.addEventListener('click', () => this.abortExecution());
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

  async runModel(modelId) {
    if (this.isRunning) {
      alert('Autonomous execution is already in progress.');
      return;
    }

    if (!this.lastKnownBlockPose || !this.lastKnownBlockPose.valid) {
      const proceed = confirm(
        'Warning: Target Block (ArUco ID 0) or Origin (ArUco ID 2) is not currently detected by Camera 1.\n\n' +
        'Please ensure ArUco Tag 0 is placed in the workspace.\n\n' +
        'Do you want to attempt autonomous launch anyway?'
      );
      if (!proceed) return;
    }

    const runBtn = document.getElementById(`btnRunModel-${modelId}`);
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.textContent = 'Launching Policy...';
      runBtn.style.opacity = '0.7';
    }

    try {
      const res = await fetch('/api/autonomous/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: modelId })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(`Autonomous launch failed: ${data.detail || data.message || 'Unknown error'}`);
        if (runBtn) {
          runBtn.disabled = false;
          runBtn.textContent = 'Run Autonomous Pick & Place';
          runBtn.style.opacity = '1';
        }
      } else {
        if (window.App && App.log) {
          App.log(`AUTONOMOUS POLICY LAUNCHED: Model ${modelId} active. Closed-loop 30Hz rollout started.`);
        }
      }
    } catch (e) {
      alert(`Network error starting autonomous execution: ${e.message}`);
      if (runBtn) {
        runBtn.disabled = false;
        runBtn.textContent = 'Run Autonomous Pick & Place';
        runBtn.style.opacity = '1';
      }
    }
  },

  async abortExecution() {
    if (!confirm('Abort autonomous execution immediately?')) return;
    try {
      const res = await fetch('/api/autonomous/stop', { method: 'POST' });
      if (res.ok && window.App && App.log) {
        App.log('CRITICAL: Autonomous execution manually aborted by user.');
      }
    } catch (e) {
      console.warn('Abort error:', e);
    }
  },

  async deleteModel(modelId, modelName) {
    if (this.isRunning) {
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
    this.isRunning = status.is_running;

    // Toggle execution monitor card visibility
    if (this.executionCard) {
      this.executionCard.style.display = status.is_running ? 'block' : 'none';
    }

    if (status.is_running) {
      if (this.progressFill) {
        this.progressFill.style.width = `${status.progress_pct}%`;
      }
      if (this.progressText) {
        this.progressText.textContent = `${status.progress_pct}%`;
      }
      if (this.phaseText) {
        this.phaseText.textContent = status.phase;
      }
      if (this.stepText) {
        this.stepText.textContent = `Step ${status.current_step} / ${status.total_steps}`;
      }
      if (this.anglesText && Array.isArray(status.current_angles)) {
        const j = status.current_angles;
        const gStr = j[5] <= 110 ? 'CLOSED' : 'OPEN';
        this.anglesText.textContent = `Base: ${j[0]}° | Shoulder: ${j[1]}° | Elbow: ${j[2]}° | Wrist: ${j[3]}° | Roll: ${j[4]}° | Claw: ${gStr}`;
      }
    } else {
      // Re-enable run buttons
      this.models.forEach(m => {
        const btn = document.getElementById(`btnRunModel-${m.id}`);
        if (btn && btn.disabled) {
          btn.disabled = false;
          btn.textContent = 'Run Autonomous Pick & Place';
          btn.style.opacity = '1';
        }
      });
    }
  },

  renderModels() {
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
        <div class="card" style="margin-top: 16px; border-left: 4px solid var(--accent-primary); background: var(--bg-card);">
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
              </div>
              <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted); line-height: 1.5;">
                Dataset: ${m.transitions_count || 17824} transitions • Train Loss: ${m.loss || 0.51} • Speed: 30Hz Closed-Loop<br>
                Trained: ${m.created_at || 'Just now'} • Architecture: 3-Layer Deep BC Policy Net
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <button class="btn btn-primary" id="btnRunModel-${m.id}" onclick="AutonomousPanel.runModel('${m.id}')" style="padding: 10px 20px; font-size: 0.9rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 2px 8px rgba(224, 90, 71, 0.25);">
                Run Autonomous Pick & Place
              </button>
              <button class="btn btn-secondary" id="btnDeleteModel-${m.id}" onclick="AutonomousPanel.deleteModel('${m.id}', '${safeName}')" style="padding: 10px 14px; font-size: 0.85rem; font-weight: 600; cursor: pointer; color: #E53935; border-color: rgba(229, 57, 53, 0.4);">
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
