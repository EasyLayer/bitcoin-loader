const baseConfig = require('../jest.config');

module.exports = {
    ...baseConfig,
    testEnvironment: 'node',
    reporters: ['default', ['jest-junit', {
        outputDirectory: './reports',
        outputName: 'report.xml',
    }]],
    testTimeout: 60000,
    maxWorkers: 1,
    testRegex: ".*\\.e2e-test\\.ts$",
    roots: [
        "<rootDir>/src/"
    ],
    transform: {
        "^.+\\.ts?$": "ts-jest"
    },
    testPathIgnorePatterns: baseConfig.testPathIgnorePatterns.concat([
        "<rootDir>/node_modules",
        "<rootDir>/dist"
    ]),
    setupFiles: ["<rootDir>/jest.setup.js"]
};