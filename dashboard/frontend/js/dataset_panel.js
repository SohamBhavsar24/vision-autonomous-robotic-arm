/* ==========================================================================
   DEMONSTRATION DATASET MANAGEMENT & TRAJECTORY REPLAY (JS)
   ==========================================================================
   Project:  Vision-Based Autonomous Robotic Arm
   File:     dataset_panel.js
   Location: dashboard/frontend/js/

   PURPOSE:
     Handles Phase C demonstration recording, trajectory sampling at 30Hz,
     live 6-joint angle telemetry streaming, auto-homing on stop, persistent
     local/backend episode storage, smooth trajectory replay with process status,
     and episode deletion.
   ========================================================================== */

const DatasetPanel = {
  isRecording: false,
  isPlaying: false,
  recordTimer: null,
  playTimer: null,
  currentTrajectory: [],
  episodes: [],
  sampleIntervalMs: 33, // 30Hz sampling rate

  init() {
    this.cacheDOM();
    this.bindEvents();
    this.loadEpisodes();
  },

  cacheDOM() {
    this.btnRecord = document.getElementById('btnRecordDataset');
    this.recordPill = document.getElementById('lblRecordStatusPill');
    this.frameCountSpan = document.getElementById('lblFrameCount');
    this.episodesList = document.getElementById('datasetEpisodesList');
    this.liveAnglesBox = document.getElementById('lblLiveAnglesBox');
    this.anglesValSpan = document.getElementById('lblAnglesVal');
  },

  bindEvents() {
    if (this.btnRecord) {
      this.btnRecord.addEventListener('click', () => this.toggleRecording());
    }
  },

  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  },

  formatAnglesText(angles) {
    if (!Array.isArray(angles) || angles.length < 6) return '';
    return `Base: ${angles[0]}° | Shoulder: ${angles[1]}° | Elbow: ${angles[2]}° | Wrist Pitch: ${angles[3]}° | Wrist Roll: ${angles[4]}° | Gripper: ${angles[5]}°`;
  },

  getCurrentJointAngles() {
    if (window.TeleopPanel && Array.isArray(window.TeleopPanel.smoothedAngles) && window.TeleopPanel.smoothedAngles.length === 6) {
      return [...window.TeleopPanel.smoothedAngles];
    }
    if (window.ServoPanel && typeof window.ServoPanel.getAnglesFromSliders === 'function') {
      return window.ServoPanel.getAnglesFromSliders();
    }
    if (window.ServoPanel && Array.isArray(window.ServoPanel.currentAngles)) {
      return [...window.ServoPanel.currentAngles];
    }
    return [90, 90, 90, 90, 90, 10];
  },

  startRecording() {
    if (this.isPlaying) {
      alert('Cannot start recording while a trajectory replay is active.');
      return;
    }

    this.isRecording = true;
    this.currentTrajectory = [];

    if (this.btnRecord) {
      this.btnRecord.textContent = 'Stop Recording Demonstration';
      this.btnRecord.style.backgroundColor = '#E53935';
      this.btnRecord.style.borderColor = '#E53935';
    }

    if (this.recordPill) {
      this.recordPill.style.display = 'inline-flex';
    }

    if (this.liveAnglesBox) {
      this.liveAnglesBox.style.display = 'block';
    }

    if (this.frameCountSpan) {
      this.frameCountSpan.textContent = '0';
    }

    if (window.App && App.log) {
      App.log('STARTED DEMONSTRATION RECORDING (30Hz Trajectory Sampler Active)...');
    }

    // 30Hz sampling loop
    const startTime = Date.now();
    this.recordTimer = setInterval(() => {
      const angles = this.getCurrentJointAngles();
      const elapsedMs = Date.now() - startTime;
      this.currentTrajectory.push({ t: elapsedMs, angles });

      if (this.frameCountSpan) {
        this.frameCountSpan.textContent = this.currentTrajectory.length;
      }

      if (this.anglesValSpan) {
        this.anglesValSpan.textContent = this.formatAnglesText(angles);
      }
    }, this.sampleIntervalMs);
  },

  stopRecording() {
    if (!this.isRecording) return;

    this.isRecording = false;
    if (this.recordTimer) clearInterval(this.recordTimer);

    if (this.btnRecord) {
      this.btnRecord.textContent = 'Start Recording Demonstration';
      this.btnRecord.style.backgroundColor = 'var(--accent-primary)';
      this.btnRecord.style.borderColor = 'var(--accent-primary)';
    }

    if (this.recordPill) {
      this.recordPill.style.display = 'none';
    }

    if (this.liveAnglesBox) {
      this.liveAnglesBox.style.display = 'none';
    }

    const frameCount = this.currentTrajectory.length;
    const durationSec = (frameCount * (this.sampleIntervalMs / 1000)).toFixed(1);

    if (window.App && App.log) {
      App.log(`STOPPED DEMONSTRATION RECORDING (${frameCount} frames captured, ~${durationSec}s). Auto-homing arm...`);
    }

    // Auto-home the arm smoothly per user spec
    if (window.App && App.sendWS) {
      App.sendWS('home');
      if (window.TeleopPanel) {
        window.TeleopPanel.integratedAngles = [90, 90, 90, 90, 90, 10];
        window.TeleopPanel.smoothedAngles = [90, 90, 90, 90, 90, 10];
      }
    }

    if (frameCount === 0) return;

    const d = new Date();
    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const episodeId = `ep-${Date.now()}`;
    const newEpisode = {
      id: episodeId,
      number: this.episodes.length + 1,
      date: dateStr,
      frameCount,
      durationSec,
      trajectory: this.currentTrajectory
    };

    // Unshift so the latest episode is at the TOP
    this.episodes.unshift(newEpisode);
    this.saveEpisodes();
    this.renderEpisodes();
  },

  async loadEpisodes() {
    const saved = localStorage.getItem('robotic_arm_dataset_episodes');
    if (saved) {
      try {
        this.episodes = JSON.parse(saved);
      } catch (e) {}
    }

    try {
      const res = await fetch('/api/dataset');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this.episodes = data;
          localStorage.setItem('robotic_arm_dataset_episodes', JSON.stringify(data));
        }
      }
    } catch (e) {}

    this.renderEpisodes();
  },

  async saveEpisodes() {
    try {
      localStorage.setItem('robotic_arm_dataset_episodes', JSON.stringify(this.episodes));
    } catch (e) {}

    try {
      await fetch('/api/dataset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodes: this.episodes })
      });
    } catch (e) {}
  },

  playEpisode(episodeId) {
    if (this.isRecording) {
      alert('Cannot play trajectory while recording is active.');
      return;
    }

    if (this.isPlaying) {
      alert('A trajectory replay is already in progress.');
      return;
    }

    const ep = this.episodes.find(e => e.id === episodeId);
    if (!ep || !ep.trajectory || ep.trajectory.length === 0) return;

    this.isPlaying = true;

    // Find Play button element for this specific episode
    const playBtn = document.getElementById(`btnPlay-${episodeId}`);
    const statusSpan = document.getElementById(`lblStatus-${episodeId}`);

    if (playBtn) {
      playBtn.disabled = true;
      playBtn.textContent = 'Replaying Trajectory...';
      playBtn.style.opacity = '0.7';
    }

    if (this.liveAnglesBox) {
      this.liveAnglesBox.style.display = 'block';
    }

    if (window.App && App.log) {
      App.log(`REPLAYING TRAJECTORY: Episode #${ep.number} (${ep.frameCount} frames, ~${ep.durationSec}s)...`);
    }

    let frameIndex = 0;
    this.playTimer = setInterval(() => {
      if (frameIndex >= ep.trajectory.length) {
        clearInterval(this.playTimer);
        this.isPlaying = false;

        if (playBtn) {
          playBtn.disabled = false;
          playBtn.textContent = 'Play Trajectory';
          playBtn.style.opacity = '1';
        }

        if (statusSpan) {
          statusSpan.textContent = 'Replay Complete';
          statusSpan.style.color = '#2E7D32';
        }

        if (this.liveAnglesBox) {
          this.liveAnglesBox.style.display = 'none';
        }

        if (window.App && App.log) App.log(`Episode #${ep.number} Replay Complete. Moving smoothly to Home Position...`);
        if (window.App && App.sendWS) App.sendWS('home');
        return;
      }

      const frame = ep.trajectory[frameIndex];
      if (window.ServoPanel && ServoPanel.setAngles) {
        ServoPanel.setAngles(frame.angles);
      }

      if (this.anglesValSpan) {
        this.anglesValSpan.textContent = this.formatAnglesText(frame.angles);
      }

      if (statusSpan) {
        statusSpan.textContent = `Replaying Frame ${frameIndex + 1} / ${ep.trajectory.length}...`;
        statusSpan.style.color = 'var(--accent-primary)';
      }

      frameIndex++;
    }, this.sampleIntervalMs);
  },

  async deleteEpisode(episodeId) {
    const ep = this.episodes.find(e => e.id === episodeId);
    const epName = ep ? `Episode #${ep.number}` : 'this episode';

    if (confirm(`Are you sure you want to delete ${epName}?`)) {
      this.episodes = this.episodes.filter(e => e.id !== episodeId);
      await this.saveEpisodes();
      this.renderEpisodes();
      if (window.App && App.log) App.log(`Deleted ${epName} from dataset.`);
    }
  },

  renderEpisodes() {
    if (!this.episodesList) return;

    if (this.episodes.length === 0) {
      this.episodesList.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-muted); font-family: var(--font-mono); font-size: 0.85rem; border: 2px dashed var(--border-subtle); border-radius: 12px; margin-top: 16px;">
          No demonstration episodes recorded yet.
        </div>
      `;
      return;
    }

    this.episodesList.innerHTML = this.episodes.map(ep => `
      <div class="card" style="margin-top: 16px; border-left: 4px solid var(--accent-primary);">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
          <div>
            <h4 style="font-family: var(--font-heading); font-size: 1.1rem; color: var(--text-main); margin-bottom: 4px;">
              Episode #${ep.number}
            </h4>
            <div style="font-family: var(--font-mono); font-size: 0.78rem; color: var(--text-muted);">
              ${ep.date} • ${ep.frameCount} frames (~${ep.durationSec}s)
              <span id="lblStatus-${ep.id}" style="margin-left: 8px; font-weight: 600;"></span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button class="btn btn-primary" id="btnPlay-${ep.id}" onclick="DatasetPanel.playEpisode('${ep.id}')" style="padding: 8px 16px; font-size: 0.82rem; font-weight: 600;">
              Play Trajectory
            </button>
            <button class="btn btn-secondary" onclick="DatasetPanel.deleteEpisode('${ep.id}')" style="padding: 8px 14px; font-size: 0.82rem; color: #E53935; border-color: rgba(229, 57, 53, 0.3);">
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }
};

window.DatasetPanel = DatasetPanel;

document.addEventListener('DOMContentLoaded', () => {
  DatasetPanel.init();
});
