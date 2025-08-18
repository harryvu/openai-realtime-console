export default {
  // Test environment
  testEnvironment: 'jsdom',
  
  // ES modules support
  extensionsToTreatAsEsm: ['.jsx'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  
  // Module name mapping for imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^~/(.*)$': '<rootDir>/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/test/__mocks__/fileMock.js'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/test/setup.js'
  ],
  
  // Test file patterns
  testMatch: [
    '<rootDir>/test/**/*.test.{js,jsx}',
    '<rootDir>/client/**/*.test.{js,jsx}',
    '<rootDir>/lib/**/*.test.{js,jsx}',
    '<rootDir>/scripts/**/*.test.{js,jsx}'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'client/**/*.{js,jsx}',
    'lib/**/*.{js,jsx}',
    'server.js',
    '!client/entry-*.{js,jsx}',
    '!**/node_modules/**',
    '!**/test/**'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  
  // Transform files
  transform: {
    '^.+\\.jsx?$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }]
  },
  
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Reset modules between tests
  resetMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Increase timeout for integration tests
  testTimeout: 15000
};