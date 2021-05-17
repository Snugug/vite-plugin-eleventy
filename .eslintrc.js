module.exports = {
  root: true,
  overrides: [
    {
      files: ['*.js'],
      extends: ['eslint:recommended', 'google', 'plugin:prettier/recommended'],
      plugins: ['prettier'],
    },
  ],
  env: {
    browser: false,
    node: true,
    es6: true,
    es2017: true,
    es2020: true,
  },
  parserOptions: {
    parser: 'babel-eslint',
    ecmaVersion: 2020,
    sourceType: 'module',
  },
};
