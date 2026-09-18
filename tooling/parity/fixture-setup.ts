import '@testing-library/jest-dom/vitest';
import * as chai from 'chai';
import chaiPlugin from '@mui/internal-test-utils/chaiPlugin';

chai.use(chaiPlugin);
(globalThis as typeof globalThis & { BASE_UI_ANIMATIONS_DISABLED?: boolean })
  .BASE_UI_ANIMATIONS_DISABLED = true;
