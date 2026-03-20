const { spawn } = require('child_process');
const path = require('path');

// Determine binary path based on platform
const isWindows = process.platform === 'win32';
const binaryName = isWindows ? 'face-hugger.exe' : 'face-hugger';
const binaryPath = path.resolve(__dirname, '../../src-tauri/target/release', binaryName);

exports.config = {
  specs: ['./specs/**/*.spec.js'],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      'tauri:options': {
        application: binaryPath,
      },
      browserName: 'wry',
    },
  ],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    timeout: 60000,
  },
  onPrepare: function () {
    // Start tauri-driver before tests
    this.tauriDriver = spawn('tauri-driver', [], {
      stdio: [null, process.stdout, process.stderr],
    });
  },
  onComplete: function () {
    if (this.tauriDriver) {
      this.tauriDriver.kill();
    }
  },
};
