#!/bin/bash

# Script to set up virtual environment for n8n desktop wrapper

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PATH="$SCRIPT_DIR/.venv"
ERROR_HANDLER="$SCRIPT_DIR/error_handler.py"

# Function to print error messages
print_error() {
    echo "Error: $1" >&2
    exit 1
}

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    print_error "Python 3 is required but not installed\nPlease install Python 3 and try again"
fi

# Create virtual environment if it doesn't exist
if [ ! -d "$VENV_PATH" ]; then
    echo "Creating virtual environment in $VENV_PATH..."
    if ! python3 -m venv "$VENV_PATH"; then
        print_error "Failed to create virtual environment"
    fi
    echo "Virtual environment created successfully"
else
    echo "Virtual environment already exists at $VENV_PATH"
fi

# Activate virtual environment
source "$VENV_PATH/bin/activate"

# Install Python dependencies for node-gyp
echo "Installing Python dependencies in virtual environment..."
if ! pip install --upgrade pip; then
    print_error "Failed to upgrade pip"
fi

if ! pip install setuptools wheel; then
    print_error "Failed to install setuptools and wheel"
fi

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
if ! npm install -g node-gyp@9.4.0; then
    print_error "Failed to install node-gyp"
fi

# Run error handler check
if ! "$VENV_PATH/bin/python" "$ERROR_HANDLER"; then
    print_error "Virtual environment validation failed"
fi

echo "✓ Virtual environment setup complete"
echo "To activate manually: source $VENV_PATH/bin/activate"
echo "To use with npm commands: use the npm scripts in package.json" 