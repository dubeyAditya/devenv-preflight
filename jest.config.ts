import type { Config } from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/packages'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    collectCoverageFrom: ['packages/*/src/**/*.ts', '!packages/*/src/**/index.ts'],
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
    },
    setupFiles: ['<rootDir>/jest.setup.ts'],
    // Tests fork many child processes per scanEnvironment call (one per detector).
    // Running test files in parallel multiplies that count and can starve the
    // OS process table on macOS, causing spurious timeouts. Run serially.
    maxWorkers: 1,
};

export default config;
