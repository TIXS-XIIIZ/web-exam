/**
 * Cleans arbitrary hard line-wraps from Thai text.
 * When text is imported from fixed-width formatted source files (e.g. Markdown),
 * sentences and words get split arbitrarily with '\n'.
 * This function preserves intentional double newlines (paragraphs),
 * but joins single newlines cleanly without breaking Thai words.
 */
export function cleanThaiText(str: string | null | undefined): string {
  if (!str) return ''

  // 1. Normalize line breaks
  let s = str.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // 2. Preserve explicit double newlines (paragraphs)
  const PARAGRAPH_PLACEHOLDER = '\n\n__PARAGRAPH__\n\n'
  s = s.replace(/\n\s*\n+/g, PARAGRAPH_PLACEHOLDER)

  // 3. For single newlines within each paragraph:
  const rawParagraphs = s.split(PARAGRAPH_PLACEHOLDER)

  const cleanedParagraphs = rawParagraphs.map((para) => {
    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length <= 1) return lines.join('')

    let result = lines[0]
    for (let i = 1; i < lines.length; i++) {
      const prev = lines[i - 1]
      const current = lines[i]
      const prevLastChar = prev.slice(-1)
      const currFirstChar = current.charAt(0)

      const isThaiPrev = /[\u0E00-\u0E7F]/.test(prevLastChar)
      const isThaiCurr = /[\u0E00-\u0E7F]/.test(currFirstChar)

      if (isThaiPrev && isThaiCurr) {
        // e.g. "ซื้อขายคริปโท" + "เคอร์เรนซี" -> "ซื้อขายคริปโทเคอร์เรนซี"
        result += current
      } else {
        // Between digits, latin letters, or punctuation -> add single space
        result += ' ' + current
      }
    }
    return result
  })

  return cleanedParagraphs.join('\n\n').trim()
}
