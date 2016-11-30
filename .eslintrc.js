'use strict';

const eslint = exports;

// What environments the code runs in.
eslint.env = {
  es6: true,
  commonjs: true,
  browser: true,
  node: true,
};

// Default configs plus my personal fav.
eslint.extends = [
  'eslint:recommended',
  'llama',
];

eslint.rules = {
  'no-var': 'error',
  'global-require': 'off',
  'require-jsdoc': 'off',
  'no-sync': 'off',
};
