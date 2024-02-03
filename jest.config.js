/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    testEnvironment: 'node',
    preset: 'ts-jest/presets/default-esm',
    testMatch: ['<rootDir>/**/tests/**/*.test.ts'],
    moduleNameMapper: {
        // @/index.js -> src/index.ts
        // '^@/(.*)$': '<rootDir>/src/$1',
        '^(..?/.+).js?$': '$1',
    },
    extensionsToTreatAsEsm: ['.ts'],
    transform: {
        '^.+\\.[jt]s?$': [
            'ts-jest',
            {
                useESM: true,
                tsconfig: {
                    allowJs: true,
                },
            },
        ],
    },
}
