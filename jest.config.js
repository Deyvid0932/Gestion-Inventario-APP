module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react' } }],
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/utils/**/*.ts',
    'src/services/**/*.ts',
    '!src/**/*.d.ts',
  ],
};
