#!/usr/bin/env python3
"""
Error handler module for n8n desktop wrapper.
Ensures proper virtual environment usage and provides consistent error handling.
"""

import os
import sys
import subprocess
from typing import Optional, Tuple, Any
from pathlib import Path

class VenvError(Exception):
    """Base exception for virtual environment related errors."""
    pass

class VenvNotFoundError(VenvError):
    """Raised when virtual environment is not found."""
    pass

class VenvActivationError(VenvError):
    """Raised when virtual environment activation fails."""
    pass

class CommandExecutionError(Exception):
    """Raised when a command execution fails."""
    pass

def get_venv_path() -> Path:
    """Get the path to the virtual environment."""
    # Get the directory containing this script
    script_dir = Path(__file__).parent
    venv_path = script_dir / '.venv'
    
    if not venv_path.exists():
        raise VenvNotFoundError(
            f"Virtual environment not found at {venv_path}\n"
            "Please run setup-venv.sh first to create the virtual environment."
        )
    
    return venv_path

def ensure_venv_activated() -> None:
    """Ensure the virtual environment is activated."""
    venv_path = get_venv_path()
    
    # Check if we're already in the virtual environment
    if not hasattr(sys, 'real_prefix') and not hasattr(sys, 'base_prefix'):
        raise VenvActivationError(
            "Virtual environment is not activated.\n"
            "Please run commands through run-with-venv.sh or activate the environment manually:\n"
            f"source {venv_path}/bin/activate"
        )

def run_command(
    command: str,
    check: bool = True,
    capture_output: bool = False,
    text: bool = True,
    **kwargs: Any
) -> subprocess.CompletedProcess:
    """
    Run a command in the virtual environment.
    
    Args:
        command: The command to run
        check: Whether to raise an exception if the command fails
        capture_output: Whether to capture stdout and stderr
        text: Whether to return strings instead of bytes
        **kwargs: Additional arguments to pass to subprocess.run
    
    Returns:
        subprocess.CompletedProcess: The result of running the command
    
    Raises:
        CommandExecutionError: If the command fails and check=True
    """
    ensure_venv_activated()
    
    try:
        result = subprocess.run(
            command,
            shell=True,
            check=check,
            capture_output=capture_output,
            text=text,
            **kwargs
        )
        return result
    except subprocess.CalledProcessError as e:
        raise CommandExecutionError(
            f"Command failed with exit code {e.returncode}:\n"
            f"Command: {command}\n"
            f"Output: {e.output if capture_output else 'Not captured'}"
        )

def get_python_path() -> str:
    """Get the path to the Python executable in the virtual environment."""
    venv_path = get_venv_path()
    python_path = venv_path / 'bin' / 'python'
    
    if not python_path.exists():
        raise VenvError(f"Python executable not found at {python_path}")
    
    return str(python_path)

def check_dependencies() -> None:
    """Check if all required Python dependencies are installed."""
    required_packages = ['setuptools', 'wheel']
    
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            raise VenvError(
                f"Required package {package} is not installed.\n"
                "Please run setup-venv.sh to install dependencies."
            )

if __name__ == '__main__':
    # Example usage
    try:
        ensure_venv_activated()
        print(f"✓ Virtual environment activated: {get_python_path()}")
        check_dependencies()
        print("✓ All dependencies checked successfully")
    except VenvError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1) 