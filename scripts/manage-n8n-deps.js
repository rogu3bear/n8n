const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// Configuration
const N8N_VERSION = '1.28.0'; // Specific version for stability
const DEPS_DIR = path.join(process.cwd(), '.n8n-deps');
const N8N_DIR = path.join(DEPS_DIR, 'n8n');

function ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function setupN8nDependencies() {
    console.log('Setting up isolated n8n dependencies...');
    
    // Create directories
    ensureDirectoryExists(DEPS_DIR);
    ensureDirectoryExists(N8N_DIR);
    
    // Create package.json for n8n
    const packageJson = {
        name: 'n8n-isolated',
        version: '1.0.0',
        private: true,
        dependencies: {
            n8n: N8N_VERSION
        }
    };
    
    fs.writeFileSync(
        path.join(N8N_DIR, 'package.json'),
        JSON.stringify(packageJson, null, 2)
    );
    
    // Install dependencies
    console.log('Installing n8n and its dependencies...');
    execSync('npm install', { cwd: N8N_DIR, stdio: 'inherit' });
    
    // Create a symlink to the n8n binary
    const n8nBinPath = path.join(N8N_DIR, 'node_modules', '.bin', 'n8n');
    const targetBinPath = path.join(DEPS_DIR, 'n8n');
    
    if (fs.existsSync(targetBinPath)) {
        fs.unlinkSync(targetBinPath);
    }
    
    fs.symlinkSync(n8nBinPath, targetBinPath);
    
    console.log('n8n dependencies setup complete!');
    console.log(`n8n binary available at: ${targetBinPath}`);
}

function cleanupN8nDependencies() {
    console.log('Cleaning up n8n dependencies...');
    
    if (fs.existsSync(DEPS_DIR)) {
        fs.rmSync(DEPS_DIR, { recursive: true, force: true });
        console.log('n8n dependencies cleaned up successfully.');
    } else {
        console.log('No n8n dependencies to clean up.');
    }
}

// Handle command line arguments
const command = process.argv[2];

switch (command) {
    case 'setup':
        setupN8nDependencies();
        break;
    case 'cleanup':
        cleanupN8nDependencies();
        break;
    default:
        console.error('Please specify either "setup" or "cleanup"');
        process.exit(1);
} 