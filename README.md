# n8n Electron Wrapper

This project provides an Electron wrapper for n8n with isolated Python and npm environments for enhanced security.

## Security Features

- **Isolated npm Environment**: All npm operations run in a dedicated Docker container to protect against malicious packages
- **Isolated Python Environment**: Python dependencies run in a virtual environment
- **Containerized n8n**: Core n8n service runs in an isolated Docker container
- **Volume Isolation**: Separate volumes for npm cache and node_modules

## Setup Options

### Option 1: Local Development (Recommended for most users)

1. Install Python 3.11 or later
2. Install Docker and Docker Compose
3. Install dependencies:
   ```bash
   npm install
   npm run setup:python
   ```
4. Start the application:
   ```bash
   npm start
   ```

### Option 2: Docker-only Development

If you prefer using Docker for all operations:

1. Install Docker and Docker Compose
2. Build the Docker containers:
   ```bash
   npm run docker:build
   ```
3. Start the application in Docker:
   ```bash
   npm run start:docker
   ```

## Development

### Local Development
- `npm start` - Start the application (uses isolated npm)
- `npm run build` - Build the application (uses isolated npm)
- `npm test` - Run tests (uses isolated npm)
- `npm run lint` - Run linter (uses isolated npm)
- `npm run format` - Format code (uses isolated npm)

### Docker Development
- `npm run docker:up` - Start Docker containers
- `npm run docker:down` - Stop Docker containers
- `npm run docker:rebuild` - Rebuild Docker containers
- `npm run start:docker` - Start application in Docker
- `npm run build:docker` - Build application in Docker

## Environment Management

### Python Environment
- `npm run setup:python` - Set up Python virtual environment
- `npm run check:python` - Check Python environment
- `npm run clean:python` - Clean Python environment
- `npm run rebuild:python` - Rebuild Python environment

### npm Environment
- `npm run docker:check` - Check if Docker is available
- `npm run docker:clean` - Clean Docker resources
- `npm run docker:rebuild` - Rebuild Docker containers

## Requirements

- Node.js >= 20.11.1
- npm >= 10.2.4
- Python >= 3.11
- Docker & Docker Compose

## Security Benefits

1. **npm Isolation**:
   - Prevents malicious npm packages from affecting your system
   - Protects against typosquatting attacks
   - Isolates npm cache and node_modules

2. **Python Isolation**:
   - Prevents Python package conflicts
   - Protects system Python installation
   - Isolates Python dependencies

3. **n8n Isolation**:
   - Runs n8n in a dedicated container
   - Protects system resources
   - Isolates n8n data and configuration

## Troubleshooting

* **Docker-related issues**:
  - Ensure Docker is running
  - Check Docker logs: `docker logs n8n-desktop-instance`
  - Try rebuilding containers: `npm run docker:rebuild`

* **npm issues**:
  - Clear npm cache: `npm run docker:clean`
  - Rebuild node_modules: `npm run rebuild-deps`
  - Check npm logs in container: `docker-compose -f python/docker-compose.yml logs npm-env`

* **Python issues**:
  - Rebuild virtual environment: `npm run rebuild:python`
  - Check Python logs: `docker-compose -f python/docker-compose.yml logs python-env`

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