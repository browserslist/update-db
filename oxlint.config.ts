import loguxOxlintConfig from '@logux/oxc-configs/lint'
import { defineConfig } from 'oxlint'

export default defineConfig({
  extends: [loguxOxlintConfig],
  rules: {
    'unicorn/no-array-sort': 'off',
    'node/global-require': 'off'
  },
  overrides: [
    {
      files: ['*/*.test.js'],
      rules: {
        'no-control-regex': 'off'
      }
    }
  ]
})
