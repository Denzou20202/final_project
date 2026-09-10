const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'),
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: 'analytics-service',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  // sanitize-html bundles its own ESM-only htmlparser2 (plus htmlparser2's
  // own ESM-only deps) under a NESTED node_modules — the path has two
  // "node_modules/" segments, so a plain negative-lookahead exception only
  // protects whichever segment it's anchored to; the other one still
  // matches Jest's default ignore-all-of-node_modules pattern. Naming every
  // package in the nested chain in one alternation covers both segments
  // regardless of which one .test() latches onto. Everything else in
  // node_modules is untouched (already CJS, no transform needed). Copied
  // from ticket-service/jest.config.cts — analytics-service only started
  // needing it once reports.service.ts imported @veloxdesk/common, whose
  // barrel re-exports sanitizeArticleBody (and its sanitize-html import)
  // alongside everything else.
  transformIgnorePatterns: [
    '/node_modules/(?!.*(sanitize-html|dom-serializer|domelementtype|domhandler|domutils|entities|escape-string-regexp|htmlparser2|is-plain-object))',
  ],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
};
