# n8n Desktop Wrapper

An Electron wrapper application for running n8n locally as a desktop application.

## Prerequisites

- Node.js (v16+ recommended, see `package.json` `engines` for specific required version)
- npm (v10+ recommended, see `package.json` `engines` for specific required version)
- Python 3.x (Required for building native Node.js modules like `keytar`)
- **Docker Desktop** (or Docker Engine on Linux). n8n itself runs inside a Docker container managed by this application.

## Initial Setup

1.  **Install Docker:** If you don't have it, download and install Docker Desktop (Mac/Windows) or Docker Engine (Linux) and ensure it's running.
2.  **Clone this repository:**
    ```bash
    git clone <repository-url>
    cd n8n-desktop-wrapper
    ```
3.  **Set up the Python virtual environment:** This is needed for building Electron app dependencies, not for n8n itself.
    ```bash
    # Run the setup script to create and configure the virtual environment
    ./setup-venv.sh
    ```
    This script will:
    *   Create a `.venv` folder with a Python virtual environment.
    *   Install required Python packages for building native modules.
    *   Set up the environment for use with npm commands.
4.  **Install Node.js dependencies:**
    ```bash
    # Installs Electron, keytar, etc.
    npm run install-deps 
    ```

## Development

Ensure Docker Desktop (or engine) is running before starting the application.

All npm commands are configured to automatically activate the Python virtual environment before execution:

```bash
# Start the application in development mode
# This will also start the n8n Docker container
npm run start

# Build the application for distribution
npm run build

# Rebuild native dependencies if needed (for keytar, etc.)
npm run rebuild-deps
```

## How It Works

This project uses:
*   **Electron:** To provide the main application window and UI shell.
*   **Docker:** To run the core n8n service in an isolated container. The `main.js` process controls this container (starts, stops, checks status).
*   **Python Virtual Environment (`.venv`):** Managed by `setup-venv.sh` and `run-with-venv.sh`, specifically for building native Node.js modules required by the Electron part of the app (like `keytar`). It is *not* used by the n8n Docker container itself.
*   **Volume Mounting:** The user's n8n configuration and database are stored on the host machine (in the standard Electron user data path, inside an `n8n-config` subfolder) and mounted into the Docker container at `/home/node/.n8n`. This ensures data persistence.

## Building for Distribution

```bash
# Ensure Docker is running (build process might not need it, but good practice)
npm run build
```

The built application will be in the `dist` folder. Note that the end-user will still need Docker installed and running to use the packaged application.

## Troubleshooting

*   **"Docker is not running" error on startup:** Make sure Docker Desktop (or engine) is running before launching the application.
*   **Native dependency issues (`keytar` build errors):**
    1.  Ensure the Python virtual environment is set up correctly (`./setup-venv.sh`).
    2.  If you get errors about missing Python modules during `npm run install-deps` or `npm run rebuild-deps`, try reactivating and reinstalling:
        ```bash
        source .venv/bin/activate
        pip install --upgrade pip setuptools wheel
        deactivate # Exit venv
        # Then try npm run rebuild-deps again
        ```
    3.  For persistent issues, try cleaning and rebuilding native deps:
        ```bash
        rm -rf node_modules
        npm run install-deps
        npm run rebuild-deps
        ```
*   **n8n container fails to start:** Check the application logs (accessible via Help menu or in the user data directory) and potentially Docker logs (`docker logs n8n-desktop-instance`) for errors. 