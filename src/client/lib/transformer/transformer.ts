import { TextTransformer } from './transformer.type'
import { addNewLine } from './transformers/add_new_line'
import { backDeleteToStart } from './transformers/backdelete_to_start'
import { deindent } from './transformers/deindent'
import { indent } from './transformers/indent'
import { toggleList } from './transformers/toggle_list'

export function getTransformer(e: KeyboardEvent, hasSelection: boolean): TextTransformer | undefined {
  const { key, shiftKey } = e
  let transformer: TextTransformer | undefined
  if (key === 'Enter') {
    transformer = addNewLine
  } else if (key === 'Backspace') {
    transformer = backDeleteToStart
  } else if (key === 'Tab') {
    transformer = shiftKey ? deindent : indent
  } else if (key === '-') {
    if (hasSelection) transformer = toggleList
  }

  return transformer
}
