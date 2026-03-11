const nextConfig = require('eslint-config-next/core-web-vitals');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  ...nextConfig,
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
];
