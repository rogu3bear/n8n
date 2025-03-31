# n8n Desktop Wrapper

A secure, dependable desktop application wrapper for n8n workflow automation platform.

## Features

- Run n8n locally as a desktop application
- Create, save, and execute workflows from JSON files
- Excel integration for data import/export
- Standalone application with no external dependencies
- Cross-platform support (macOS, Windows, Linux)
- Secure authentication and data handling

## Installation

### Prerequisites

- Node.js ≥ 18.18.0
- npm ≥ 9.0.0

### Download and Install

Download the latest release from the GitHub Releases page:

- macOS: `n8n-electron-wrapper-darwin-x64.zip` or `n8n-electron-wrapper-darwin-arm64.zip`
- Windows: `n8n-electron-wrapper-win32-x64.zip`
- Linux: `n8n-electron-wrapper-linux-x64.zip`

Extract and run the application:

- macOS: Double-click `n8n-electron-wrapper.app`
- Windows: Double-click `n8n-electron-wrapper.exe`
- Linux: Run `./n8n-electron-wrapper`

### Building from Source

```bash
# Clone the repository
git clone https://github.com/your-username/n8n-electron-wrapper.git
cd n8n-electron-wrapper

# Install dependencies
npm install

# Build the application
npm run build

# Package the application
npm run make
```

## Usage

### Running Tests

```bash
# Run all tests
npm test

# Run a specific test
npx jest src/tests/excelService.test.js
```

### Test Mode

Start the application in test mode to run a predefined test workflow:

```bash
./n8n-electron-wrapper --test-mode
```

### Custom Workflow Execution

Execute a custom workflow from a JSON file:

```bash
./n8n-electron-wrapper --workflow path/to/workflow.json
```

Example workflow JSON structure:

```json
{
  "name": "My Workflow",
  "nodes": [
    {
      "parameters": {
        "text": "Hello, World!"
      },
      "name": "Set",
      "type": "n8n-nodes-base.set",
      "typeVersion": 1,
      "position": [250, 300]
    }
  ],
  "connections": {}
}
```

### Excel Operations

The application includes a robust Excel service for:

- Creating workbooks
- Adding/managing worksheets
- Importing data from Excel files
- Exporting workflow results to Excel

## Troubleshooting

### Log Files

Check log files for errors:

```bash
cat ~/.n8n/logs/main.log
```

### Common Issues

1. **Application doesn't start**
   - Verify Node.js version with `node -v`
   - Check logs for specific errors

2. **Workflow execution fails**
   - Ensure workflow JSON is valid
   - Check log files for detailed error messages

## Development

### Project Structure

```
src/
├── features/           # Feature-based modules
│   ├── workflows/     # Workflow feature
│   ├── nodes/        # Node management feature
│   └── auth/         # Authentication feature
├── shared/           # Shared resources
│   ├── components/   # Reusable UI components
│   ├── hooks/       # Shared React hooks
│   ├── utils/       # Shared utilities
│   └── types/       # Shared TypeScript types
├── core/            # Core application code
│   ├── config/      # Core configuration
│   ├── services/    # Core services
│   └── store/       # State management
└── infrastructure/  # Infrastructure concerns
    ├── api/        # API client setup
    ├── electron/   # Electron-specific code
    └── testing/    # Test utilities
```

Each feature is self-contained with its own components, services, and types. Shared resources are available across all features.

### Development Scripts

```bash
# Start in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Package the application
npm run make
```

## Security

- All sensitive data is encrypted using Electron's safeStorage API
- Local data is stored in the user's app data directory
- No data is sent to external servers without explicit user permission

## License

MIT

## Contact

For support or feature requests, please open an issue on GitHub.
