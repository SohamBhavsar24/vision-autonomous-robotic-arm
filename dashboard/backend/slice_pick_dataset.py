"""
==============================================================================
PICK-ONLY DATASET SLICER
==============================================================================
Project:  Vision-Based Autonomous Robotic Arm
File:     slice_pick_dataset.py
Location: dashboard/backend/

PURPOSE:
    Slices demonstration episodes to create a pristine, pick-only imitation
    learning dataset under the Decoupled Architecture (Decision #33).
    
    ALGORITHM:
    1. Identifies the initial grasp frame where gripper_state transitions to 1.
    2. Records the base azimuth angle at grasp (base_grasp).
    3. Keeps all frames while the arm executes the vertical lift with the base
       stationary (|base - base_grasp| <= 1.5 deg).
    4. Truncates and discards all subsequent frames the moment the base angle
       deviates (> 1.5 deg), signaling the start of the manual drop transfer.
==============================================================================
"""

import os
import glob
import json
import logging
from dataset_formatter import format_compact_episode, save_compact_dataset_file

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("PickDatasetSlicer")

DATASETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "datasets"))
MASTER_DATASET_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "dataset_episodes.json"))

def slice_all_episodes(max_base_deviation: float = 1.5):
    """Trims all demonstration episodes in datasets/ to pick-only trajectories."""
    episode_files = sorted(glob.glob(os.path.join(DATASETS_DIR, "episode_*.json")))
    if not episode_files:
        logger.error(f"No episode files found in {DATASETS_DIR}")
        return

    logger.info(f"Found {len(episode_files)} episodes to process. Slicing pick-only sequences...")

    updated_episodes = []
    total_original_frames = 0
    total_trimmed_frames = 0

    for ep_file in episode_files:
        with open(ep_file, "r", encoding="utf-8") as f:
            ep = json.load(f)

        traj = ep.get("trajectory", [])
        orig_len = len(traj)
        total_original_frames += orig_len

        # 1. Find grasp frame (first frame where gripper_state == 1)
        grasp_idx = -1
        for i, frame in enumerate(traj):
            if frame.get("gripper_state") == 1:
                grasp_idx = i
                break

        if grasp_idx == -1:
            logger.warning(f"No grasp frame (gripper_state == 1) in {os.path.basename(ep_file)}. Leaving intact.")
            updated_episodes.append(ep)
            total_trimmed_frames += orig_len
            continue

        base_grasp = traj[grasp_idx]["joints"][0]

        # 2. Find cutoff frame where base starts deviating after grasp
        cutoff_idx = orig_len
        for i in range(grasp_idx, orig_len):
            cur_base = traj[i]["joints"][0]
            if abs(cur_base - base_grasp) > max_base_deviation:
                cutoff_idx = i
                break

        # 3. Slice trajectory
        trimmed_traj = traj[:cutoff_idx]
        new_len = len(trimmed_traj)
        total_trimmed_frames += new_len

        # Recalculate duration
        if new_len > 0:
            duration_sec = f"{(trimmed_traj[-1].get('t', 0) - trimmed_traj[0].get('t', 0)) / 1000.0:.1f}"
        else:
            duration_sec = "0.0"

        ep["trajectory"] = trimmed_traj
        ep["frameCount"] = new_len
        ep["durationSec"] = duration_sec

        # Overwrite individual episode file
        compact_content = format_compact_episode(ep)
        with open(ep_file, "w", encoding="utf-8") as f:
            f.write(compact_content)

        updated_episodes.append(ep)
        logger.info(
            f"  {os.path.basename(ep_file)}: {orig_len} -> {new_len} frames "
            f"(grasp at frame {grasp_idx}, base={base_grasp} deg, cutoff at {cutoff_idx})"
        )

    # 4. Update master aggregate file
    save_compact_dataset_file(updated_episodes, MASTER_DATASET_FILE)

    pct_reduced = (1.0 - (total_trimmed_frames / max(1, total_original_frames))) * 100.0
    logger.info("=" * 60)
    logger.info(f"Slicing complete across all {len(updated_episodes)} episodes.")
    logger.info(f"Total dataset frames: {total_original_frames} -> {total_trimmed_frames} ({pct_reduced:.1f}% reduction).")
    logger.info(f"Master dataset synced: {MASTER_DATASET_FILE}")
    logger.info("=" * 60)

if __name__ == "__main__":
    slice_all_episodes(max_base_deviation=1.5)
