const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Virtual Environment Integration Tests', () => {
  let testDir;

  beforeEach(() => {
    testDir = fs.mkdtempSync('n8n-venv-test-');
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should activate and deactivate virtual environment', () => {
    const envHandler = path.join(__dirname, '..', '..', '..', 'python', 'env_handler.py');
    
    // Set up virtual environment
    execSync(`python ${envHandler} setup`, { cwd: testDir });
    expect(fs.existsSync(path.join(testDir, '.venv'))).toBe(true);

    // Activate and check
    const activateOutput = execSync(`python ${envHandler} run 'echo $VIRTUAL_ENV'`, { cwd: testDir }).toString();
    expect(activateOutput).toContain(path.join(testDir, '.venv'));

    // Deactivate and check  
    const deactivateOutput = execSync(`python ${envHandler} run 'echo $VIRTUAL_ENV'`, { 
      cwd: testDir,
      env: { ...process.env, DEACTIVATE_VENV: '1' }
    }).toString();
    expect(deactivateOutput).not.toContain(path.join(testDir, '.venv'));
  });

  it('should run setup and other commands with virtual env', () => {
    const envHandler = path.join(__dirname, '..', '..', '..', 'python', 'env_handler.py');
    
    // Set up virtual environment and install a package
    execSync(`python ${envHandler} setup`, { cwd: testDir });
    execSync(`python ${envHandler} run 'pip install requests'`, { cwd: testDir });

    // Check that package is installed in virtual env
    const pipFreezeOutput = execSync(`python ${envHandler} run 'pip freeze'`, { cwd: testDir }).toString();
    expect(pipFreezeOutput).toContain('requests==');
  });

  it('should handle missing virtual environment', () => {
    const envHandler = path.join(__dirname, '..', '..', '..', 'python', 'env_handler.py');
    
    expect(() => {
      execSync(`python ${envHandler} run 'echo $VIRTUAL_ENV'`, { cwd: testDir });
    }).toThrow();
  });

  it('should handle activation/deactivation errors', () => {
    const envHandler = path.join(__dirname, '..', '..', '..', 'python', 'env_handler.py');
    
    fs.mkdirSync(path.join(testDir, '.venv'));
    fs.writeFileSync(path.join(testDir, '.venv', 'bin', 'activate_this.py'), 'raise Exception("test error")');

    expect(() => {
      execSync(`python ${envHandler} run 'echo $VIRTUAL_ENV'`, { cwd: testDir });
    }).toThrow();
  });
}); 