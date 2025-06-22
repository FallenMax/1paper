import { END, START, TextTransformer } from '../transformer.type'
// ===
//     xxx[yyy
//     yyyyyyy
//     yyyyyyy
//     yyy]xxx
// ===
//   xxx[yyy
//   yyyyyyy
//   yyyyyyy
//   yyy]xxx
// ===

const deindentLine = (str: string) => str.replace(/^ /, '').replace(/^ /, '')

export const deindent: TextTransformer = (state) => {
  const lines = state.split('\n')

  const cursorStartAt = lines.findIndex((line) => line.includes(START))
  const cursorEndAt = lines.findIndex((line) => line.includes(END))

  for (let i = cursorStartAt; i <= cursorEndAt; i++) {
    const line = lines[i]
    lines[i] = deindentLine(line)
  }

  return lines.join('\n')
}
