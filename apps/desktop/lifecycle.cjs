const {spawn} = require('node:child_process');
const {join, delimiter} = require('node:path');
const {homedir} = require('node:os');
const PORT = 8788;
function backendEnvironment(resources, userData, inherited = process.env, platform = process.platform) {
  return {...inherited, API_PORT: String(PORT), API_BIND: '127.0.0.1', WEB_PORT: String(PORT),
    IOT_DB_PATH: join(userData, 'iot.sqlite'), IOT_RUNTIME_BUILDS_PATH: join(userData, 'runtime', 'builds'),
    ARDUINO_CLI_PATH: join(resources, 'bin', platform === 'win32' ? 'arduino-cli.exe' : 'arduino-cli'),
    PATH: [join(resources, 'bin'), ...(platform === 'win32' ? [] : ['/opt/homebrew/bin', '/usr/local/bin']), join(homedir(), '.local/bin'), inherited.PATH || ''].join(platform === 'win32' ? ';' : delimiter)};
}
function startBackend(resources, userData, log) {
  const child = spawn(join(resources, 'bin', process.platform === 'win32' ? 'node.exe' : 'node'), ['--import', 'tsx', 'services/api/server.ts'], {
    cwd: join(resources, 'runtime'), env: backendEnvironment(resources, userData),
    detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe']});
  child.stdout.on('data', data => log.write(data));
  child.stderr.on('data', data => log.write(data));
  return child;
}
async function waitReady(child, timeout = 30000) {
  const deadline = Date.now() + timeout;
  let failure, listening = false;
  child.stdout?.on('data', data => {if (String(data).includes('IOT AI ID API: http://127.0.0.1:8788')) listening = true;});
  child.once('error', error => { failure = error; });
  while (Date.now() < deadline) {
    if (failure) throw failure;
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('Local backend stopped during startup. Read backend.log for details.');
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/api/session`, {signal: AbortSignal.timeout(500)});
      if (listening && response.ok && (await response.json()).local === true) {
        // Give bind failures time to surface; never adopt another app's server.
        await new Promise(resolve => setTimeout(resolve, 150));
        if (child.exitCode !== null || child.signalCode !== null) throw new Error('Port 8788 is already in use. Close the conflicting app.');
        return;
      }
    } catch (error) { if (child.exitCode !== null) throw error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Local backend did not start within 30 seconds. Read backend.log for details.');
}
async function stopBackend(child) {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const kill = signal => {try {if (process.platform === 'win32') {const killer = spawn(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], {windowsHide: true, stdio: 'ignore'}); killer.on('error', () => child.kill());} else process.kill(-child.pid, signal);} catch { /* Already exited. */ }};
  const closed = new Promise(resolve => child.once('close', resolve));
  kill('SIGTERM');
  const timer = setTimeout(() => kill('SIGKILL'), 2500);
  await Promise.race([closed, new Promise(resolve => setTimeout(resolve, 5000))]);
  clearTimeout(timer);
}
module.exports = {PORT, backendEnvironment, startBackend, waitReady, stopBackend};
