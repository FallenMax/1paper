import markdownit from 'markdown-it'
import { UiStore } from '../store/ui.store'
import { h } from '../util/dom'
import { ViewController } from '../util/view_controller'
import { Editor } from './editor'
import './markdown_preview.css'

const darkCssPromise = import('github-markdown-css/github-markdown-dark.css?raw').then((m) => m.default)
const lightCssPromise = import('github-markdown-css/github-markdown-light.css?raw').then((m) => m.default)

export class MarkdownPreview implements ViewController {
  static md = markdownit({
    linkify: true,
  })
  dom: HTMLElement
  $css: HTMLStyleElement
  constructor(private editor: Editor) {
    this.dom = h('div', { className: 'markdown-preview markdown-body' }, [])

    editor.on('localNoteUpdated', this.render.bind(this))

    this.render()
    UiStore.shared.on('themeChanged', this.applyTheme.bind(this))
    this.$css = document.createElement('style')
    this.$css.id = 'markdown-preview-css'
    document.head.appendChild(this.$css)
    this.applyTheme()
  }

  render() {
    const value = this.editor.localNote
    const result = MarkdownPreview.md.render(value)
    this.dom.innerHTML = result
  }

  private async applyTheme() {
    const theme = UiStore.shared.getComputedTheme()
    this.$css.textContent = await (theme === 'dark' ? darkCssPromise : lightCssPromise)
  }
}
