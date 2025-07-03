export const $$ = (el: HTMLElement | Document, selector: string) => {
  const arr = Array.from(el.querySelectorAll(selector))
  return arr as HTMLElement[]
}
export const $ = (el: HTMLElement | Document, selector: string): HTMLElement => {
  return el.querySelector(selector)!
}

type Override<T, R> = Omit<T, keyof R> & R

export type ElementProps<K extends keyof HTMLElementTagNameMap> = Override<
  Partial<HTMLElementTagNameMap[K]>,
  { style?: Partial<CSSStyleDeclaration>; dataset?: Record<string, string> }
>
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: ElementProps<K>,
  children?: (HTMLElement | undefined | string)[] | string | undefined,
): HTMLElementTagNameMap[K]
export function h(
  tag: string,
  props?: Override<Partial<HTMLElement>, { style?: Partial<CSSStyleDeclaration>; dataset?: Record<string, string> }>,
  children?: (HTMLElement | undefined | string)[] | string | undefined,
): HTMLElement {
  const $el = document.createElement(tag)

  if (props) {
    const { style, dataset, ...rest } = props
    Object.assign($el, rest)
    if (style) {
      Object.assign($el.style, style)
    }
    if (dataset) {
      Object.assign($el.dataset, dataset)
    }
  }

  if (children) {
    if (Array.isArray(children)) {
      $el.append(...children.filter((c) => c !== undefined))
    } else {
      $el.textContent = children
    }
  }

  return $el
}
