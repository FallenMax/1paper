import { Disposable } from '../../common/disposable'
import { icons } from '../icon/icons'
import { deindent } from '../lib/transformer/transformers/deindent'
import { indent } from '../lib/transformer/transformers/indent'
import { toggleList } from '../lib/transformer/transformers/toggle_list'
import { IconButton } from '../ui/icon_button'
import { h, listenDom } from '../util/dom'
import { ViewController } from '../util/view_controller'
import { Editor } from './editor'
import './mobile_toolbar.css'

export class MobileToolbar extends Disposable implements ViewController {
  private resizeObserver?: ResizeObserver
  private toolbarHeight = 48

  dom: HTMLElement
  private $indent: IconButton
  private $deindent: IconButton
  private $toggleList: IconButton
  constructor(private editor: Editor) {
    super()
    this.$indent = new IconButton({
      icon: icons.chevronForwardOutline,
      buttonOptions: {
        title: 'Indent',
        onclick: (e: Event) => {
          e.preventDefault()
          this.editor.dom.focus()
          this.editor.transformText(indent)
        },
      },
    })
    this.$deindent = new IconButton({
      icon: icons.chevronBackOutline,
      buttonOptions: {
        title: 'Deindent',
        onclick: (e: Event) => {
          e.preventDefault()
          this.editor.dom.focus()
          this.editor.transformText(deindent)
        },
      },
    })
    this.$toggleList = new IconButton({
      icon: icons.listOutline,
      buttonOptions: {
        title: 'Toggle list',
        onclick: (e: Event) => {
          e.preventDefault()
          this.editor.dom.focus()
          this.editor.transformText(toggleList)
        },
      },
    })
    this.dom = h('div', { className: 'mobile-toolbar' }, [this.$deindent.dom, this.$indent.dom, this.$toggleList.dom])

    // Re-position the toolbar when the viewport changes
    {
      this.register(listenDom(window.visualViewport as any, 'resize', this.rePosition))
      this.register(listenDom(window.visualViewport as any, 'scroll', this.rePosition))
      this.register(listenDom(window, 'scroll', this.rePosition))
      this.rePosition()
    }

    // Show/hide the toolbar when the editor is focused/blurred
    {
      const $textarea = this.editor.dom
      this.register(
        listenDom($textarea, 'focus', () => {
          this.toggle()
        }),
      )
      this.register(
        listenDom($textarea, 'blur', () => {
          setTimeout(() => {
            this.toggle()
          }, 0) // wait a tick in case the textarea is focused again
        }),
      )
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

  setEditor(editor: Editor) {
    this.editor = editor
  }
}
