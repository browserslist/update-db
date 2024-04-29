import loguxConfig from '@logux/eslint-config'

export default [
  ...loguxConfig,
  {
    rules: {
      'n/global-require': 'off',
      'node-import/prefer-node-protocol': 'off'
    }
  },
  {
    files: ['*/*.test.js'],
    rules: {
      'no-control-regex': 'off'
    }
  }
]
