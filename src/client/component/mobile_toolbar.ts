import { deindent } from '../lib/transformer/transformers/deindent'
import { indent } from '../lib/transformer/transformers/indent'
import { toggleList } from '../lib/transformer/transformers/toggle_list'
import { h } from '../util/dom'
import { ViewController } from '../util/view_controller'
import { Editor } from './editor'
import './mobile_toolbar.css'

export class MobileToolbar implements ViewController {
  private resizeObserver?: ResizeObserver
  private toolbarHeight = 48

  dom: HTMLElement
  constructor(private editor: Editor) {
    this.dom = h('div', { className: 'mobile-toolbar' }, [
      h('button', {
        className: 'indent',
        textContent: 'Indent',
        onclick: (e: Event) => {
          e.preventDefault()
          this.editor.dom.focus()
          this.editor.transformText(indent)
        },
      }),

      h('button', {
        className: 'deindent',
        textContent: 'Deindent',
        onclick: (e: Event) => {
          e.preventDefault()
          this.editor.dom.focus()
          this.editor.transformText(deindent)
        },
      }),
      h('button', {
        className: 'toggle-list',
        textContent: 'List',
        onclick: (e: Event) => {
          e.preventDefault()
          this.editor.dom.focus()
          this.editor.transformText(toggleList)
        },
      }),
    ])

    // Re-position the toolbar when the viewport changes
    {
      window.visualViewport?.addEventListener('resize', this.rePosition)
      window.visualViewport?.addEventListener('scroll', this.rePosition)
      window.addEventListener('scroll', this.rePosition)
      this.rePosition()
    }

    // Show/hide the toolbar when the editor is focused/blurred
    {
      const $textarea = this.editor.dom
      $textarea.addEventListener('focus', () => {
        this.toggle()
      })
      $textarea.addEventListener('blur', () => {
        setTimeout(() => {
          this.toggle()
        }, 0) // wait a tick in case the textarea is focused again
      })
      this.toggle()
    }
  }
  private toggle = () => {
    const isFocused = document.activeElement === this.editor.dom
    this.dom.style.display = isFocused ? 'flex' : 'none'
  }

  private rePosition = () => {
    const viewport = window.visualViewport!
    const offsetTop = viewport.height + viewport.pageTop
    this.dom.style.top = `${offsetTop - this.toolbarHeight}px`
  }

  destroy() {
    this.resizeObserver?.disconnect()
  }
}
