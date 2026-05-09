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
};

export default config;
