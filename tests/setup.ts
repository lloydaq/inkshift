import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { resetBrowser } from './helpers/browser';

beforeEach(() => {
  resetBrowser();
});

afterEach(() => {
  cleanup();
  resetBrowser();
});
