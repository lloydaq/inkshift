import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    restoreMocks: true,
    // The browser doubles drive transitions with real zero-delay timers, which Windows
    // rounds up to its ~15ms tick: one ink run takes ~2s to settle there, and some tests
    // run several.
    testTimeout: 30_000,
  },
});
