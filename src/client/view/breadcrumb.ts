import { Disposable } from '../../common/disposable'
import { h } from '../util/dom'
import { Router } from '../util/router'
import { ViewController } from '../util/view_controller'
import './breadcrumb.css'

/**
 * Displays the current note path as a clickable breadcrumb (a / b / c).
 * Each segment except the last navigates to that ancestor note.
 * The last segment is the current note title — rendered with full ink color.
 */
export class Breadcrumb extends Disposable implements ViewController {
  dom: HTMLElement
  private id: string
  constructor(id: string) {
    super()
    this.id = id
    this.dom = h('nav', { className: 'breadcrumb', ariaLabel: 'Note path' })
    this.render()
  }

  init() {}

  async setId(newId: string) {
    if (newId === this.id) return
    this.id = newId
    this.render()
  }

  private render() {
    const segments = this.id.split('/').filter(Boolean)
    const children: HTMLElement[] = []

    segments.forEach((segment, i) => {
      const isLast = i === segments.length - 1
      const fullPath = segments.slice(0, i + 1).join('/')

      if (isLast) {
        children.push(h('span', { className: 'breadcrumb-current' }, segment))
      } else {
        children.push(
          h(
            'a',
            {
              className: 'breadcrumb-link',
              href: '/' + fullPath,
              onclick: (e: MouseEvent) => {
                e.preventDefault()
                Router.shared.navigateTo(fullPath)
              },
            },
            segment,
          ),
        )
      }

      if (!isLast) {
        children.push(h('span', { className: 'breadcrumb-sep' }, '/'))
      }
    })

    this.dom.replaceChildren(...children)
  }
}
