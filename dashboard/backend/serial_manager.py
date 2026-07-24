"""
==============================================================================
SERIAL MANAGER — Arduino Communication Subsystem
==============================================================================

Project:  Vision-Based Autonomous Robotic Arm
File:     serial_manager.py
Location: dashboard/backend/

PURPOSE:
    Manages the low-level USB Serial connection between the Python backend
    (FastAPI / host machine) and the Arduino Uno firmware (robot_driver.ino).

KEY FEATURES:
    - Auto-detects connected Arduino Uno serial ports
    - Transmits binary 6-byte command packets at 115200 baud (Decision #6)
    - Enforces 0–180 degree clamping per servo
    - Provides instant "Lock at 90°", "Home", and "Emergency Stop" routines
    - Thread-safe state tracking for low-latency WebSocket broadcasting

RELATED DECISIONS (from decisions.md):
    - Decision #5: Safety System (Emergency Stop + Watchdog)
    - Decision #6: Serial Protocol (Binary 6-byte packets at 115200 baud)
    - Decision #14: Arduino Port Management (`arduino-cli` / port scan)
    - Decision #19: Dashboard Phase A as Hardware Assembly Tool
==============================================================================
"""

import time
import threading
import logging
from typing import List, Dict, Optional, Tuple
import serial
import serial.tools.list_ports

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SerialManager")

NUM_SERVOS = 6
DEFAULT_BAUD = 115200
DEFAULT_HOME_ANGLES = [90, 90, 90, 90, 90, 10]


class SerialManager:
    def __init__(self):
        self._serial: Optional[serial.Serial] = None
        self.port: Optional[str] = None
        self.baudrate: int = DEFAULT_BAUD
        self.is_connected: bool = False
        self.is_estop: bool = False
        
        # Track current commanded angles [Base, Shoulder, Elbow, WristPitch, WristRoll, Gripper]
        self.current_angles: List[int] = list(DEFAULT_HOME_ANGLES)
        
        # Thread lock for serial writing
        self._lock = threading.Lock()

    def list_available_ports(self) -> List[Dict[str, str]]:
        """Scans for available serial ports on macOS/Linux/Windows."""
        ports = serial.tools.list_ports.comports()
        result = []
        for p in ports:
            result.append({
                "port": p.device,
                "description": p.description,
                "hwid": p.hwid,
                "is_arduino": "arduino" in p.description.lower() or "usbmodem" in p.device.lower() or "ttyACM" in p.device.lower()
            })
        return result

    def auto_connect(self) -> Tuple[bool, str]:
        """Attempts to auto-detect and connect to the Arduino Uno."""
        ports = self.list_available_ports()
        if not ports:
            return False, "No serial ports found."

        # Prioritize ports identified as Arduino / USB Modem
        target_port = None
        for p in ports:
            if p["is_arduino"]:
                target_port = p["port"]
                break
        
        if not target_port and ports:
            target_port = ports[0]["port"]

        return self.connect(target_port)

    def connect(self, port: str, baudrate: int = DEFAULT_BAUD) -> Tuple[bool, str]:
        """Establishes connection to specified serial port."""
        with self._lock:
            if self.is_connected:
                self._disconnect_internal()

            try:
                logger.info(f"Connecting to Arduino on {port} @ {baudrate} baud...")
                self._serial = serial.Serial(
                    port=port,
                    baudrate=baudrate,
                    timeout=0.1,
                    write_timeout=0.1
                )
                time.sleep(1.5)  # Wait for Arduino reset after DTR toggle
                
                self.port = port
                self.baudrate = baudrate
                self.is_connected = True
                self.is_estop = False
                logger.info(f"Successfully connected to Arduino on {port}")
                
                # Send home angles on initial connection
                self._send_bytes_internal(self.current_angles)
                return True, f"Connected to {port}"
                
            except Exception as e:
                self.is_connected = False
                self.port = None
                logger.error(f"Failed to connect to {port}: {e}")
                return False, str(e)

    def disconnect(self) -> Tuple[bool, str]:
        """Safely closes the serial connection."""
        with self._lock:
            return self._disconnect_internal()

    def _disconnect_internal(self) -> Tuple[bool, str]:
        if self._serial and self._serial.is_open:
            try:
                self._serial.close()
            except Exception as e:
                logger.warning(f"Error closing port: {e}")
        self.is_connected = False
        self.port = None
        return True, "Disconnected"

    def send_angles(self, angles: List[int]) -> Tuple[bool, str]:
        """
        Sends 6 servo angles (0–180) to Arduino as a binary 6-byte packet.
        Format: [Base, Shoulder, Elbow, WristPitch, WristRoll, Gripper]
        """
        if self.is_estop:
            return False, "Emergency Stop is ACTIVE. Reset E-Stop first."
            
        if len(angles) != NUM_SERVOS:
            return False, f"Expected exactly {NUM_SERVOS} angles, got {len(angles)}"

        # Clamp all angles to safe 0–180 range
        clamped_angles = [max(0, min(180, int(a))) for a in angles]

        with self._lock:
            self.current_angles = clamped_angles
            if not self.is_connected or not self._serial or not self._serial.is_open:
                # Return success for simulation/UI testing even if offline
                return True, "Angles updated (Offline mode)"

            return self._send_bytes_internal(clamped_angles)

    def _send_bytes_internal(self, angles: List[int]) -> Tuple[bool, str]:
        """Internal helper to write raw 6-byte packet over serial."""
        try:
            packet = bytes(angles)
            self._serial.write(packet)
            self._serial.flush()
            return True, "Packet sent"
        except Exception as e:
            logger.error(f"Serial write error: {e}")
            self.is_connected = False
            return False, f"Write error: {e}"

    def lock_all_90(self) -> Tuple[bool, str]:
        """Locks all 6 servos to exactly 90 degrees for mechanical assembly."""
        self.is_estop = False
        angles = [90, 90, 90, 90, 90, 90]
        return self.send_angles(angles)

    def move_to_home(self) -> Tuple[bool, str]:
        """Moves all servos to predefined Home Position angles."""
        self.is_estop = False
        return self.send_angles(DEFAULT_HOME_ANGLES)

    def emergency_stop(self) -> Tuple[bool, str]:
        """
        Triggers instant software Emergency Stop.
        Flags E-Stop state and attempts to send Home angles.
        """
        self.is_estop = True
        logger.warning("EMERGENCY STOP TRIGGERED!")
        
        with self._lock:
            if self.is_connected and self._serial and self._serial.is_open:
                try:
                    # Attempt sending home angles immediately
                    self._serial.write(bytes(DEFAULT_HOME_ANGLES))
                    self._serial.flush()
                except Exception as e:
                    logger.error(f"E-Stop write error: {e}")
                    
        return True, "EMERGENCY STOP ACTIVATED"

    def reset_estop(self) -> Tuple[bool, str]:
        """Clears Emergency Stop state."""
        self.is_estop = False
        logger.info("Emergency stop reset.")
        return True, "E-Stop reset"

    def get_status(self) -> Dict:
        """Returns complete serial connection & servo state for WebSocket broadcast."""
        return {
            "is_connected": self.is_connected,
            "port": self.port,
            "baudrate": self.baudrate,
            "is_estop": self.is_estop,
            "angles": self.current_angles
        }


# Global singleton instance for the backend
serial_manager = SerialManager()
