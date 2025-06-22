import { BULLET, CURSOR, SELECTION, TextTransformer } from '../transformer.type'

const BULLET_LINE_REG = new RegExp(`^( *)(${BULLET})?(.*)${SELECTION}(.*)$`, 'm')

// ===
//   - xxx[yyyy]zzz
// ===
//   - xxx
//   - []zzz
// ===

export const addNewLine: TextTransformer = (state) => {
  const match = BULLET_LINE_REG.exec(state)
  if (match) {
    const [matched, leadingSpaces, bullet, beforeCursor, afterCursor] = match

    if (leadingSpaces === '' && bullet === undefined) return undefined
    return state.replace(
      matched,
      beforeCursor === ' ' && afterCursor === '' // - []    remove bullet
        ? `${CURSOR}`
        : bullet === undefined
        ? `${leadingSpaces}${beforeCursor}\n${leadingSpaces}${CURSOR}${afterCursor}`
        : `${leadingSpaces}${bullet}${beforeCursor}\n${leadingSpaces}${bullet} ${CURSOR}${afterCursor}`,
    )
  }
}
