import { h } from '../util/dom'
import { Router } from '../util/router'
import { ViewController } from '../util/view_controller'

export interface LinkOptions {
  href: string
  className?: string
  title?: string
  target?: string
  children?: (HTMLElement | string)[]
}

export class Link implements ViewController {
  dom: HTMLAnchorElement

  constructor(options: LinkOptions) {
    const { href, children, ...anchorProps } = options

    this.dom = h(
      'a',
      {
        ...anchorProps,
        href,
        onclick: (e: MouseEvent) => {
          // Don't intercept if user wants to open in new tab/window
          if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) {
            return
          }

          // Don't intercept if target is set to open elsewhere
          if (options.target && options.target !== '_self') {
            return
          }

          // Only handle relative paths that look like note IDs
          if (href.startsWith('/') && !href.startsWith('//')) {
            e.preventDefault()
            const noteId = decodeURIComponent(href.slice(1))
            Router.shared.navigateTo(noteId)
          }
        },
      },
      children,
    )
  }
}
