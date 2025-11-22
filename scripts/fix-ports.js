const { execSync } = require('child_process');
const os = require('os');

console.log('========================================');
console.log('Checking and fixing ports 3000, 3001, and 3002');
console.log('========================================\n');

function killProcessOnPort(port) {
  try {
    if (os.platform() === 'win32') {
      // Windows
      try {
        const result = execSync(`netstat -ano | findstr ":${port}" | findstr "LISTENING"`, { encoding: 'utf8' });
        if (result) {
          const lines = result.trim().split('\n');
          const pids = new Set();
          
          lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid)) {
              pids.add(pid);
            }
          });
          
          pids.forEach(pid => {
            try {
              console.log(`  Killing process ${pid} on port ${port}...`);
              execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
              console.log(`  ✓ Process ${pid} killed`);
            } catch (err) {
              // Process might already be dead
            }
          });
          
          return pids.size > 0;
        }
      } catch (err) {
        // No process found on port
        return false;
      }
    } else {
      // Unix-like (Linux, macOS)
      try {
        execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
        console.log(`  ✓ Port ${port} cleared`);
        return true;
      } catch (err) {
        return false;
      }
    }
  } catch (err) {
    return false;
  }
}

// Kill all node processes first
console.log('[1/3] Stopping all Node.js processes...');
try {
  if (os.platform() === 'win32') {
    execSync('taskkill /F /IM node.exe /T', { stdio: 'ignore' });
    console.log('  ✓ All Node.js processes stopped');
  } else {
    execSync('pkill -f node || true', { stdio: 'ignore' });
    console.log('  ✓ All Node.js processes stopped');
  }
} catch (err) {
  console.log('  ℹ No Node.js processes found');
}

console.log('\n[2/4] Checking and fixing port 3000...');
const port3000Fixed = killProcessOnPort(3000);
if (!port3000Fixed) {
  console.log('  ✓ Port 3000 is free');
}

console.log('\n[3/4] Checking and fixing port 3001...');
const port3001Fixed = killProcessOnPort(3001);
if (!port3001Fixed) {
  console.log('  ✓ Port 3001 is free');
}

console.log('\n[4/4] Checking and fixing port 3002...');
const port3002Fixed = killProcessOnPort(3002);
if (!port3002Fixed) {
  console.log('  ✓ Port 3002 is free');
}

console.log('\n========================================');
console.log('Ports are ready!');
console.log('========================================\n');

// Wait a bit for ports to be fully released
if (port3000Fixed || port3001Fixed || port3002Fixed) {
  console.log('Waiting 2 seconds for ports to be fully released...\n');
  const start = Date.now();
  while (Date.now() - start < 2000) {
    // Wait 2 seconds
  }
}
