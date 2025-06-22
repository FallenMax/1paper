import markdownit from 'markdown-it'
import { ThemeService } from '../service/theme.service'
import { h } from '../util/dom'
import { ViewController } from '../util/view_controller'
import { Editor } from './editor'
import './markdown_preview.css'

const darkCssPromise = import('github-markdown-css/github-markdown-dark.css?raw').then((m) => m.default)
const lightCssPromise = import('github-markdown-css/github-markdown-light.css?raw').then((m) => m.default)

export class MarkdownPreview implements ViewController {
  static md = markdownit({})
  dom: HTMLElement
  $css: HTMLStyleElement
  constructor(private editor: Editor, private themeService: ThemeService) {
    this.dom = h('div', { className: 'markdown-preview markdown-body' }, [])

    editor.on('localNoteUpdated', this.render.bind(this))

    this.render()
    this.themeService.on('themeChanged', this.applyTheme.bind(this))
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
    const theme = this.themeService.getComputedTheme()
    this.$css.textContent = await (theme === 'dark' ? darkCssPromise : lightCssPromise)
  }
}
