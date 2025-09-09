import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: {
    command: 'npm run dev -- --port 5173',
    port: 5173,
    reuseExistingServer: true,
    env: {
      VITE_API_BASE: process.env.VITE_API_BASE || 'https://qlds-mapper-queensla.onrender.com',
    },
  },
});
