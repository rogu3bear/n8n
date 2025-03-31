#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
    exit 1
}

print_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Load nvm
if [ -s "$HOME/.nvm/nvm.sh" ]; then
    . "$HOME/.nvm/nvm.sh"
else
    print_error "NVM not found. Please install NVM first."
fi

# Set Node version
nvm use 18.18.0 || print_error "Node 18.18.0 failed"

# Verify Node version
if [ "$(node -v)" != "v18.18.0" ]; then
    print_error "Wrong Node: $(node -v)"
fi

print_status "Node version verified: $(node -v)"

# Build the application
print_status "Building application..."
cd install || print_error "Failed to enter install directory"
npm run make || print_error "Build failed"

# Test the application
cd .. || print_error "Failed to return to root directory"

# Launch in test mode
print_status "Launching application in test mode..."
./install/out/n8n-electron-wrapper-darwin-arm64/n8n-electron-wrapper.app/Contents/MacOS/n8n-electron-wrapper --test-mode || print_error "Test mode failed"

# Launch in normal mode
print_status "Launching application in normal mode..."
./install/out/n8n-electron-wrapper-darwin-arm64/n8n-electron-wrapper.app/Contents/MacOS/n8n-electron-wrapper & PID=$!

# Wait for the process to start
sleep 5

# Check if process is still running
if ps -p $PID > /dev/null; then
    print_status "Application launched successfully"
    kill $PID
else
    print_error "Application failed to start"
fi

# Workflow test with isolation
print_status "Testing workflow execution..."
./install/out/n8n-electron-wrapper-darwin-arm64/n8n-electron-wrapper.app/Contents/MacOS/n8n-electron-wrapper --test-mode || {
    print_error "Workflow test: FAILED"
    exit 1
}
print_status "Workflow test: PASSED"

# Performance test with isolation
print_status "Running performance test..."
time ./install/out/n8n-electron-wrapper-darwin-arm64/n8n-electron-wrapper.app/Contents/MacOS/n8n-electron-wrapper --perf-test || {
    print_error "Performance test: FAILED"
    exit 1
}
print_status "Performance test: PASSED"

# Check for errors in logs with isolation
print_status "Checking logs for errors..."
if grep -r "ERROR" ~/.n8n/logs/*.log > /dev/null; then
    print_error "Errors found in logs"
    exit 1
fi
print_status "No errors found in logs"

# Run existing tests in isolated environment
print_status "Running existing tests..."
cd install || {
    print_error "Failed to enter install directory"
    exit 1
}

npm run test:all || {
    print_error "Tests failed"
    exit 1
}
print_status "All tests passed"

print_status "All tests completed successfully!" 