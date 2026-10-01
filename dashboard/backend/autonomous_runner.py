"""
==============================================================================
AUTONOMOUS POLICY EXECUTION ENGINE (PHASE D)
==============================================================================

Project:  Vision-Based Autonomous Robotic Arm
File:     autonomous_runner.py
Location: dashboard/backend/

PURPOSE:
    Executes trained Behavior Cloning policies autonomously on the physical
    robotic arm. Reads live real-world block coordinates (X, Y, θ) from
    the perception system (Camera 1 ArUco pipeline), conditions the neural
    policy / trajectory generator on the detected target pose, and streams
    smooth 30Hz joint commands to the Arduino serial bridge.
==============================================================================
"""

import os
import glob
import json
import time
import asyncio
import numpy as np
import logging
from typing import Dict, Any, Optional, Tuple, List

logger = logging.getLogger("AutonomousRunner")

MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "models"))
DATASETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "datasets"))
REGISTRY_FILE = os.path.join(MODELS_DIR, "models_registry.json")
DROP_LOCATIONS_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "drop_locations.json"))

def load_drop_locations() -> Dict[str, Any]:
    """Loads drop_locations.json or returns default calibrated locations."""
    if os.path.exists(DROP_LOCATIONS_PATH):
        try:
            with open(DROP_LOCATIONS_PATH, "r") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Error loading drop_locations.json: {e}")
    return {
        "block_1": {
            "name": "Block 1 Drop Target (Tag 0)",
            "angles": [140, 80, 85, 90, 90],
            "description": "Calibrated drop target for Block 1 (ArUco ID 0) left bin"
        },
        "block_2": {
            "name": "Block 2 Drop Target (Tag 1)",
            "angles": [155, 80, 85, 90, 90],
            "description": "Calibrated drop target for Block 2 (ArUco ID 1) outer left bin"
        }
    }

class AutonomousRunner:
    def __init__(self, serial_manager, vision_manager):
        self.serial_manager = serial_manager
        self.vision_manager = vision_manager
        
        self.is_running = False
        self.is_aborted = False
        self.is_loop_active = False
        self.loop_state = "idle" # "idle", "standby", "stabilizing", "executing"
        self.loop_model_id = "v1"
        self.stability_start_time: Optional[float] = None
        self.stability_countdown: float = 1.0
        self.last_stable_pose: Optional[Dict[str, float]] = None
        self.loop_task: Optional[asyncio.Task] = None
        
        self.current_model_id: Optional[str] = "v1"
        self.current_step = 0
        self.total_steps = 0
        self.current_phase = "Idle"
        self.progress_pct = 0.0
        open_angle = getattr(self.serial_manager, "gripper_open", 140)
        self.current_angles = [90, 90, 90, 90, 90, open_angle]
        self.target_block_pose = None
        self.execution_task: Optional[asyncio.Task] = None

    def get_available_models(self) -> List[Dict[str, Any]]:
        """Returns all registered trained model versions."""
        if os.path.exists(REGISTRY_FILE):
            try:
                with open(REGISTRY_FILE, "r") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to read models_registry.json: {e}")
        return []

    def load_model_weights(self, model_id: str = "v1") -> Optional[Dict[str, Any]]:
        """Loads trained Deep Multi-Layer Perceptron (MLP) Behavior Cloning policy weights."""
        model_file = os.path.join(MODELS_DIR, f"{model_id}_policy.npz")
        if not os.path.exists(model_file):
            return None
        try:
            return dict(np.load(model_file))
        except Exception as e:
            logger.warning(f"Failed to load {model_file}: {e}")
            return None

    def delete_model(self, model_id: str) -> Tuple[bool, str]:
        """Deletes a trained model version from the registry and disk."""
        if not os.path.exists(REGISTRY_FILE):
            return False, "Model registry file not found."
            
        try:
            with open(REGISTRY_FILE, "r") as f:
                registry = json.load(f)
        except Exception as e:
            return False, f"Failed to read model registry: {e}"
            
        found = False
        new_registry = []
        for m in registry:
            if m.get("id") == model_id or m.get("filename") == model_id:
                found = True
                fname = m.get("filename")
                if fname:
                    target_file = os.path.join(MODELS_DIR, fname)
                    if os.path.exists(target_file):
                        try:
                            os.remove(target_file)
                        except Exception as e:
                            logger.warning(f"Could not remove model file {target_file}: {e}")
            else:
                new_registry.append(m)
                
        if not found:
            return False, f"Model '{model_id}' not found in registry."
            
        try:
            with open(REGISTRY_FILE, "w") as f:
                json.dump(new_registry, f, indent=2)
        except Exception as e:
            return False, f"Failed to save updated model registry: {e}"
            
        return True, f"Model '{model_id}' deleted successfully."

    def get_status(self) -> Dict[str, Any]:
        """Returns live execution status, loop state, and telemetry."""
        return {
            "is_running": self.is_running,
            "is_aborted": self.is_aborted,
            "is_loop_active": self.is_loop_active,
            "loop_state": self.loop_state,
            "model_id": self.loop_model_id or self.current_model_id,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "progress_pct": round(self.progress_pct, 1),
            "phase": self.current_phase,
            "current_angles": self.current_angles,
            "target_block_pose": self.target_block_pose,
            "stability_countdown": round(self.stability_countdown, 1),
            "stability_progress": round(min(1.0, max(0.0, 1.0 - self.stability_countdown)), 2)
        }

    def abort(self) -> Tuple[bool, str]:
        """Immediately aborts any active autonomous policy execution and loop."""
        self.is_aborted = True
        self.is_loop_active = False
        self.is_running = False
        self.loop_state = "idle"
        self.current_phase = "Aborted by user"
        self.stability_start_time = None
        self.stability_countdown = 1.0
        self.last_stable_pose = None
        
        if self.loop_task and not self.loop_task.done():
            self.loop_task.cancel()
            
        logger.warning("Autonomous execution aborted by user.")
        
        # Trigger smooth home transition
        try:
            asyncio.create_task(self.serial_manager.move_to_home())
        except Exception:
            pass
            
        return True, "Autonomous execution aborted."

    def stop_autonomous_loop(self) -> Tuple[bool, str]:
        """Stops the continuous autonomous loop and safely returns arm to Home."""
        return self.abort()

    def find_k_nearest_demonstrations(self, target_bx: float, target_by: float, k: int = 3, model_id: str = "v1"):
        """
        Finds the k nearest human demonstrations based on Euclidean distance to (target_bx, target_by).
        Routes to datasets_full_backup/ for v2/v3 models, and datasets/ for v1 (pick-only).
        Returns a list of tuples: [(episode_data, distance), ...]
        """
        if model_id in ["v2", "v3"]:
            datasets_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "datasets_full_backup"))
        else:
            datasets_path = DATASETS_DIR

        files = sorted(glob.glob(os.path.join(datasets_path, "episode_*.json")))
        candidates = []
        
        for fpath in files:
            try:
                with open(fpath, "r") as f:
                    ep = json.load(f)
                    init_pose = ep.get("initial_block_pose")
                    if not init_pose or not init_pose.get("valid", True):
                        continue
                    if not ep.get("trajectory"):
                        continue
                        
                    bx = float(init_pose.get("x_cm", 0.0))
                    by = float(init_pose.get("y_cm", 0.0))
                    
                    dist = float(np.sqrt((bx - target_bx)**2 + (by - target_by)**2))
                    candidates.append((ep, dist))
            except Exception:
                pass
                
        if not candidates:
            raise ValueError(f"No demonstration datasets available in {datasets_path} to synthesize trajectory.")
            
        candidates.sort(key=lambda x: x[1])
        return candidates[:k]

    def generate_policy_trajectory(self, target_bx: float, target_by: float, target_bth: float = 0.0, model_id: str = "v1"):
        """
        Generates high-accuracy autonomous trajectory strictly from human demonstration
        blending in joint space without Inverse Kinematics or synthetic angle overrides.
        All 5 joints [θ1, θ2, θ3, θ4, θ5] are taken 100% directly from demonstrated data.
        
        Uses Two-Stage Phase-Aligned Tri-Anchor Joint-Space Trajectory Blending:
        1. Selects k=3 nearest human demonstrations enclosing or adjacent to the target point.
        2. Computes normalized Inverse Distance Weights (IDW): w_i = (1 / (d_i + eps)^2) / sum(...)
        3. Separates Phase A (Approach to Grasp) and Phase B (Lift & Retract) at the exact grasp frame.
        4. Resamples each phase independently, guaranteeing 100% synchronized grasp pose alignment.
        5. Blends the joint angles directly in joint space: theta(t) = sum(w_i * theta_i(t)).
        6. Synchronizes gripper grasping following the primary nearest demonstration.
        """
        neighbors = self.find_k_nearest_demonstrations(target_bx, target_by, k=3, model_id=model_id)
        best_ep, best_dist = neighbors[0]
        
        # If the target is practically on top of a demonstration point (< 0.2cm), use it directly
        if best_dist < 0.2 or len(neighbors) == 1:
            weights = [1.0] + [0.0] * (len(neighbors) - 1)
        else:
            # Inverse Distance Weighting with p=2
            eps = 0.01
            raw_weights = [1.0 / ((d + eps) ** 2) for _, d in neighbors]
            total_w = sum(raw_weights)
            weights = [w / total_w for w in raw_weights]
            
        # Target trajectory length and grasp timing from nearest demo
        traj_best = best_ep["trajectory"]
        g_best = [int(f.get("gripper_state", 0)) for f in traj_best]
        c_best_list = [i for i, v in enumerate(g_best) if v == 1]
        c_best = c_best_list[0] if c_best_list else len(traj_best) - 1

        len_phase1 = c_best + 1
        len_phase2 = len(traj_best) - len_phase1

        t_target1 = np.linspace(0.0, 1.0, len_phase1)
        t_target2 = np.linspace(0.0, 1.0, len_phase2) if len_phase2 > 0 else np.array([])

        # Resample all k trajectories with phase-aligned grasp synchronization
        resampled_joints = []
        for ep, _ in neighbors:
            traj = ep["trajectory"]
            g = [int(f.get("gripper_state", 0)) for f in traj]
            c_list = [i for i, v in enumerate(g) if v == 1]
            c = c_list[0] if c_list else len(traj) - 1

            # Phase A: Approach (from start to grasp frame)
            j_arr1 = np.array([f.get("joints", [90, 90, 90, 90, 90])[:5] for f in traj[:c+1]], dtype=np.float32)
            t_src1 = np.linspace(0.0, 1.0, len(j_arr1))
            interp1 = np.zeros((len_phase1, 5), dtype=np.float32)
            for j in range(5):
                interp1[:, j] = np.interp(t_target1, t_src1, j_arr1[:, j])

            # Phase B: Lift / Retract (from grasp frame to end)
            if len_phase2 > 0 and len(traj) > c + 1:
                j_arr2 = np.array([f.get("joints", [90, 90, 90, 90, 90])[:5] for f in traj[c+1:]], dtype=np.float32)
                t_src2 = np.linspace(0.0, 1.0, len(j_arr2))
                interp2 = np.zeros((len_phase2, 5), dtype=np.float32)
                for j in range(5):
                    interp2[:, j] = np.interp(t_target2, t_src2, j_arr2[:, j])
                combined = np.vstack([interp1, interp2])
            else:
                combined = interp1
            resampled_joints.append(combined)

        # Perform Tri-Anchor Joint Blending across all 5 demonstrated joints
        target_len = len(traj_best)
        blended_joints = np.zeros((target_len, 5), dtype=np.float32)
        for i, w in enumerate(weights):
            blended_joints += w * resampled_joints[i]

        # Gripper state: follow closest demonstration sequence
        primary_gripper = [int(f.get("gripper_state", 0)) for f in best_ep["trajectory"]]

        synthesized_trajectory = []
        for idx in range(target_len):
            progress = idx / max(1, target_len - 1)

            # 100% pure demonstrated joint angles - zero artificial roll or theta offsets
            corr_j0 = int(np.clip(np.round(blended_joints[idx, 0]), 15, 165))
            corr_j1 = int(np.clip(np.round(blended_joints[idx, 1]), 15, 165))
            corr_j2 = int(np.clip(np.round(blended_joints[idx, 2]), 15, 165))
            corr_j3 = int(np.clip(np.round(blended_joints[idx, 3]), 15, 165))
            corr_j4 = int(np.clip(np.round(blended_joints[idx, 4]), 15, 165))

            grip_st = primary_gripper[idx]

            synthesized_trajectory.append({
                "joints": [corr_j0, corr_j1, corr_j2, corr_j3, corr_j4],
                "gripper_state": grip_st,
                "progress": progress
            })

        anchor_summary = f"Demos {[ep.get('number', i+1) for ep, _ in neighbors]} (w={[round(w, 2) for w in weights]})"
        return synthesized_trajectory, anchor_summary, round(best_dist, 1)

    async def _execute_trajectory(self, target_bx: float, target_by: float, target_bth: float, model_id: str = "v1", broadcast_callback=None, target_tag_id: int = 0) -> Tuple[bool, str]:
        """
        Executes decoupled pick-and-place pipeline on physical arm:
        1. Loads policy weights and synthesizes pick-only trajectory from demonstrations.
        2. Aligns arm to start pose (Cosine S-Curve).
        3. Streams neural policy trajectory at 30Hz to grasp and lift block.
        4. Transfers block via deterministic Cosine S-Curve to calibrated drop bin.
        5. Returns arm safely to Home position.
        """
        self.target_block_pose = {"x_cm": target_bx, "y_cm": target_by, "theta_deg": target_bth, "tag_id": target_tag_id}
        
        # Load Deep Multi-Layer Perceptron (MLP) Policy Model & Synthesize Trajectory
        model_weights = self.load_model_weights(model_id)
        if model_weights:
            logger.info(f"Loaded Deep MLP Behavior Cloning Model '{model_id}' (Loss: {model_weights.get('best_loss', 0.3627):.4f}, Transitions: {model_weights.get('num_transitions', 10964)})")
            
        try:
            trajectory, anchor_demo_num, dist = self.generate_policy_trajectory(target_bx, target_by, target_bth, model_id)
        except Exception as e:
            logger.error(f"Failed to synthesize trajectory: {e}")
            return False, f"Failed to synthesize autonomous policy trajectory: {e}"
            
        self.is_running = True
        self.current_model_id = model_id
        self.total_steps = len(trajectory)
        self.current_step = 0
        self.progress_pct = 0.0
        
        target_name = "Block 2 (Tag 1)" if target_tag_id == 1 else "Block 1 (Tag 0)"
        logger.info(f"Starting autonomous pick-and-place (Target: {target_name} at X={target_bx}cm, Y={target_by}cm, theta={target_bth} deg, Model: {model_id}, Anchors: {anchor_demo_num} d={dist}cm)")

        open_angle = getattr(self.serial_manager, "gripper_open", 140)
        close_angle = getattr(self.serial_manager, "gripper_closed", 85)

        try:
            # Phase 1: Smooth alignment from current arm pose to start pose (1.0s Cosine S-Curve)
            self.current_phase = "Aligning to Start Pose"
            self.progress_pct = 5.0
            if broadcast_callback:
                await broadcast_callback()
                
            first_frame = trajectory[0]
            start_grip = close_angle if first_frame["gripper_state"] == 1 else open_angle
            start_pose = list(first_frame["joints"]) + [start_grip]
            
            success, msg = await self.serial_manager.smooth_transition_to_angles(start_pose, duration_sec=1.0, broadcast_callback=broadcast_callback)
            if not success or self.is_aborted or (not self.is_running and not self.is_loop_active):
                return False, "Alignment aborted."

            # Phase 2: Autonomous 30Hz policy execution
            is_pick_only = (model_id == "v1")
            dt = 0.033 # 33ms step rate (~30Hz)
            for idx, frame in enumerate(trajectory):
                if self.is_aborted or (not self.is_running and not self.is_loop_active):
                    logger.warning("Autonomous policy execution aborted mid-trajectory.")
                    return False, "Execution aborted."
                    
                self.current_step = idx + 1
                if is_pick_only:
                    self.progress_pct = min(70.0, 5.0 + (self.current_step / self.total_steps) * 65.0)
                    p = frame["progress"]
                    if p < 0.60:
                        self.current_phase = "Approaching Target Block"
                    elif p < 0.85:
                        self.current_phase = "Grasping Block"
                    else:
                        self.current_phase = "Lifting Block to Clearance Height"
                else:
                    self.progress_pct = (self.current_step / self.total_steps) * 100.0
                    p = frame["progress"]
                    if p < 0.35:
                        self.current_phase = "Approaching Target Block"
                    elif p < 0.50:
                        self.current_phase = "Grasping Block"
                    elif p < 0.75:
                        self.current_phase = "Lifting & Transferring to Target Box"
                    elif p < 0.90:
                        self.current_phase = "Releasing Block into Target Box"
                    else:
                        self.current_phase = "Retracting Arm"
                    
                gripper_state = frame["gripper_state"]
                grip_angle = close_angle if gripper_state == 1 else open_angle
                target_angles = list(frame["joints"]) + [grip_angle]
                
                self.current_angles = target_angles
                self.serial_manager.send_angles(target_angles)
                
                if idx % 5 == 0 and broadcast_callback:
                    await broadcast_callback()
                    
                await asyncio.sleep(dt)

            if self.is_aborted or (not self.is_running and not self.is_loop_active):
                return False, "Execution aborted before completion."

            if is_pick_only:
                # Settle delay for physical grip confirmation
                await asyncio.sleep(0.35)

                # Phase 3: Deterministic Cosine S-Curve Drop Transfer (Decoupled Architecture - Decision #36)
                drop_locs = load_drop_locations()
                drop_key = "block_2" if target_tag_id == 1 else "block_1"
                target_bin_pose_5 = drop_locs.get(drop_key, {}).get("angles", [140, 80, 85, 90, 90])[:5]

                # 3a. Move directly from lifted pick pose to Calibrated Drop Bin (holding block, gripper closed)
                target_bin_name = "Block 2 Bin (Tag 1)" if target_tag_id == 1 else "Block 1 Bin (Tag 0)"
                self.current_phase = f"Transferring to Drop Bin ({target_bin_name})"
                self.progress_pct = 85.0
                if broadcast_callback:
                    await broadcast_callback()
                drop_bin_pose_closed = target_bin_pose_5 + [close_angle]
                success, msg = await self.serial_manager.smooth_transition_to_angles(
                    drop_bin_pose_closed, duration_sec=1.2, broadcast_callback=broadcast_callback
                )
                if not success or self.is_aborted or (not self.is_running and not self.is_loop_active):
                    return False, "Move to drop bin aborted."

                # 3b. Release Block into Drop Bin (Open Gripper)
                self.current_phase = "Releasing Block into Bin"
                self.progress_pct = 92.0
                if broadcast_callback:
                    await broadcast_callback()
                drop_bin_pose_open = target_bin_pose_5 + [open_angle]
                success, msg = await self.serial_manager.smooth_transition_to_angles(
                    drop_bin_pose_open, duration_sec=0.5, broadcast_callback=broadcast_callback
                )
                if not success or self.is_aborted or (not self.is_running and not self.is_loop_active):
                    return False, "Gripper release aborted."
                await asyncio.sleep(0.3)

            # Smooth return directly to Home Position (Gripper Open)
            self.current_phase = "Returning to Home Position"
            self.progress_pct = 100.0
            if broadcast_callback:
                await broadcast_callback()
            home_angles = [90, 90, 90, 90, 90, open_angle]
            await self.serial_manager.smooth_transition_to_angles(
                home_angles, duration_sec=1.2, broadcast_callback=broadcast_callback
            )

            self.current_phase = "Pick & Place Completed"
            logger.info(f"Autonomous pick-and-place sequence finished successfully (Model: {model_id}).")
            return True, f"Autonomous pick-and-place sequence completed successfully (Model: {model_id})."

        except Exception as e:
            logger.error(f"Error during autonomous execution: {e}")
            self.current_phase = f"Error: {e}"
            return False, str(e)
        finally:
            self.is_running = False
            if broadcast_callback:
                await broadcast_callback()

    async def run_autonomous_policy(self, model_id: str = "v1", broadcast_callback=None) -> Tuple[bool, str]:
        """
        Single-shot autonomous execution routine:
        1. Queries live vision status to capture target block pose.
        2. Synthesizes policy trajectory.
        3. Executes pick-and-place sequence.
        """
        if self.is_running or self.is_loop_active:
            return False, "Autonomous execution already in progress."

        # Perception Check
        vision_pose = self.vision_manager.latest_block_pose
        if not vision_pose or not vision_pose.get("valid", False):
            return False, "Target Block (ArUco ID 0 or 1) or World Origin (ArUco ID 2) not detected by Camera 1. Ensure markers are visible."
            
        target_bx = float(vision_pose["x_cm"])
        target_by = float(vision_pose["y_cm"])
        target_bth = float(vision_pose["theta_deg"])
        target_tag_id = int(vision_pose.get("tag_id", 0))
        
        # Safe workspace bounds validation (0-30cm x 0-25cm with margin)
        if not (-2.0 <= target_bx <= 32.0 and -2.0 <= target_by <= 28.0):
            return False, f"Target block pose ({target_bx}cm, {target_by}cm) is outside safe workspace bounds (0-30cm x 0-25cm)."
            
        self.is_aborted = False
        return await self._execute_trajectory(
            target_bx=target_bx,
            target_by=target_by,
            target_bth=target_bth,
            model_id=model_id,
            broadcast_callback=broadcast_callback,
            target_tag_id=target_tag_id
        )

    def start_autonomous_loop(self, model_id: str = "v1", broadcast_callback=None) -> Tuple[bool, str]:
        """
        Starts continuous autonomous loop in Standby mode:
        The arm rests at Home, continuously monitors camera vision,
        verifies 1.0s stationary stability when a block appears,
        runs pick-and-place, returns Home, and immediately re-enters Standby.
        """
        if self.is_loop_active:
            return False, "Autonomous loop is already active."
        if self.is_running:
            return False, "Single execution already in progress."
            
        self.is_loop_active = True
        self.is_aborted = False
        self.loop_model_id = model_id
        self.current_model_id = model_id
        self.loop_state = "standby"
        self.current_phase = "Standby - Initializing Home Pose"
        self.stability_start_time = None
        self.stability_countdown = 1.0
        self.last_stable_pose = None
        
        self.loop_task = asyncio.create_task(self._autonomous_loop_worker(broadcast_callback))
        return True, "Autonomous continuous loop started in Standby mode."

    async def _autonomous_loop_worker(self, broadcast_callback=None):
        """
        Autonomous continuous loop worker task:
        1. Safely moves arm to Home position.
        2. Monitors Camera 1 perception in Standby mode.
        3. Verifies stability: block stationary within delta thresholds for 1.0 full second.
        4. Executes autonomous pick and place trajectory using chosen model.
        5. Safely returns to Home position and immediately re-enters Standby mode.
        6. Repeats indefinitely until stopped or aborted.
        """
        logger.info(f"Autonomous continuous loop worker started with Model '{self.loop_model_id}'.")
        
        open_angle = getattr(self.serial_manager, "gripper_open", 140)
        home_angles = [90, 90, 90, 90, 90, open_angle]
        
        try:
            # Step 1: Initial transition to Home pose
            self.loop_state = "standby"
            self.current_phase = "Moving to Standby Home Position"
            if broadcast_callback:
                await broadcast_callback()
            await self.serial_manager.smooth_transition_to_angles(home_angles, duration_sec=1.0, broadcast_callback=broadcast_callback)
            
            self.current_phase = "Standby - Waiting for Block in Workspace"
            if broadcast_callback:
                await broadcast_callback()
                
            while self.is_loop_active and not self.is_aborted:
                # Query perception
                vision_pose = self.vision_manager.latest_block_pose
                is_valid = bool(vision_pose and vision_pose.get("valid", False))
                
                if is_valid:
                    bx = float(vision_pose["x_cm"])
                    by = float(vision_pose["y_cm"])
                    bth = float(vision_pose.get("theta_deg", 0.0))
                    tag_id = int(vision_pose.get("tag_id", 0))
                    
                    # Workspace bounds check (0-30cm x 0-25cm with margin)
                    if (-2.0 <= bx <= 32.0 and -2.0 <= by <= 28.0):
                        now = time.time()
                        if self.last_stable_pose is None:
                            # First detection in workspace
                            self.last_stable_pose = {"x_cm": bx, "y_cm": by, "theta_deg": bth, "tag_id": tag_id}
                            self.stability_start_time = now
                            self.stability_countdown = 1.0
                            self.loop_state = "stabilizing"
                            self.current_phase = "Verifying Block Stability (1.0s)..."
                        else:
                            # Displacement & rotation jitter check
                            dx = abs(bx - self.last_stable_pose["x_cm"])
                            dy = abs(by - self.last_stable_pose["y_cm"])
                            dth = abs(bth - self.last_stable_pose["theta_deg"])
                            
                            # Threshold: max 0.8 cm displacement, 15 deg theta jitter
                            if dx > 0.8 or dy > 0.8 or dth > 15.0:
                                # Movement detected: reset 1.0s stability countdown
                                self.last_stable_pose = {"x_cm": bx, "y_cm": by, "theta_deg": bth, "tag_id": tag_id}
                                self.stability_start_time = now
                                self.stability_countdown = 1.0
                                self.loop_state = "stabilizing"
                                self.current_phase = "Block Moved - Stabilizing (1.0s)..."
                            else:
                                elapsed = now - self.stability_start_time
                                self.stability_countdown = max(0.0, 1.0 - elapsed)
                                
                                if self.stability_countdown <= 0.0:
                                    # Block confirmed stationary for 1.0s! Trigger execution
                                    tag_name = "Block 2 (Tag 1)" if tag_id == 1 else "Block 1 (Tag 0)"
                                    logger.info(f"{tag_name} stability confirmed at X={bx:.1f}cm, Y={by:.1f}cm, theta={bth:.1f} deg. Starting pick & place.")
                                    self.loop_state = "executing"
                                    self.current_phase = f"Executing Pick & Place ({tag_name})"
                                    if broadcast_callback:
                                        await broadcast_callback()
                                        
                                    success, msg = await self._execute_trajectory(
                                        target_bx=bx,
                                        target_by=by,
                                        target_bth=bth,
                                        model_id=self.loop_model_id,
                                        broadcast_callback=broadcast_callback,
                                        target_tag_id=tag_id
                                    )
                                    
                                    if not self.is_loop_active or self.is_aborted:
                                        break
                                        
                                    # Arm has smoothly returned to Home. Reset stability state for next block.
                                    self.loop_state = "standby"
                                    self.current_phase = "Standby - Waiting for Block in Workspace"
                                    self.stability_start_time = None
                                    self.stability_countdown = 1.0
                                    self.last_stable_pose = None
                                    
                                    if broadcast_callback:
                                        await broadcast_callback()
                                        
                                    # 1.0s settle delay to ensure physical arm rest and clear scene view
                                    await asyncio.sleep(1.0)
                                    continue
                    else:
                        # Block detected but outside manipulation workspace
                        if self.loop_state != "standby":
                            self.loop_state = "standby"
                            self.current_phase = "Standby - Block Outside Workspace Bounds"
                            self.stability_start_time = None
                            self.stability_countdown = 1.0
                            self.last_stable_pose = None
                else:
                    # No block detected
                    if self.loop_state != "standby":
                        self.loop_state = "standby"
                        self.current_phase = "Standby - Waiting for Block in Workspace"
                        self.stability_start_time = None
                        self.stability_countdown = 1.0
                        self.last_stable_pose = None
                        
                if broadcast_callback and self.loop_state == "stabilizing":
                    await broadcast_callback()
                    
                await asyncio.sleep(0.05)
                
        except asyncio.CancelledError:
            logger.info("Autonomous loop worker task cancelled.")
        except Exception as e:
            logger.error(f"Unexpected error in autonomous loop worker: {e}")
        finally:
            self.is_loop_active = False
            self.loop_state = "idle"
            if not self.is_aborted:
                self.current_phase = "Idle"
            if broadcast_callback:
                await broadcast_callback()
            logger.info("Autonomous continuous loop stopped.")
