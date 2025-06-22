import { END, START, TextTransformer } from '../transformer.type'

// change to list
// ===
//   - xxx[yyy
//   - yyyyyyy
//   yyyyyyy
//   yyy]xxx
// ===
//   - xxx[yyy
//   - yyyyyyy
//   - yyyyyyy
//   - yyy]xxx
// ===

// change to block
// ===
//   - xxx[yyy
//   - yyyyyyy
//   - yyyyyyy
//   - yyy]xxx
// ===
//   xxx[yyy
//   yyyyyyy
//   yyyyyyy
//   yyy]xxx
// ===

const LIST_ITEM_REG = /^([ \u0000\u0001]*)- /
const BLOCK_ITEM_REG = /^([ \u0000\u0001]*)/

const changeToListItem = (line: string) => {
  return line.replace(BLOCK_ITEM_REG, (match, leadingSpaces) => {
    return leadingSpaces + '- '
  })
}
const changeToBlockItem = (line: string) => {
  return line.replace(LIST_ITEM_REG, (match, leadingSpaces) => {
    return leadingSpaces
  })
}

export const toggleList: TextTransformer = (state) => {
  const lines = state.split('\n')

  const cursorStartAt = lines.findIndex((line) => line.includes(START))
  const cursorEndAt = lines.findIndex((line) => line.includes(END))

  let isList = true
  for (let i = cursorStartAt; i <= cursorEndAt; i++) {
    const line = lines[i]
    if (!LIST_ITEM_REG.test(line)) {
      isList = false
      break
    }
  }

  for (let i = cursorStartAt; i <= cursorEndAt; i++) {
    lines[i] = isList ? changeToBlockItem(lines[i]) : changeToListItem(lines[i])
  }

  return lines.join('\n')
}
