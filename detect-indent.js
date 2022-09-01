const DEFAULT_INDENT = '  '

function detectIndent(text) {
  let indentRegexp = /^(\s*)"/m
  try {
    let indent = indentRegexp.exec(text)[1]
    return indent || DEFAULT_INDENT
  } catch (e) {
    return DEFAULT_INDENT
  }
}

module.exports = detectIndent
