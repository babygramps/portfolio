import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';

const app = {
  url: process.env.APP_URL ?? 'http://127.0.0.1:1234/scheduling',
  command: {
    executable: 'node',
    args: ['./node_modules/next/dist/bin/next', 'dev', '--port', '1234'],
    log: '.e2e/logs/app.log',
    reuseExisting: true,
  },
};

export default {
  targets: [
    {
      name: 'web',
      engine: web(),
      app,
    },
    {
      name: 'mobile',
      engine: web({ viewport: { width: 390, height: 844 } }),
      app,
    },
  ],
} satisfies E2EConfig;
