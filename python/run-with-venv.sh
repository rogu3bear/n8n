#!/bin/bash

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VENV_PATH="$SCRIPT_DIR/.venv"
ERROR_HANDLER="$SCRIPT_DIR/error_handler.py"

# Function to print error messages
print_error() {
    echo "Error: $1" >&2
    exit 1
}

# Check if running in Docker
if [ -f /.dockerenv ]; then
    # We're in Docker, use the container's Python
    PYTHON_CMD="python3"
else
    # Check if Python is available
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed. Please install Python 3 and try again."
    fi

    # Check if virtual environment exists
    if [ ! -d "$VENV_PATH" ]; then
        print_error "Virtual environment not found. Please run 'npm run setup:python' first."
    fi

    # Check if error handler exists
    if [ ! -f "$ERROR_HANDLER" ]; then
        print_error "Error handler not found at $ERROR_HANDLER"
    fi

    # Set up virtual environment path
    PYTHON_CMD="$VENV_PATH/bin/python3"
fi

# Validate the environment
if [ -f "$ERROR_HANDLER" ]; then
    echo "Validating Python environment..."
    if ! "$PYTHON_CMD" "$ERROR_HANDLER"; then
        print_error "Python environment validation failed"
    fi
fi

# Activate virtual environment if not in Docker
if [ ! -f /.dockerenv ]; then
    echo "Activating virtual environment..."
    source "$VENV_PATH/bin/activate"
fi

# Execute the command
echo "Executing command: $*"
exec "$@" 