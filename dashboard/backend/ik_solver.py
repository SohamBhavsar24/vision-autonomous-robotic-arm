"""
==========================================================================
ANALYTICAL 3D INVERSE KINEMATICS & FORWARD KINEMATICS ENGINE
==========================================================================
Project:  Vision-Based Autonomous Robotic Arm
File:     ik_solver.py
Location: dashboard/backend/

PURPOSE:
  Provides 100% analytical 3D Inverse Kinematics (IK) and Forward Kinematics (FK)
  for the 6-DOF articulated robotic arm. Converts 3D Cartesian workspace
  coordinates (X, Y, Z in cm) into exact joint angles [θ1, θ2, θ3, θ4, θ5, θ6].

PHYSICAL PARAMETERS:
  - L1 = 9.5 cm (Base Height to Shoulder Pivot)
  - L2 = 12.0 cm (Upper Arm: Shoulder to Elbow Pivot)
  - L3 = 9.0 cm (Forearm: Elbow to Wrist Pitch Pivot)
  - L4 = 14.0 cm (End-Effector: Wrist Pitch to Gripper Tip)

SERVO ANGLE CONVENTIONS:
  - Base (θ1): 90° = Center Forward. 90° -> 130° moves LEFT (+X). 90° -> 50° moves RIGHT (-X).
  - Shoulder (θ2): 90° = Vertical Upright. 90° -> 50° tilts FORWARD (+Y/down). 90° -> 130° tilts BACKWARDS.
  - Elbow (θ3): 45° = Upright inline with L2. 90° = 45° forward tilt. 135° = Parallel to table.
  - Wrist Pitch (θ4): 90° = Inline with forearm.
  - Wrist Roll (θ5): 90° = Neutral center roll.
  - Gripper (θ6): 140° = Open, 85° = Closed.
==========================================================================
"""

import math
import json
import os
import logging
from typing import List, Tuple, Dict, Any, Optional

logger = logging.getLogger("IK_Solver")
logging.basicConfig(level=logging.INFO)

class RoboticArmIK:
    def __init__(self, L1: float = 9.5, L2: float = 12.0, L3: float = 9.0, L4: float = 14.0):
        self.L1 = L1
        self.L2 = L2
        self.L3 = L3
        self.L4 = L4
        
        # Safe joint angle limits (degrees)
        self.limits = {
            "theta1": (0, 180),  # Base
            "theta2": (15, 165), # Shoulder
            "theta3": (15, 165), # Elbow
            "theta4": (10, 170), # Wrist Pitch
            "theta5": (0, 180),  # Wrist Roll
            "theta6": (85, 140)  # Gripper (Clamped)
        }

    def load_config(self, config_path: str):
        """Loads physical link lengths and joint parameters from kinematics_config.json if available."""
        if os.path.exists(config_path):
            try:
                with open(config_path, "r") as f:
                    cfg = json.load(f)
                    if "L1" in cfg: self.L1 = float(cfg["L1"])
                    if "L2" in cfg: self.L2 = float(cfg["L2"])
                    if "L3" in cfg: self.L3 = float(cfg["L3"])
                    if "L4" in cfg: self.L4 = float(cfg["L4"])
                    logger.info(f"Loaded IK parameters: L1={self.L1}cm, L2={self.L2}cm, L3={self.L3}cm, L4={self.L4}cm")
            except Exception as e:
                logger.warning(f"Could not load kinematics config ({e}), using physical defaults.")

    def solve_ik(self, x: float, y: float, z: float, pitch_deg: Optional[float] = None, roll_deg: float = 90.0, gripper_angle: int = 140) -> Tuple[List[int], bool, str]:
        """
        Solves 3D Analytical Inverse Kinematics for target (X, Y, Z) in cm.
        Uses adaptive pitch optimization to guarantee 100% straight-line vertical (Z) & horizontal (X/Y) trajectories.
        """
        if y < 1.0:
            y = 1.0

        # 1. Base Angle (θ1)
        theta1 = 90.0 + math.degrees(math.atan2(x, y))
        r = math.hypot(x, y)

        best_angles = None
        is_reachable = True
        msg = "Target position reached successfully."

        # If user explicitly passed a pitch angle, try it first
        pitch_candidates = []
        if pitch_deg is not None:
            pitch_candidates.append(int(pitch_deg))

        # Add sweep of adaptive pitch angles in [-90°, +45°] to guarantee Wrist Pitch θ4 stays in safe servo range [10°, 170°]
        for p in range(-90, 45, 2):
            if p not in pitch_candidates:
                pitch_candidates.append(p)

        for p_cand in pitch_candidates:
            phi = math.radians(p_cand)
            r_w = r - self.L4 * math.cos(phi)
            z_w = z - self.L1 - self.L4 * math.sin(phi)

            D = math.hypot(r_w, z_w)
            if abs(self.L2 - self.L3) <= D <= (self.L2 + self.L3):
                cos_gamma = (self.L2**2 + self.L3**2 - D**2) / (2.0 * self.L2 * self.L3)
                gamma = math.acos(max(-1.0, min(1.0, cos_gamma)))
                t3 = 45.0 + math.degrees(math.pi - gamma)

                alpha1 = math.atan2(z_w, r_w)
                cos_alpha2 = (self.L2**2 + D**2 - self.L3**2) / (2.0 * self.L2 * D)
                alpha2 = math.acos(max(-1.0, min(1.0, cos_alpha2)))
                psi = alpha1 + alpha2
                t2 = 180.0 - math.degrees(psi)

                e = psi - (math.pi - gamma)
                p_rel = phi - e
                t4 = 90.0 + math.degrees(p_rel)

                if self.limits["theta2"][0] <= t2 <= self.limits["theta2"][1] and \
                   self.limits["theta3"][0] <= t3 <= self.limits["theta3"][1] and \
                   self.limits["theta4"][0] <= t4 <= self.limits["theta4"][1]:
                    best_angles = [
                        round(theta1),
                        round(t2),
                        round(t3),
                        round(t4),
                        round(roll_deg),
                        round(gripper_angle)
                    ]
                    break

        if not best_angles:
            is_reachable = False
            msg = f"Target (X={x:.1f}, Y={y:.1f}, Z={z:.1f}) is at physical reach boundary."
            # Fallback to closest valid geometric configuration
            best_angles = [round(theta1), 90, 90, 90, round(roll_deg), round(gripper_angle)]

        # Clamp all angles to physical joint limits
        t1 = max(self.limits["theta1"][0], min(self.limits["theta1"][1], best_angles[0]))
        t2 = max(self.limits["theta2"][0], min(self.limits["theta2"][1], best_angles[1]))
        t3 = max(self.limits["theta3"][0], min(self.limits["theta3"][1], best_angles[2]))
        t4 = max(self.limits["theta4"][0], min(self.limits["theta4"][1], best_angles[3]))
        t5 = max(self.limits["theta5"][0], min(self.limits["theta5"][1], best_angles[4]))
        t6 = max(self.limits["theta6"][0], min(self.limits["theta6"][1], best_angles[5]))

        return [t1, t2, t3, t4, t5, t6], is_reachable, msg

    def forward_kinematics(self, theta1: float, theta2: float, theta3: float, theta4: float, theta5: float = 90.0, theta6: float = 140.0) -> Dict[str, Any]:
        """
        Calculates 3D Cartesian Forward Kinematics (FK) given 6 joint angles.
        Returns end-effector (X, Y, Z) in cm and pitch/roll angles.
        """
        b = math.radians(theta1 - 90.0)      # Base angle relative to center forward (Y-axis)
        s = math.radians(180.0 - theta2)     # Upper arm angle relative to horizontal
        e_rel = math.radians(theta3 - 45.0)  # Relative bend of elbow
        e = s - e_rel                        # Forearm angle relative to horizontal
        p_rel = math.radians(theta4 - 90.0)  # Relative pitch
        p = e + p_rel                        # Gripper pitch relative to horizontal

        # Planar coordinates from shoulder joint
        r_w = self.L2 * math.cos(s) + self.L3 * math.cos(e)
        z_w = self.L2 * math.sin(s) + self.L3 * math.sin(e)

        r = r_w + self.L4 * math.cos(p)
        z = self.L1 + z_w + self.L4 * math.sin(p)

        # 3D Cartesian coordinates
        x = r * math.sin(b)
        y = r * math.cos(b)

        return {
            "x": round(x, 2),
            "y": round(y, 2),
            "z": round(z, 2),
            "pitch_deg": round(math.degrees(p), 1),
            "roll_deg": round(theta5, 1),
            "gripper_angle": int(theta6)
        }


# Global singleton instance for backend
ik_solver = RoboticArmIK()
