# n8n Desktop Wrapper

A secure and efficient Electron wrapper for n8n, providing a native desktop experience for workflow automation.

## Features

- Native desktop application for n8n
- Secure credential management
- Local workflow storage
- Cross-platform support (Windows, macOS, Linux)
- Automated testing and security checks
- Docker support for development
- Modern build system with Vite
- TypeScript and React support
- Automated code formatting and linting

## Security

This project follows security best practices:

- Regular security audits using `npm audit` and Snyk
- Secure credential storage using system keychain
- Input validation and sanitization
- Regular dependency updates
- Comprehensive error handling
- Secure file system operations
- Content Security Policy (CSP) implementation
- Sandboxed renderer process
- Secure IPC communication

## Prerequisites

- Node.js >= 18.18.0
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

## Development

### Code Quality

The project uses modern tools for code quality:

- ESLint with TypeScript and React support
- Prettier for code formatting
- Husky for git hooks
- lint-staged for pre-commit checks

### Build System

The project uses Vite for fast and efficient builds:

```bash
# Development
npm run dev

# Production build
npm run make

# Watch mode
npm run dev:watch
```

### Testing

Run comprehensive tests:

```bash
# Run all tests
npm run test:all

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Security Checks

Regular security audits:

```bash
# Run security audit
npm run security-audit

# Fix security issues
npm audit fix
```

## Usage

1. Download from [Releases](https://github.com/rogu3bear/n8n/releases)
2. Run the app—create a workflow (e.g., HTTP request to log data)
3. Check logs in ~/.n8n/logs if it bombs

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
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.

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
