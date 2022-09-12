let { suite } = require('uvu')
let { equal } = require('uvu/assert')

const { detectIndent, DEFAULT_INDENT } = require('../utils')

const detectIndentSuite = suite('detectIndent')

const lineEndings = ['\n', '\r\n']
const indentationStyles = ['  ', '    ', '\t']

lineEndings.forEach(lineEnding =>
  indentationStyles.forEach(indentationStyle =>
    detectIndentSuite(
      `should detect correctly for ${JSON.stringify(
        lineEnding
      )} EOL and ${JSON.stringify(indentationStyle)} indentation style`,
      () => {
        equal(
          detectIndent(
            `{${lineEnding}${indentationStyle}"name": "my-project"${lineEnding}}`
          ),
          indentationStyle
        )
      }
    )
  )
)

detectIndentSuite(
  `should return ${JSON.stringify(DEFAULT_INDENT)} when regex fails`,
  () => {
    equal(detectIndent('{"no":"indent"}'), DEFAULT_INDENT)
  }
)

detectIndentSuite.run()
