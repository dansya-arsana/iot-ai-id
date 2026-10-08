import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90000,
  workers: 1,
  fullyParallel: false,
  reporter: 'line',
  use: {baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:8891'},
  webServer: {
    env: {OPENVIKING_URL: 'http://127.0.0.1:1'},
    command: 'npm run build && API_PORT=8891 API_BIND=127.0.0.1 IOT_AGENT_PROVIDER=fixture IOT_DB_PATH="$(mktemp -d)/e2e.sqlite" npx tsx services/api/server.ts',
    url: 'http://127.0.0.1:8891/api/session',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
