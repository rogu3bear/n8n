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
