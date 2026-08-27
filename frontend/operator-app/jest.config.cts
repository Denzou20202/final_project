module.exports = {
  displayName: 'operator-app',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
    '^.+\\.[tj]sx?$': [
      'babel-jest',
      { presets: ['@nx/react/babel'], plugins: ['babel-plugin-transform-vite-meta-env'] },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  moduleNameMapper: {
    '^virtual:pwa-register/react$': '<rootDir>/src/test-mocks/pwa-register-react.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: 'test-output/jest/coverage',
};
