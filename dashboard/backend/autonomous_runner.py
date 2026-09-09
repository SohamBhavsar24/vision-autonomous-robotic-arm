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

class AutonomousRunner:
    def __init__(self, serial_manager, vision_manager):
        self.serial_manager = serial_manager
        self.vision_manager = vision_manager
        
        self.is_running = False
        self.is_aborted = False
        
        self.current_model_id: Optional[str] = "v1"
        self.current_step = 0
        self.total_steps = 0
        self.current_phase = "Idle"
        self.progress_pct = 0.0
        self.current_angles = [90, 90, 90, 90, 90, 140]
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
        """Returns live execution status and telemetry."""
        return {
            "is_running": self.is_running,
            "is_aborted": self.is_aborted,
            "model_id": self.current_model_id,
            "current_step": self.current_step,
            "total_steps": self.total_steps,
            "progress_pct": round(self.progress_pct, 1),
            "phase": self.current_phase,
            "current_angles": self.current_angles,
            "target_block_pose": self.target_block_pose
        }

    def abort(self) -> Tuple[bool, str]:
        """Immediately aborts any active autonomous policy execution."""
        if not self.is_running:
            return False, "No autonomous execution is active."
            
        self.is_aborted = True
        self.is_running = False
        self.current_phase = "Aborted"
        logger.warning("Autonomous execution aborted by user.")
        
        # Trigger smooth home transition
        try:
            asyncio.create_task(self.serial_manager.move_to_home())
        except Exception:
            pass
            
        return True, "Autonomous execution aborted."

    def find_k_nearest_demonstrations(self, target_bx: float, target_by: float, k: int = 3):
        """
        Finds the k nearest human demonstrations from the 30 grid demonstration episodes
        based on Euclidean distance to (target_bx, target_by).
        Returns a list of tuples: [(episode_data, distance), ...]
        """
        files = sorted(glob.glob(os.path.join(DATASETS_DIR, "episode_*.json")))
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
            raise ValueError("No demonstration datasets available to synthesize trajectory.")
            
        candidates.sort(key=lambda x: x[1])
        return candidates[:k]

    def generate_policy_trajectory(self, target_bx: float, target_by: float, target_bth: float, model_id: str = "v1"):
        """
        Generates high-accuracy autonomous trajectory conditioned on target block pose (X, Y, θ)
        without Inverse Kinematics.
        
        Uses Tri-Anchor Joint-Space Trajectory Blending:
        1. Selects k=3 nearest human demonstrations enclosing or adjacent to the target point.
        2. Computes normalized Inverse Distance Weights (IDW): w_i = (1 / (d_i + eps)^2) / sum(...)
        3. Resamples the joint trajectories across normalized execution time [0, 1].
        4. Blends the joint angles directly in joint space: theta(t) = sum(w_i * theta_i(t)).
        5. Synchronizes gripper grasping and block orientation theta compensation.
        """
        neighbors = self.find_k_nearest_demonstrations(target_bx, target_by, k=3)
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
            
        # Target trajectory length from nearest demo
        target_len = len(best_ep["trajectory"])
        time_target = np.linspace(0.0, 1.0, target_len)
        
        # Resample all k trajectories to target_len in joint space
        resampled_joints = []
        demo_orientations = []
        
        for ep, _ in neighbors:
            traj = ep["trajectory"]
            demo_pose = ep.get("initial_block_pose") or {}
            demo_orientations.append(float(demo_pose.get("theta_deg", 0.0)))
            
            m = len(traj)
            time_source = np.linspace(0.0, 1.0, m)
            
            j_arr = np.array([f.get("joints", [90, 90, 90, 90, 90])[:5] for f in traj], dtype=np.float32)
            
            # Interpolate each joint dimension
            interp_j = np.zeros((target_len, 5), dtype=np.float32)
            for j_idx in range(5):
                interp_j[:, j_idx] = np.interp(time_target, time_source, j_arr[:, j_idx])
            
            resampled_joints.append(interp_j)
            
        # Perform Tri-Anchor Joint Blending
        blended_joints = np.zeros((target_len, 5), dtype=np.float32)
        for i, w in enumerate(weights):
            blended_joints += w * resampled_joints[i]
            
        # Gripper state: follow closest demonstration sequence
        primary_gripper = [int(f.get("gripper_state", 0)) for f in best_ep["trajectory"]]
        
        # Block orientation compensation (wrist roll - Joint 5, index 4)
        avg_demo_bth = sum(w * th for w, th in zip(weights, demo_orientations))
        dth = target_bth - avg_demo_bth
        roll_correction = float(np.clip(dth, -45.0, 45.0))
        
        synthesized_trajectory = []
        for idx in range(target_len):
            progress = idx / max(1, target_len - 1)
            
            # Pick-phase weighting for orientation alignment (progress 0.15 to 0.60)
            if progress < 0.15:
                w_pick = progress / 0.15
            elif progress <= 0.60:
                w_pick = 1.0
            else:
                w_pick = max(0.0, 1.0 - (progress - 0.60) / 0.20)
                
            corr_j0 = int(np.clip(np.round(blended_joints[idx, 0]), 15, 165))
            corr_j1 = int(np.clip(np.round(blended_joints[idx, 1]), 15, 165))
            corr_j2 = int(np.clip(np.round(blended_joints[idx, 2]), 15, 165))
            corr_j3 = int(np.clip(np.round(blended_joints[idx, 3]), 15, 165))
            corr_j4 = int(np.clip(np.round(blended_joints[idx, 4] + roll_correction * w_pick), 0, 180))
            
            grip_st = primary_gripper[idx]
            
            synthesized_trajectory.append({
                "joints": [corr_j0, corr_j1, corr_j2, corr_j3, corr_j4],
                "gripper_state": grip_st,
                "progress": progress
            })
            
        anchor_summary = f"Demos {[ep.get('number', i+1) for ep, _ in neighbors]} (w={[round(w, 2) for w in weights]})"
        return synthesized_trajectory, anchor_summary, round(best_dist, 1)

    async def run_autonomous_policy(self, model_id: str = "v1", broadcast_callback=None) -> Tuple[bool, str]:
        """
        Primary autonomous execution routine:
        1. Queries live vision status to capture target block pose.
        2. Synthesizes policy trajectory via Tri-Anchor Joint-Space Blending.
        3. Aligns arm to start pose.
        4. Streams trajectory commands at 30Hz.
        5. Returns to Home.
        """
        if self.is_running:
            return False, "Autonomous execution already in progress."

        # 1. Perception Check
        vision_pose = self.vision_manager.latest_block_pose
        if not vision_pose or not vision_pose.get("valid", False):
            return False, "Target Block (ArUco ID 0) or World Origin (ArUco ID 2) not detected by Camera 1. Ensure markers are visible."
            
        target_bx = float(vision_pose["x_cm"])
        target_by = float(vision_pose["y_cm"])
        target_bth = float(vision_pose["theta_deg"])
        
        # Workspace bounds validation (X: 30cm, Y: 25cm with margin)
        if not (-2.0 <= target_bx <= 32.0 and -2.0 <= target_by <= 28.0):
            return False, f"Target block pose ({target_bx}cm, {target_by}cm) is outside safe workspace bounds (0-30cm x 0-25cm)."
            
        self.target_block_pose = {"x_cm": target_bx, "y_cm": target_by, "theta_deg": target_bth}
        
        # 2. Synthesize Autonomous Trajectory
        try:
            trajectory, anchor_demo_num, dist = self.generate_policy_trajectory(target_bx, target_by, target_bth, model_id)
        except Exception as e:
            return False, f"Failed to synthesize autonomous policy trajectory: {e}"
            
        self.is_running = True
        self.is_aborted = False
        self.current_model_id = model_id
        self.total_steps = len(trajectory)
        self.current_step = 0
        self.progress_pct = 0.0
        
        logger.info(f"Starting autonomous policy execution (Model: {model_id}, Target: X={target_bx}cm, Y={target_by}cm, θ={target_bth}°, Anchors: {anchor_demo_num} d={dist}cm)")

        open_angle = max(148, getattr(self.serial_manager, "gripper_open", 140))
        close_angle = getattr(self.serial_manager, "gripper_closed", 85)

        try:
            # Phase 1: Smooth alignment from current arm pose to start pose (1.0s Cosine S-Curve)
            self.current_phase = "Aligning to Start Pose"
            if broadcast_callback:
                await broadcast_callback()
                
            first_frame = trajectory[0]
            start_grip = close_angle if first_frame["gripper_state"] == 1 else open_angle
            start_pose = list(first_frame["joints"]) + [start_grip]
            
            success, msg = await self.serial_manager.smooth_transition_to_angles(start_pose, duration_sec=1.0, broadcast_callback=broadcast_callback)
            if not success or self.is_aborted:
                return False, "Alignment aborted."

            # Phase 2: Autonomous 30Hz closed-loop execution
            dt = 0.033 # 33ms step rate (~30Hz)
            for idx, frame in enumerate(trajectory):
                if self.is_aborted or not self.is_running:
                    logger.warning("Autonomous policy execution aborted mid-trajectory.")
                    return False, "Execution aborted."
                    
                self.current_step = idx + 1
                self.progress_pct = (self.current_step / self.total_steps) * 100.0
                
                # Dynamic Phase Labeling
                p = frame["progress"]
                if p < 0.35:
                    self.current_phase = "Approaching Target Block"
                elif p < 0.50:
                    self.current_phase = "Grasping Sponge Block"
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

            # Phase 3: Smooth return to Home Position (1.2s Cosine S-Curve)
            self.current_phase = "Returning to Home Position"
            self.progress_pct = 100.0
            if broadcast_callback:
                await broadcast_callback()
                
            home_angles = [90, 90, 90, 90, 90, open_angle]
            await self.serial_manager.smooth_transition_to_angles(home_angles, duration_sec=1.2, broadcast_callback=broadcast_callback)
            
            self.current_phase = "Completed Successfully"
            logger.info("Autonomous policy pick-and-place sequence finished successfully.")
            return True, "Autonomous pick-and-place sequence completed successfully."

        except Exception as e:
            logger.error(f"Error during autonomous execution: {e}")
            self.current_phase = f"Error: {e}"
            return False, str(e)
        finally:
            self.is_running = False
            if broadcast_callback:
                await broadcast_callback()
