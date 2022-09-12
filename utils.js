const DEFAULT_INDENT = '  '
const INDENT_REGEXP = /^([ \t]+)[^\s]/m

module.exports.detectIndent = text => {
  let match = INDENT_REGEXP.exec(text)
  if (match !== null) return match[1]
  return DEFAULT_INDENT
}
module.exports.DEFAULT_INDENT = DEFAULT_INDENT
