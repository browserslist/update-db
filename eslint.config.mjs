import loguxConfig from '@logux/eslint-config'

export default [
  ...loguxConfig,
  {
    rules: {
      'n/global-require': 'off',
      'n/prefer-node-protocol': 'off',
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
