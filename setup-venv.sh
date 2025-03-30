#!/bin/bash

# Script to set up virtual environment for n8n desktop wrapper

VENV_PATH=".venv"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required but not installed"
    echo "Please install Python 3 and try again"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "$VENV_PATH" ]; then
    echo "Creating virtual environment in $VENV_PATH..."
    python3 -m venv "$VENV_PATH"
    if [ $? -ne 0 ]; then
        echo "Error: Failed to create virtual environment"
        exit 1
    fi
    echo "Virtual environment created successfully"
else
    echo "Virtual environment already exists at $VENV_PATH"
fi

# Activate virtual environment
source "$VENV_PATH/bin/activate"

# Install Python dependencies for node-gyp
echo "Installing Python dependencies in virtual environment..."
pip install --upgrade pip
pip install setuptools wheel

# Create a distutils.cfg file to work around missing distutils
SITE_PACKAGES=$(python -c "import site; print(site.getsitepackages()[0])")
DISTUTILS_PATH="${SITE_PACKAGES}/distutils"
mkdir -p "${DISTUTILS_PATH}"
echo "Creating distutils configuration at ${DISTUTILS_PATH}/distutils.cfg"
cat > "${DISTUTILS_PATH}/distutils.cfg" << EOL
[build]
build_base = build
[install]
prefix = /usr/local
EOL

# Create an empty __init__.py to make it a package
touch "${DISTUTILS_PATH}/__init__.py"

# Install compatible node-gyp globally
echo "Installing compatible node-gyp version globally..."
npm install -g node-gyp@9.4.0

echo "✓ Virtual environment setup complete"
echo "To activate manually: source $VENV_PATH/bin/activate"
echo "To use with npm commands: use the npm scripts in package.json" 