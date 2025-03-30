#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Determine the likely platform and construct the user data path
// Note: This mimics app.getPath('userData') but runs outside Electron.
// It assumes the standard location based on the app name inferred from package.json
// or a fallback name. This is generally reliable for development but less robust
// than app.getPath('userData') itself.

// Try to infer app name from package.json in the parent directory
let appName = 'n8n-electron-wrapper'; // Fallback name
try {
    const pkg = require(path.join(__dirname, '..', 'package.json'));
    // Use productName if available, otherwise use name
    appName = pkg.build?.productName || pkg.name || appName;
    console.log(`Using app name for path: ${appName}`);
} catch (err) {
    console.warn('Could not read package.json to determine appName, using fallback:', appName);
}

let userDataPath;
const platform = os.platform();

if (platform === 'darwin') { // macOS
    userDataPath = path.join(os.homedir(), 'Library', 'Application Support', appName);
} else if (platform === 'win32') { // Windows
    userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', appName);
} else { // Linux and others
    userDataPath = path.join(os.homedir(), '.config', appName);
}

const configPath = path.join(userDataPath, 'config.json');

async function resetConfig() {
    console.log(`Attempting to reset config for development at: ${configPath}`);
    try {
        await fs.unlink(configPath);
        console.log(`✅ Successfully deleted config file: ${configPath}`);
    } catch (err) {
        if (err.code === 'ENOENT') {
            // File doesn't exist, which is fine.
            console.log(`ℹ️ Config file not found (already reset or never created): ${configPath}`);
        } else {
            // Other error (permissions, etc.)
            console.error(`❌ Error resetting config: ${err.message}`);
            // Exit with error code to potentially stop the npm script chain
            process.exit(1); 
        }
    }
}

resetConfig(); 