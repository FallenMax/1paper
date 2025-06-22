import { END, START, TextTransformer } from '../transformer.type'
// ===
//   xxx[yyy]zzz
// ===
//     xxx[yyy]zzz
// ===

const indentLine = (str: string) => '  ' + str
export const indent: TextTransformer = (state) => {
  const lines = state.split('\n')

  const cursorStartAt = lines.findIndex((line) => line.includes(START))
  const cursorEndAt = lines.findIndex((line) => line.includes(END))

  for (let i = cursorStartAt; i <= cursorEndAt; i++) {
    const line = lines[i]
    lines[i] = indentLine(line)
  }

  return lines.join('\n')
}
