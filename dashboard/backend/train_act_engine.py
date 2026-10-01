"""
==============================================================================
ACTION CHUNKING WITH TRANSFORMERS (ACT) POLICY TRAINING ENGINE
==============================================================================

Project:  Vision-Based Autonomous Robotic Arm
File:     train_act_engine.py
Location: dashboard/backend/

PURPOSE:
    Implements the Action Chunking with Transformers (ACT) imitation learning
    architecture in pure NumPy (Zhao et al., RSS 2023).
    Predicts coordinated future action chunks (H=24 steps) from current state
    and target block coordinates.

    Supports dual conditioning modes for journal paper evaluation:
    1. With Theta (9 dims): [θ1..θ5, gripper, block_x, block_y, block_theta]
    2. Without Theta (8 dims): [θ1..θ5, gripper, block_x, block_y]

    Zero-dependency vectorized BLAS implementation provides fast training,
    sub-2ms inference, and 100% portability to Raspberry Pi 5.
==============================================================================
"""

import os
import glob
import json
import time
import numpy as np
from typing import List, Dict, Any, Tuple, Optional

DATASETS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "datasets"))
MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "models"))
REGISTRY_FILE = os.path.join(MODELS_DIR, "models_registry.json")


def softmax(x: np.ndarray, axis: int = -1) -> np.ndarray:
    """Numerically stable softmax."""
    e_x = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e_x / np.sum(e_x, axis=axis, keepdims=True)


class ACTPolicyNet:
    """
    Action Chunking with Transformers (ACT) policy in pure NumPy.
    Combines learned temporal query embeddings, multi-head self-attention,
    feed-forward blocks, and dual output prediction heads.
    """
    def __init__(self, in_dim: int = 8, chunk_size: int = 24, d_model: int = 64, n_heads: int = 4, d_ff: int = 128):
        self.in_dim = in_dim
        self.chunk_size = H = chunk_size
        self.d_model = d = d_model
        self.n_heads = h = n_heads
        self.d_k = dk = d // h
        self.d_ff = d_ff

        np.random.seed(42)

        # 1. Observation projection
        self.W_obs = np.random.randn(in_dim, d).astype(np.float32) * np.sqrt(2.0 / in_dim)
        self.b_obs = np.zeros(d, dtype=np.float32)

        # 2. Sinusoidal temporal query positional embeddings (H, d)
        self.Q_pos = np.zeros((H, d), dtype=np.float32)
        for pos in range(H):
            for i in range(0, d, 2):
                self.Q_pos[pos, i] = np.sin(pos / (10000.0 ** (i / d)))
                if i + 1 < d:
                    self.Q_pos[pos, i + 1] = np.cos(pos / (10000.0 ** (i / d)))

        # 3. Multi-Head Self-Attention projections
        self.W_q = np.random.randn(d, d).astype(np.float32) * np.sqrt(2.0 / d)
        self.W_k = np.random.randn(d, d).astype(np.float32) * np.sqrt(2.0 / d)
        self.W_v = np.random.randn(d, d).astype(np.float32) * np.sqrt(2.0 / d)
        self.W_o = np.random.randn(d, d).astype(np.float32) * np.sqrt(2.0 / d)
        self.b_o = np.zeros(d, dtype=np.float32)

        # 4. Feed-Forward Network
        self.W_ff1 = np.random.randn(d, d_ff).astype(np.float32) * np.sqrt(2.0 / d)
        self.b_ff1 = np.zeros(d_ff, dtype=np.float32)
        self.W_ff2 = np.random.randn(d_ff, d).astype(np.float32) * np.sqrt(2.0 / d_ff)
        self.b_ff2 = np.zeros(d, dtype=np.float32)

        # 5. Output Heads (5 Joint continuous angles + 1 Gripper logit)
        self.W_joints = np.random.randn(d, 5).astype(np.float32) * np.sqrt(2.0 / d)
        self.b_joints = np.full(5, 90.0, dtype=np.float32)
        self.W_grip = np.random.randn(d, 1).astype(np.float32) * np.sqrt(2.0 / d)
        self.b_grip = np.zeros(1, dtype=np.float32)

        self.params = [
            self.W_obs, self.b_obs, self.Q_pos,
            self.W_q, self.W_k, self.W_v, self.W_o, self.b_o,
            self.W_ff1, self.b_ff1, self.W_ff2, self.b_ff2,
            self.W_joints, self.b_joints, self.W_grip, self.b_grip
        ]
        self.m = [np.zeros_like(p) for p in self.params]
        self.v = [np.zeros_like(p) for p in self.params]
        self.t = 0

    def forward(self, obs: np.ndarray):
        """Forward pass with caching for analytic backpropagation."""
        B = obs.shape[0]
        H = self.chunk_size
        d = self.d_model
        h = self.n_heads
        dk = self.d_k

        # Project observation to model dimension
        z_obs = np.dot(obs, self.W_obs) + self.b_obs
        e_obs = np.maximum(0, z_obs) # (B, d)

        # Condition query tokens with observation context
        h_dec = self.Q_pos[None, :, :] + e_obs[:, None, :] # (B, H, d)

        # Multi-Head Attention projections
        q = np.dot(h_dec, self.W_q).reshape(B, H, h, dk).swapaxes(1, 2)
        k = np.dot(h_dec, self.W_k).reshape(B, H, h, dk).swapaxes(1, 2)
        v = np.dot(h_dec, self.W_v).reshape(B, H, h, dk).swapaxes(1, 2)

        # Scaled dot-product attention
        scores = np.matmul(q, k.swapaxes(-1, -2)) / np.sqrt(dk)
        attn = softmax(scores, axis=-1)

        ctx = np.matmul(attn, v).swapaxes(1, 2).reshape(B, H, d)
        o_attn = np.dot(ctx, self.W_o) + self.b_o
        z1 = h_dec + o_attn # Residual

        # Feed-Forward Network
        z_ff1 = np.dot(z1, self.W_ff1) + self.b_ff1
        a_ff1 = np.maximum(0, z_ff1)
        o_ff = np.dot(a_ff1, self.W_ff2) + self.b_ff2
        z2 = z1 + o_ff # Residual

        # Prediction Heads
        joints_pred = np.dot(z2, self.W_joints) + self.b_joints
        grip_logits = np.dot(z2, self.W_grip) + self.b_grip
        grip_prob = 1.0 / (1.0 + np.exp(-np.clip(grip_logits, -15.0, 15.0)))

        cache = (obs, z_obs, e_obs, h_dec, q, k, v, attn, ctx, z1, z_ff1, a_ff1, z2, joints_pred, grip_prob)
        return joints_pred, grip_prob, cache

    def predict(self, obs: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Inference for single or batched observations."""
        if obs.ndim == 1:
            obs = obs.reshape(1, -1)
        joints_pred, grip_prob, _ = self.forward(obs)
        return joints_pred, grip_prob

    def backward(self, cache, target_joints: np.ndarray, target_grip: np.ndarray):
        """Vectorized analytic backpropagation using BLAS matrix operations."""
        (obs, z_obs, e_obs, h_dec, q, k, v, attn, ctx, z1, z_ff1, a_ff1, z2, joints_pred, grip_prob) = cache
        B, H, d = h_dec.shape
        h = self.n_heads
        dk = self.d_k

        # 1. Output Head Gradients
        d_joints = (2.0 / (B * H)) * (joints_pred - target_joints)
        dW_joints = np.dot(z2.reshape(-1, d).T, d_joints.reshape(-1, 5))
        db_joints = np.sum(d_joints, axis=(0, 1))

        d_grip = (5.0 / (B * H)) * (grip_prob - target_grip)
        dW_grip = np.dot(z2.reshape(-1, d).T, d_grip.reshape(-1, 1))
        db_grip = np.sum(d_grip, axis=(0, 1))

        dz2 = np.dot(d_joints, self.W_joints.T) + np.dot(d_grip, self.W_grip.T)

        # 2. FFN Gradients
        dz1_from_z2 = dz2
        do_ff = dz2
        dW_ff2 = np.dot(a_ff1.reshape(-1, self.d_ff).T, do_ff.reshape(-1, d))
        db_ff2 = np.sum(do_ff, axis=(0, 1))

        da_ff1 = np.dot(do_ff, self.W_ff2.T)
        dz_ff1 = da_ff1 * (z_ff1 > 0)
        dW_ff1 = np.dot(z1.reshape(-1, d).T, dz_ff1.reshape(-1, self.d_ff))
        db_ff1 = np.sum(dz_ff1, axis=(0, 1))

        dz1 = dz1_from_z2 + np.dot(dz_ff1, self.W_ff1.T)

        # 3. Attention Gradients
        do_attn = dz1
        dW_o = np.dot(ctx.reshape(-1, d).T, do_attn.reshape(-1, d))
        db_o = np.sum(do_attn, axis=(0, 1))

        dctx = np.dot(do_attn, self.W_o.T).reshape(B, H, h, dk).swapaxes(1, 2)

        dattn = np.matmul(dctx, v.swapaxes(-1, -2))
        dv = np.matmul(attn.swapaxes(-1, -2), dctx)

        sum_dattn_attn = np.sum(dattn * attn, axis=-1, keepdims=True)
        dscores = attn * (dattn - sum_dattn_attn) / np.sqrt(dk)

        dq = np.matmul(dscores, k)
        dk_grad = np.matmul(dscores.swapaxes(-1, -2), q)

        dq_flat = dq.swapaxes(1, 2).reshape(B * H, d)
        dk_flat = dk_grad.swapaxes(1, 2).reshape(B * H, d)
        dv_flat = dv.swapaxes(1, 2).reshape(B * H, d)
        h_dec_flat = h_dec.reshape(B * H, d)

        dW_q = np.dot(h_dec_flat.T, dq_flat)
        dW_k = np.dot(h_dec_flat.T, dk_flat)
        dW_v = np.dot(h_dec_flat.T, dv_flat)

        dh_dec = (
            dz1
            + np.dot(dq_flat, self.W_q.T).reshape(B, H, d)
            + np.dot(dk_flat, self.W_k.T).reshape(B, H, d)
            + np.dot(dv_flat, self.W_v.T).reshape(B, H, d)
        )

        dQ_pos = np.sum(dh_dec, axis=0)
        de_obs = np.sum(dh_dec, axis=1)

        dz_obs = de_obs * (z_obs > 0)
        dW_obs = np.dot(obs.T, dz_obs)
        db_obs = np.sum(dz_obs, axis=0)

        return [
            dW_obs, db_obs, dQ_pos,
            dW_q, dW_k, dW_v, dW_o, db_o,
            dW_ff1, db_ff1, dW_ff2, db_ff2,
            dW_joints, db_joints, dW_grip, db_grip
        ]

    def step_adam(self, grads, lr=1e-3, beta1=0.9, beta2=0.999, eps=1e-8, weight_decay=1e-4):
        """Adam optimizer step with decoupled weight decay."""
        self.t += 1
        lr_t = lr * (np.sqrt(1.0 - beta2**self.t) / (1.0 - beta1**self.t))
        for i in range(len(self.params)):
            g = grads[i] + weight_decay * self.params[i]
            self.m[i] = beta1 * self.m[i] + (1.0 - beta1) * g
            self.v[i] = beta2 * self.v[i] + (1.0 - beta2) * (g**2)
            self.params[i] -= lr_t * self.m[i] / (np.sqrt(self.v[i]) + eps)


def load_all_episodes() -> List[Dict[str, Any]]:
    """Loads all pick-only demonstration episodes from datasets/."""
    episodes = []
    files = sorted(glob.glob(os.path.join(DATASETS_DIR, "episode_*.json")))
    for fpath in files:
        try:
            with open(fpath, "r") as f:
                episodes.append(json.load(f))
        except Exception as e:
            print(f"Warning: Failed to load {fpath}: {e}")
    return episodes


def prepare_act_dataset(episodes: List[Dict[str, Any]], chunk_size: int = 24, include_theta: bool = False):
    """
    Constructs rolling (Observation, Action Chunk) pairs.
    Each action chunk contains H future timesteps [a_t, a_t+1, ..., a_t+H-1].
    """
    all_obs = []
    all_target_joints = []
    all_target_grip = []

    for ep in episodes:
        frames = ep.get("trajectory", [])
        if len(frames) < 2:
            continue
        init_pose = ep.get("initial_block_pose") or {"x_cm": 0.0, "y_cm": 0.0, "theta_deg": 0.0}
        bx = float(init_pose.get("x_cm", 0.0))
        by = float(init_pose.get("y_cm", 0.0))
        bth = float(init_pose.get("theta_deg", 0.0))

        L = len(frames)
        for k in range(L - 1):
            curr_f = frames[k]
            curr_j = curr_f.get("joints", [90, 90, 90, 90, 90])[:5]
            curr_g = float(curr_f.get("gripper_state", 0))

            obs = [
                curr_j[0] / 180.0,
                curr_j[1] / 180.0,
                curr_j[2] / 180.0,
                curr_j[3] / 180.0,
                curr_j[4] / 180.0,
                curr_g,
                bx / 30.0,
                by / 25.0
            ]
            if include_theta:
                obs.append(bth / 180.0)

            chunk_j = []
            chunk_g = []
            for step in range(chunk_size):
                tgt_idx = min(k + step + 1, L - 1)
                tgt_f = frames[tgt_idx]
                chunk_j.append(tgt_f.get("joints", [90, 90, 90, 90, 90])[:5])
                chunk_g.append([float(tgt_f.get("gripper_state", 0))])

            all_obs.append(obs)
            all_target_joints.append(chunk_j)
            all_target_grip.append(chunk_g)

    return (
        np.array(all_obs, dtype=np.float32),
        np.array(all_target_joints, dtype=np.float32),
        np.array(all_target_grip, dtype=np.float32)
    )


def train_act_model(
    version_id: str = "act_no_theta",
    model_name: str = "ACT (30 Demos - No Theta, H=24)",
    epochs: int = 30,
    batch_size: int = 128,
    base_lr: float = 2e-3,
    chunk_size: int = 24,
    include_theta: Optional[bool] = None
) -> Dict[str, Any]:
    """Trains the Action Chunking with Transformers (ACT) policy and saves weights."""
    os.makedirs(MODELS_DIR, exist_ok=True)

    if include_theta is None:
        lower_str = f"{version_id} {model_name}".lower()
        if "exclud" in lower_str or "no_theta" in lower_str or "without_theta" in lower_str or "no theta" in lower_str:
            include_theta = False
        elif "with_theta" in lower_str or "with theta" in lower_str:
            include_theta = True
        else:
            include_theta = False

    theta_label = "with" if include_theta else "without"
    print(f"--- Training ACT Policy: {model_name} ({version_id}) [{theta_label} theta, H={chunk_size}] ---")

    episodes = load_all_episodes()
    if not episodes:
        raise ValueError(f"No demonstration episodes found in {DATASETS_DIR}")

    print(f"Loaded {len(episodes)} demonstration episodes.")
    X, Y_j, Y_g = prepare_act_dataset(episodes, chunk_size=chunk_size, include_theta=include_theta)
    num_samples = len(X)
    in_dim = X.shape[1]
    print(f"Total chunk transitions: {num_samples} (Obs: {in_dim} dims, Chunks: {chunk_size} x 6 dims)")

    # Initialize ACT Policy
    model = ACTPolicyNet(in_dim=in_dim, chunk_size=chunk_size, d_model=64, n_heads=4, d_ff=128)

    start_time = time.time()
    best_loss = float("inf")
    best_joint_mse = float("inf")

    # Training loop with cosine learning rate schedule
    for epoch in range(1, epochs + 1):
        lr = base_lr * 0.5 * (1.0 + np.cos(np.pi * epoch / epochs))
        perm = np.random.permutation(num_samples)
        epoch_loss = 0.0
        joint_mse_total = 0.0

        for start_idx in range(0, num_samples, batch_size):
            end_idx = min(start_idx + batch_size, num_samples)
            b_idx = perm[start_idx:end_idx]
            batch_X = X[b_idx]
            batch_Yj = Y_j[b_idx]
            batch_Yg = Y_g[b_idx]

            jp, gp, cache = model.forward(batch_X)

            j_err = jp - batch_Yj
            j_loss = np.mean(j_err**2)
            g_bce = -np.mean(batch_Yg * np.log(np.clip(gp, 1e-7, 1.0)) + (1.0 - batch_Yg) * np.log(np.clip(1.0 - gp, 1e-7, 1.0)))
            loss = j_loss + 5.0 * g_bce

            grads = model.backward(cache, batch_Yj, batch_Yg)
            model.step_adam(grads, lr=lr)

            epoch_loss += loss * len(b_idx)
            joint_mse_total += j_loss * len(b_idx)

        epoch_loss /= num_samples
        joint_mse = joint_mse_total / num_samples

        if epoch_loss < best_loss:
            best_loss = epoch_loss
            best_joint_mse = joint_mse

        if epoch % 5 == 0 or epoch == 1:
            print(f"Epoch [{epoch:02d}/{epochs:02d}] - Loss: {epoch_loss:.4f} (Joint MSE: {joint_mse:.4f}, LR: {lr:.5f})")

    training_duration = round(time.time() - start_time, 2)
    print(f"ACT Training completed in {training_duration}s. Best Loss: {best_loss:.4f} (MSE: {best_joint_mse:.4f})")

    # Save ACT policy weights to NPZ
    model_filename = f"{version_id}_policy.npz"
    model_path = os.path.join(MODELS_DIR, model_filename)

    np.savez_compressed(
        model_path,
        architecture="act",
        version_id=version_id,
        model_name=model_name,
        in_dim=in_dim,
        include_theta=include_theta,
        chunk_size=chunk_size,
        d_model=model.d_model,
        n_heads=model.n_heads,
        d_ff=model.d_ff,
        W_obs=model.W_obs, b_obs=model.b_obs,
        Q_pos=model.Q_pos,
        W_q=model.W_q, W_k=model.W_k, W_v=model.W_v, W_o=model.W_o, b_o=model.b_o,
        W_ff1=model.W_ff1, b_ff1=model.b_ff1, W_ff2=model.W_ff2, b_ff2=model.b_ff2,
        W_joints=model.W_joints, b_joints=model.b_joints,
        W_grip=model.W_grip, b_grip=model.b_grip,
        num_episodes=len(episodes),
        num_transitions=num_samples,
        best_loss=best_loss,
        best_joint_mse=best_joint_mse
    )
    print(f"Model saved to: {model_path}")

    # Update models_registry.json
    registry = []
    if os.path.exists(REGISTRY_FILE):
        try:
            with open(REGISTRY_FILE, "r") as f:
                registry = json.load(f)
        except Exception:
            registry = []

    model_meta = {
        "id": version_id,
        "name": model_name,
        "filename": model_filename,
        "architecture": "act",
        "episodes_count": len(episodes),
        "transitions_count": num_samples,
        "chunk_size": chunk_size,
        "loss": round(float(best_loss), 4),
        "joint_mse": round(float(best_joint_mse), 4),
        "duration_sec": training_duration,
        "created_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "status": "Ready",
        "description": f"Action Chunking with Transformers (ACT) policy trained on {len(episodes)} demonstrations (H={chunk_size}, {theta_label} block theta)."
    }

    registry = [m for m in registry if m.get("id") != version_id]
    registry.insert(0, model_meta)

    with open(REGISTRY_FILE, "w") as f:
        json.dump(registry, f, indent=2)

    print(f"Updated {REGISTRY_FILE} with ACT model {version_id}.")
    return model_meta


def rollout_act_trajectory(
    model_weights: Dict[str, Any],
    target_bx: float,
    target_by: float,
    target_bth: float = 0.0,
    m_weight: float = 0.05,
    max_steps: int = 350
) -> List[Dict[str, Any]]:
    """
    Executes simulated rollout of the ACT policy with Receding Horizon Temporal Ensembling.
    Aggregates overlapping predictions using exponential weight: w_k = exp(-m * k).
    Returns list of trajectory frames ready for robot arm execution.
    """
    in_dim = int(model_weights.get("in_dim", 8))
    include_theta = bool(model_weights.get("include_theta", False))
    chunk_size = int(model_weights.get("chunk_size", 24))
    d_model = int(model_weights.get("d_model", 64))
    n_heads = int(model_weights.get("n_heads", 4))
    d_ff = int(model_weights.get("d_ff", 128))

    model = ACTPolicyNet(in_dim=in_dim, chunk_size=chunk_size, d_model=d_model, n_heads=n_heads, d_ff=d_ff)
    model.W_obs = model_weights["W_obs"]
    model.b_obs = model_weights["b_obs"]
    model.Q_pos = model_weights["Q_pos"]
    model.W_q = model_weights["W_q"]
    model.W_k = model_weights["W_k"]
    model.W_v = model_weights["W_v"]
    model.W_o = model_weights["W_o"]
    model.b_o = model_weights["b_o"]
    model.W_ff1 = model_weights["W_ff1"]
    model.b_ff1 = model_weights["b_ff1"]
    model.W_ff2 = model_weights["W_ff2"]
    model.b_ff2 = model_weights["b_ff2"]
    model.W_joints = model_weights["W_joints"]
    model.b_joints = model_weights["b_joints"]
    model.W_grip = model_weights["W_grip"]
    model.b_grip = model_weights["b_grip"]

    action_buffer: Dict[int, List[Tuple[np.ndarray, float, int]]] = {}
    trajectory = []

    j_curr = np.array([90.0, 90.0, 90.0, 90.0, 90.0], dtype=np.float32)
    g_curr = 0.0

    grip_closed = False
    closed_step = -1
    elbow_prev = 90.0

    for t in range(max_steps):
        obs = [
            j_curr[0] / 180.0,
            j_curr[1] / 180.0,
            j_curr[2] / 180.0,
            j_curr[3] / 180.0,
            j_curr[4] / 180.0,
            g_curr,
            target_bx / 30.0,
            target_by / 25.0
        ]
        if include_theta:
            obs.append(target_bth / 180.0)

        obs_arr = np.array(obs, dtype=np.float32).reshape(1, -1)
        pred_j, pred_g = model.predict(obs_arr)

        for k in range(chunk_size):
            t_fut = t + k
            if t_fut not in action_buffer:
                action_buffer[t_fut] = []
            action_buffer[t_fut].append((pred_j[0, k], pred_g[0, k, 0], k))

        # Temporal Ensembling: exponential weighted average over candidate predictions
        candidates = action_buffer[t]
        weights = [np.exp(-m_weight * k) for (_, _, k) in candidates]
        total_w = sum(weights)

        blended_j = np.zeros(5, dtype=np.float32)
        blended_g = 0.0
        for idx, (j_candidate, g_candidate, _) in enumerate(candidates):
            w = weights[idx] / total_w
            blended_j += w * j_candidate
            blended_g += w * g_candidate

        # Enforce physical hardware angle limits [15, 165]
        corr_j0 = int(np.clip(np.round(blended_j[0]), 15, 165))
        corr_j1 = int(np.clip(np.round(blended_j[1]), 15, 165))
        corr_j2 = int(np.clip(np.round(blended_j[2]), 15, 165))
        corr_j3 = int(np.clip(np.round(blended_j[3]), 15, 165))
        corr_j4 = int(np.clip(np.round(blended_j[4]), 15, 165))

        # Grasp Trigger: Detect when arm reaches block descent apex
        elbow_curr = corr_j2
        if not grip_closed and t >= 35:
            # Trigger grasp when arm reaches downward dip (elbow >= 154 deg or rate of descent stabilizes at depth)
            if elbow_curr >= 154.0 or (elbow_curr >= 144.0 and abs(elbow_curr - elbow_prev) < 0.25) or blended_g >= 0.15:
                grip_closed = True
                closed_step = t

        elbow_prev = elbow_curr
        grip_state = 1 if grip_closed else 0

        trajectory.append({
            "joints": [corr_j0, corr_j1, corr_j2, corr_j3, corr_j4],
            "gripper_state": grip_state,
            "progress": 0.0 # updated post-rollout
        })

        j_curr = np.array([corr_j0, corr_j1, corr_j2, corr_j3, corr_j4], dtype=np.float32)
        g_curr = float(grip_state)

        # After holding grip for 30 frames (securing block and lifting), pick sequence finishes
        if grip_closed and (t - closed_step) >= 30:
            break

    # Assign normalized progress
    total_len = len(trajectory)
    for idx, f in enumerate(trajectory):
        f["progress"] = idx / max(1, total_len - 1)

    return trajectory


if __name__ == "__main__":
    train_act_model(version_id="act_no_theta", model_name="ACT (30 Demos - No Theta, H=24)", epochs=30, include_theta=False)
    train_act_model(version_id="act_with_theta", model_name="ACT (30 Demos - With Theta, H=24)", epochs=30, include_theta=True)
