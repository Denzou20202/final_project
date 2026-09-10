const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'),
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: '@veloxdesk/common',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  // sanitize-html's own code is CommonJS, but its htmlparser2@12 dependency
  // and ITS whole dom-* dependency chain (domhandler/domutils/dom-serializer/
  // domelementtype/entities) ship pure ESM (`"type": "module"`) — fine for
  // the actual running services (webpack bundles them), but Jest's default
  // transformIgnorePatterns skips all of node_modules, so requiring any of
  // them un-transformed throws "Cannot use import statement outside a
  // module". sanitize-comment-body.spec.ts is the first spec in this
  // project to pull sanitize-html in under Jest, exposing this
  // previously-latent gap.
  transformIgnorePatterns: [
    'node_modules/(?!(sanitize-html|htmlparser2|entities|domhandler|domutils|dom-serializer|domelementtype)/)',
  ],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
