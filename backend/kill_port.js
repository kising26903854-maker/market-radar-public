import { execSync } from 'child_process';

function killPort(port) {
  try {
    console.log(`Checking port ${port}...`);
    const output = execSync(`netstat -ano | findstr :${port}`).toString();
    const lines = output.split('\n');
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 5) {
        const proto = parts[0];
        const localAddr = parts[1];
        const pid = parts[4];
        if (localAddr.includes(`:${port}`) && pid !== '0') {
          console.log(`Killing PID ${pid} on port ${port}...`);
          try {
            execSync(`taskkill /F /PID ${pid}`);
            console.log(`Killed PID ${pid}`);
          } catch (err) {
            console.error(`Failed to kill PID ${pid}:`, err.message);
          }
        }
      }
    });
  } catch (e) {
    console.log(`No active processes found on port ${port} or error occurred:`, e.message);
  }
}

killPort(6001);
