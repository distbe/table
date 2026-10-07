// East Asian characters (Hangul, Han, Kana, fullwidth) occupy two cells in a monospace font.
const WIDE_RANGES: [number, number][] = [
  [0x1100, 0x115f],
  // Symbols and dingbats that Unicode marks East Asian Wide — ✅ ❌ ⌚ ⭐ and friends.
  [0x231a, 0x231b],
  [0x2329, 0x232a],
  [0x23e9, 0x23ec],
  [0x23f0, 0x23f0],
  [0x23f3, 0x23f3],
  [0x25fd, 0x25fe],
  [0x2614, 0x2615],
  [0x2648, 0x2653],
  [0x267f, 0x267f],
  [0x2693, 0x2693],
  [0x26a1, 0x26a1],
  [0x26aa, 0x26ab],
  [0x26bd, 0x26be],
  [0x26c4, 0x26c5],
  [0x26ce, 0x26ce],
  [0x26d4, 0x26d4],
  [0x26ea, 0x26ea],
  [0x26f2, 0x26f3],
  [0x26f5, 0x26f5],
  [0x26fa, 0x26fa],
  [0x26fd, 0x26fd],
  [0x2705, 0x2705],
  [0x270a, 0x270b],
  [0x2728, 0x2728],
  [0x274c, 0x274c],
  [0x274e, 0x274e],
  [0x2753, 0x2755],
  [0x2757, 0x2757],
  [0x2795, 0x2797],
  [0x27b0, 0x27b0],
  [0x27bf, 0x27bf],
  [0x2b1b, 0x2b1c],
  [0x2b50, 0x2b50],
  [0x2b55, 0x2b55],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xa960, 0xa97f],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xfe10, 0xfe19],
  [0xfe30, 0xfe6f],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
  [0x17000, 0x18aff],
  [0x1b000, 0x1b16f],
  [0x1f004, 0x1f004],
  [0x1f0cf, 0x1f0cf],
  [0x1f18e, 0x1f18e],
  [0x1f191, 0x1f19a],
  [0x1f200, 0x1f320],
  [0x1f32d, 0x1f335],
  [0x1f337, 0x1f37c],
  [0x1f37e, 0x1f393],
  [0x1f3a0, 0x1f3ca],
  [0x1f3cf, 0x1f3d3],
  [0x1f3e0, 0x1f3f0],
  [0x1f3f4, 0x1f3f4],
  [0x1f3f8, 0x1f43e],
  [0x1f440, 0x1f440],
  [0x1f442, 0x1f4fc],
  [0x1f4ff, 0x1f53d],
  [0x1f54b, 0x1f54e],
  [0x1f550, 0x1f567],
  [0x1f57a, 0x1f57a],
  [0x1f595, 0x1f596],
  [0x1f5a4, 0x1f5a4],
  [0x1f5fb, 0x1f64f],
  [0x1f680, 0x1f6c5],
  [0x1f6cc, 0x1f6cc],
  [0x1f6d0, 0x1f6d2],
  [0x1f6eb, 0x1f6ec],
  [0x1f910, 0x1f9ff],
  [0x1fa70, 0x1faff],
  [0x20000, 0x3fffd],
]

const ZERO_RANGES: [number, number][] = [
  [0x0300, 0x036f],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0xfe00, 0xfe0f],
  [0xfe20, 0xfe2f],
  [0xe0100, 0xe01ef],
]

const inRanges = (cp: number, ranges: [number, number][]) =>
  ranges.some(([from, to]) => cp >= from && cp <= to)

export function charWidth(cp: number): number {
  if (cp === 0x200d) return 0
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0
  if (inRanges(cp, ZERO_RANGES)) return 0
  return inRanges(cp, WIDE_RANGES) ? 2 : 1
}

/** Number of monospace cells the string occupies. */
export function stringWidth(text: string): number {
  let width = 0
  for (const char of text) width += charWidth(char.codePointAt(0)!)
  return width
}

export function padTo(text: string, width: number, align: 'left' | 'center' | 'right'): string {
  const space = Math.max(0, width - stringWidth(text))
  if (align === 'right') return ' '.repeat(space) + text
  if (align === 'center') {
    const left = Math.floor(space / 2)
    return ' '.repeat(left) + text + ' '.repeat(space - left)
  }
  return text + ' '.repeat(space)
}

/** Wrap by display width: break on whitespace when possible, otherwise mid-word. */
export function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [text]
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    const flush = () => {
      lines.push(line)
      line = ''
    }
    for (const word of paragraph.split(/(\s+)/)) {
      if (!word) continue
      const isSpace = /^\s+$/.test(word)
      if (stringWidth(line) + stringWidth(word) <= width) {
        if (!(isSpace && line === '')) line += word
        continue
      }
      if (isSpace) {
        if (line !== '') flush()
        continue
      }
      if (line !== '') flush()
      // A single word wider than the limit is split character by character.
      for (const char of word) {
        if (stringWidth(line) + charWidth(char.codePointAt(0)!) > width && line !== '') flush()
        line += char
      }
    }
    lines.push(line)
  }
  return lines.length ? lines : ['']
}
