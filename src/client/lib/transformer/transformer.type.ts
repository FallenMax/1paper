export type EditorState = string

export interface Keys {
  key: string
  shift?: boolean
  ctrl_cmd?: boolean
  alt?: boolean
}

export type TextTransformer = (state: EditorState) => EditorState | undefined

export const START = '\u0000'
export const END = '\u0001'
export const CURSOR = `${START}${END}`
export const SELECTION = `${START}[\\s\\S]*${END}`
export const BULLET = '-'
export const NOT_BULLET = '[^-]'
