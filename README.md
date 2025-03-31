# n8n Desktop Wrapper

A secure and efficient Electron wrapper for n8n, providing a native desktop experience for workflow automation.

## Features

- Native desktop application for n8n
- Secure credential management
- Local workflow storage
- Cross-platform support (Windows, macOS, Linux)
- Automated testing and security checks
- Docker support for development

## Security

This project follows security best practices:

- Regular security audits using `npm audit` and Snyk
- Secure credential storage using system keychain
- Input validation and sanitization
- Regular dependency updates
- Comprehensive error handling
- Secure file system operations

## Prerequisites

- Node.js >= 18.17.0
- npm >= 9.0.0
- Docker (optional, for development)
- Python 3.8+ (for development tools)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/rogu3bear/n8n.git
cd n8n
```

2. Install dependencies:

```bash
npm install
```

3. Set up development environment:

```bash
npm run setup:python
```

## Usage

1. Download from [Releases](https://github.com/rogu3bear/n8n/releases).
2. Run the app—create a workflow (e.g., HTTP request to log data).
3. Check logs in ~/.n8n/logs if it bombs.

## Development and Debugging

### VS Code Debugging

The project includes comprehensive VS Code debugging configurations:

1. **Debug Main Process**
   - F5 or select "Debug Main Process" from the debug menu
   - Debugs the Electron main process
   - Breakpoints in `src/core/main.js`

2. **Debug Renderer Process**
   - Debugs the Electron renderer process
   - Breakpoints in `src/renderer/` files
   - Chrome DevTools integration

3. **Debug Tests**
   - Runs Jest tests with debugging
   - Breakpoints in test files
   - Full test coverage debugging

4. **Debug Test Mode**
   - Runs the app in test mode
   - Tests workflow execution
   - Breakpoints in `src/tests/`

5. **Debug Performance Test**
   - Measures app startup time
   - Performance profiling
   - Memory leak detection

### Terminal Testing

Run comprehensive tests from the terminal:

```bash
# Run all tests
./test.sh

# Individual test modes
npm run make
./out/n8n-darwin-x64/n8n.app/Contents/MacOS/n8n --test-mode
./out/n8n-darwin-x64/n8n.app/Contents/MacOS/n8n --perf-test
```

### Logging

- Development logs: `~/.n8n/logs/`
- Enable debug logging: `DEBUG=* npm start`
- View recent errors: `grep -r "ERROR" ~/.n8n/logs/*.log`

### Common Debugging Scenarios

1. **App Won't Start**
   ```bash
   DEBUG=* ./out/n8n-darwin-x64/n8n.app/Contents/MacOS/n8n
   ```

2. **Workflow Issues**
   ```bash
   ./out/n8n-darwin-x64/n8n.app/Contents/MacOS/n8n --test-mode
   ```

3. **Performance Problems**
   ```bash
   time ./out/n8n-darwin-x64/n8n.app/Contents/MacOS/n8n --perf-test
   ```

4. **Test Failures**
   ```bash
   npm run test:all
   ```

### Troubleshooting
- "App won't start": Run `DEBUG=* ./n8n-wrapper` for logs.
- "Missing deps": Reinstall with `npm ci`.
- "Webpack errors": Clear node_modules and run `npm ci` again.
- "Electron Forge issues": Run `npx electron-forge import` to reinitialize.

### Basic Workflow Example

1. Launch n8n Desktop:
```bash
npm start
```

2. Create a Simple Automation:
   - Click "Add Workflow"
   - Add a "Schedule Trigger" node (runs every hour)
   - Add a "HTTP Request" node to fetch data
   - Add a "Send Email" node to notify you
   - Connect the nodes and configure them
   - Click "Save" and "Activate"

### Common Workflows

1. **File Processing Pipeline**
   - Watch a folder for new files
   - Process files (e.g., convert format)
   - Move to archive folder
   - Send notification

2. **Data Sync**
   - Fetch data from API
   - Transform data
   - Update database
   - Generate report

3. **Notification System**
   - Monitor system metrics
   - Set thresholds
   - Send alerts via email/Slack
   - Log incidents

### Getting Help

- Check the [n8n Documentation](https://docs.n8n.io)
- Search [GitHub Issues](https://github.com/rogu3bear/n8n/issues)
- Join the [n8n Community](https://community.n8n.io)
- Enable debug logging for detailed error information

## Development

Start the development server:

```bash
npm run dev
```

Run tests:

```bash
npm run test:all
```

Security audit:

```bash
npm run security-audit
```

## Building

Build for your platform:

```bash
npm run build
```

## Security Best Practices

1. **Dependency Management**

   - Regular security audits
   - Automated dependency updates
   - Version locking

2. **Code Security**

   - Input validation
   - Error handling
   - Secure file operations
   - Credential management

3. **Development Security**
   - Pre-commit hooks
   - Code linting
   - Type checking
   - Security testing

## Contributing

1. Fork the repository
2. Create your feature branch
3. Run tests and security checks
4. Submit a pull request

## License

ISC License - See LICENSE file for details

## Support

For support, please visit:

- [GitHub Issues](https://github.com/rogu3bear/n8n/issues)
- [n8n Documentation](https://docs.n8n.io)
- [n8n Community](https://community.n8n.io)

## Security Policy

Please report security vulnerabilities to security@n8n.io

## Acknowledgments

- n8n team and community
- Electron team
- All contributors
