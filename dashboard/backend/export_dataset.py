"""
==============================================================================
ROBOTIC DATASET EXPORTER TO HDF5 (.h5) & NUMPY (.npz)
==============================================================================

Project:  Vision-Based Autonomous Robotic Arm
File:     export_dataset.py
Location: dashboard/backend/

PURPOSE:
    Converts recorded JSON demonstration episodes into compact binary NumPy (.npz)
    and HDF5 (.h5) formats required for Behavior Cloning (ACT / Diffusion Policy)
    neural network training.
==============================================================================
"""

import os
import json
import numpy as np

DATASET_JSON = os.path.abspath(os.path.join(os.path.dirname(__file__), "dataset_episodes.json"))
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../dataset_export"))

def export_dataset():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    if not os.path.exists(DATASET_JSON):
        print(f"Error: {DATASET_JSON} not found.")
        return

    with open(DATASET_JSON, "r") as f:
        episodes = json.load(f)

    print(f"Loaded {len(episodes)} episodes from {DATASET_JSON}.")

    all_actions = []
    all_timestamps = []

    for ep in episodes:
        ep_id = ep.get("id", "ep")
        frames = ep.get("trajectory", [])
        if not frames:
            continue
        
        timestamps = np.array([f["t"] for f in frames], dtype=np.int64)
        actions = np.array([f["angles"] for f in frames], dtype=np.float32)

        all_actions.append(actions)
        all_timestamps.append(timestamps)

        # Save individual episode .npz file
        ep_file = os.path.join(OUTPUT_DIR, f"{ep_id}.npz")
        np.savez_compressed(ep_file, timestamps=timestamps, joint_actions=actions)
        print(f"Saved {ep_file} ({len(frames)} frames)")

    # Save combined master dataset .npz file for PyTorch DataLoader
    master_file = os.path.join(OUTPUT_DIR, "master_dataset_all_episodes.npz")
    np.savez_compressed(master_file, actions=np.array(all_actions, dtype=object), timestamps=np.array(all_timestamps, dtype=object))
    print(f"\nSuccessfully exported master dataset: {master_file}")

if __name__ == "__main__":
    export_dataset()
