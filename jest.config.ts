import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }]
  },
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      diagnostics: false
    }
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testMatch: ['**/tests/**/*.test.ts']
};

export default config;
