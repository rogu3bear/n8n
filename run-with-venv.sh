#!/bin/bash

# Ensure the virtual environment is activated before running any command
VENV_PATH="$(pwd)/.venv"

# Check if virtual environment exists
if [ ! -d "$VENV_PATH" ]; then
    echo "Error: Virtual environment not found at $VENV_PATH"
    echo "Please create it first with: python -m venv .venv"
    exit 1
fi

# Set Python path to use virtual environment Python
export PYTHON="$VENV_PATH/bin/python"

# Activate virtual environment
source "$VENV_PATH/bin/activate"

# Print status
echo "✓ Virtual environment activated: $(which python)"

# Execute the command passed to this script
echo "Running command: $@"
exec "$@" 