"""
==============================================================================
DASHBOARD FASTAPI BACKEND SERVER
==============================================================================

Project:  Vision-Based Autonomous Robotic Arm
File:     main.py
Location: dashboard/backend/

PURPOSE:
    Asynchronous web server providing REST endpoints and WebSocket real-time
    communication for the Dashboard UI. Serves the static Warm Cream HTML/CSS/JS
    frontend and interfaces directly with serial_manager.py.

KEY ENDPOINTS:
    - GET  /api/ports             Lists available serial ports
    - POST /api/connect           Connects to a specific serial port
    - POST /api/disconnect        Disconnects from Arduino
    - POST /api/lock90            Locks all 6 servos at 90° for assembly
    - POST /api/home              Moves all servos to Home Position
    - POST /api/estop             Triggers Emergency Stop
    - POST /api/estop/reset       Resets Emergency Stop state
    - WS   /ws                    Real-time WebSocket for telemetry & slider streaming

RELATED DECISIONS:
    - Decision #11: Web-based Dashboard (FastAPI + WebSockets)
    - Decision #15: No authentication required
    - Decision #18: Warm light cream theme support
    - Decision #19: Active physical assembly tool
==============================================================================
"""

import os
import json
import asyncio
import logging
from typing import List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from serial_manager import serial_manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("DashboardBackend")

app = FastAPI(
    title="Robotic Arm Control Dashboard Backend",
    version="1.0.0"
)

# Allow CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Track active WebSocket connections
active_connections: List[WebSocket] = []


# Request Models
class ConnectRequest(BaseModel):
    port: str
    baudrate: int = 115200


class ServoAnglesRequest(BaseModel):
    angles: List[int]


# REST API Endpoints

@app.get("/api/status")
async def get_status():
    """Returns current system status."""
    return serial_manager.get_status()


@app.get("/api/ports")
async def list_ports():
    """Lists available serial ports."""
    return {"ports": serial_manager.list_available_ports()}


@app.post("/api/connect")
async def connect_port(req: ConnectRequest):
    """Connects to specified serial port."""
    success, msg = serial_manager.connect(req.port, req.baudrate)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    await broadcast_status()
    return {"status": "connected", "message": msg}


@app.post("/api/auto-connect")
async def auto_connect_port():
    """Auto-detects and connects to Arduino."""
    success, msg = serial_manager.auto_connect()
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    await broadcast_status()
    return {"status": "connected", "message": msg}


@app.post("/api/disconnect")
async def disconnect_port():
    """Disconnects serial connection."""
    success, msg = serial_manager.disconnect()
    await broadcast_status()
    return {"status": "disconnected", "message": msg}


@app.post("/api/servos")
async def set_servo_angles(req: ServoAnglesRequest):
    """Sets 6 servo angles (0–180)."""
    success, msg = serial_manager.send_angles(req.angles)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    await broadcast_status()
    return {"status": "success", "angles": serial_manager.current_angles}


@app.post("/api/lock90")
async def lock_all_90():
    """Locks all servos at 90° for assembly (Decision #19)."""
    asyncio.create_task(serial_manager.lock_all_90(broadcast_callback=broadcast_status))
    return {"status": "success", "message": "Locking all servos at 90°"}


@app.post("/api/home")
async def move_home():
    """Moves all servos to Home Position."""
    asyncio.create_task(serial_manager.move_to_home(broadcast_callback=broadcast_status))
    return {"status": "success", "message": "Moving to Home Position"}


@app.post("/api/sweep")
async def run_joint_sweep():
    """Executes joint sweep test across all 6 servos to verify mechanical assembly."""
    asyncio.create_task(serial_manager.run_joint_sweep_test(broadcast_callback=broadcast_status))
    return {"status": "success", "message": "Joint sweep test started"}


@app.post("/api/estop")
async def emergency_stop():
    """Triggers Emergency Stop."""
    success, msg = serial_manager.emergency_stop()
    await broadcast_status()
    return {"status": "estop_active", "message": msg}


@app.post("/api/estop/reset")
async def reset_estop():
    """Resets Emergency Stop state."""
    success, msg = serial_manager.reset_estop()
    await broadcast_status()
    return {"status": "estop_reset", "message": msg}


# WebSocket Handler for Real-Time Telemetry & Slider Control

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    logger.info("New WebSocket client connected.")
    
    # Send initial status on connect
    await websocket.send_json({"type": "status", "data": serial_manager.get_status()})

    try:
        while True:
            data_str = await websocket.receive_text()
            try:
                data = json.loads(data_str)
                action_type = data.get("type")

                if action_type == "set_angles":
                    angles = data.get("angles", [])
                    serial_manager.send_angles(angles)
                    await broadcast_status()

                elif action_type == "lock90":
                    asyncio.create_task(serial_manager.lock_all_90(broadcast_callback=broadcast_status))

                elif action_type == "home":
                    asyncio.create_task(serial_manager.move_to_home(broadcast_callback=broadcast_status))

                elif action_type == "sweep":
                    asyncio.create_task(serial_manager.run_joint_sweep_test(broadcast_callback=broadcast_status))

                elif action_type == "estop":
                    serial_manager.emergency_stop()
                    await broadcast_status()

                elif action_type == "reset_estop":
                    serial_manager.reset_estop()
                    await broadcast_status()

            except json.JSONDecodeError:
                logger.warning("Received non-JSON WebSocket message.")

    except WebSocketDisconnect:
        active_connections.remove(websocket)
        logger.info("WebSocket client disconnected.")


async def broadcast_status():
    """Broadcasts current status to all connected WebSocket clients."""
    if not active_connections:
        return
    status_data = {"type": "status", "data": serial_manager.get_status()}
    for conn in list(active_connections):
        try:
            await conn.send_json(status_data)
        except Exception:
            if conn in active_connections:
                active_connections.remove(conn)


# Mount static frontend files
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../frontend"))
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    # Use port 8050 to avoid conflicts with macOS AirPlay Receiver (which uses port 8000)
    uvicorn.run("main:app", host="0.0.0.0", port=8050, reload=True)
