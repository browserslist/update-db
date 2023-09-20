let { suite } = require('uvu')
let { equal } = require('uvu/assert')

const {
  DEFAULT_EOL,
  DEFAULT_INDENT,
  detectEOL,
  detectIndent
} = require('../utils')

const detectIndentSuite = suite('detectIndent')

const lineEndings = ['\n', '\r', '\r\n']
const indentationStyles = ['  ', '    ', '\t']

lineEndings.forEach(lineEnding =>
  indentationStyles.forEach(indentationStyle =>
    detectIndentSuite(
      `should detect correctly for ${JSON.stringify(
        lineEnding
      )} EOL and ${JSON.stringify(indentationStyle)} indentation style`,
      () =>
        equal(
          detectIndent(
            `{${lineEnding}${indentationStyle}"name": "my-project"${lineEnding}}`
          ),
          indentationStyle
        )
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

const detectEOLSuite = suite('detectEOL')

lineEndings.forEach(lineEnding =>
  detectEOLSuite(
    `should detect line ending ${JSON.stringify(lineEnding)} correctly`,
    () =>
      equal(
        detectEOL(`{${lineEnding}  "name": "my-project"${lineEnding}}`),
        lineEnding
      )
  )
)

detectIndentSuite(
  `should return ${JSON.stringify(DEFAULT_EOL)} when regex fails`,
  () => {
    equal(detectIndent('{"no":"eol"}'), DEFAULT_EOL)
  }
)

detectEOLSuite.run()
