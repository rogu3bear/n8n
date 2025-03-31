import os
import sys
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
VENV_PATH = os.path.join(SCRIPT_DIR, ".venv")

def activate_venv():
    """Activate the virtual environment."""
    try:
        activate_script = os.path.join(VENV_PATH, "bin", "activate_this.py")
        exec(open(activate_script).read(), {'__file__': activate_script})
    except FileNotFoundError:
        print(f"Error: Virtual environment not found at {VENV_PATH}")
        sys.exit(1)
    except Exception as e:
        print(f"Error activating virtual environment: {e}")
        sys.exit(1)

def deactivate_venv():
    """Deactivate the virtual environment."""
    try:
        os.environ.pop("VIRTUAL_ENV", None)
        venv_bin = os.path.join(VENV_PATH, "bin")
        os.environ["PATH"] = os.pathsep.join(
            [p for p in os.environ["PATH"].split(os.pathsep) if p != venv_bin]
        )
    except Exception as e:
        print(f"Error deactivating virtual environment: {e}")
        sys.exit(1)

def run_command(command):
    """Run the provided command."""
    try:
        subprocess.check_call(command, shell=True)
    except subprocess.CalledProcessError as e:
        print(f"Error executing command: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: env_handler.py [setup|run] [command]")
        sys.exit(1)

    action = sys.argv[1]
    
    if action == "setup":
        # Always run setup in the virtual environment
        activate_venv()
        run_command("./setup-venv.sh")
    elif action == "run":
        if len(sys.argv) < 3:
            print("Usage: env_handler.py run [command]")
            sys.exit(1)
        
        command = sys.argv[2]
        if command == "error_handler.py":
            # Error handler doesn't need virtual env
            deactivate_venv()
        else:
            # Other commands run in virtual env
            activate_venv()
        
        run_command(command)
    else:
        print(f"Unknown action: {action}")
        sys.exit(1) 