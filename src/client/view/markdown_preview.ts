import markdownit from 'markdown-it'
import { Disposable } from '../../common/disposable'
import { UiStore } from '../store/ui.store'
import { h } from '../util/dom'
import { ViewController } from '../util/view_controller'
import { Editor } from './editor'
import './markdown_preview.css'

const darkCssPromise = import('github-markdown-css/github-markdown-dark.css?raw').then((m) => m.default)
const lightCssPromise = import('github-markdown-css/github-markdown-light.css?raw').then((m) => m.default)

export class MarkdownPreview extends Disposable implements ViewController {
  static md = markdownit({
    linkify: true,
  })
  dom: HTMLElement
  $css: HTMLStyleElement

  constructor(private editor: Editor) {
    super()
    this.dom = h('div', { className: 'markdown-preview markdown-body' }, [])

    this.register(UiStore.shared.on('themeChanged', this.applyTheme.bind(this)))
    this.$css = document.createElement('style')
    this.$css.id = 'markdown-preview-css'
    document.head.appendChild(this.$css)

    editor.on('localNoteUpdated', this.render)
    this.render()

    this.applyTheme()
  }

  private render = () => {
    const value = this.editor.localNote
    const result = MarkdownPreview.md.render(value)
    this.dom.innerHTML = result
  }

  setEditor(editor: Editor) {
    this.editor.off('localNoteUpdated', this.render)
    this.editor = editor
    this.editor.on('localNoteUpdated', this.render)
    this.render()
  }

  private async applyTheme() {
    const theme = UiStore.shared.getComputedTheme()
    this.$css.textContent = await (theme === 'dark' ? darkCssPromise : lightCssPromise)
  }
}
