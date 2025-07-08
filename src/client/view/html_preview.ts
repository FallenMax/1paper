import { Disposable } from '../../common/disposable'
import { h } from '../util/dom'
import { ViewController } from '../util/view_controller'
import { Editor } from './editor'
import './html_preview.css'

export class HtmlPreview extends Disposable implements ViewController {
  dom: HTMLIFrameElement
  constructor(private editor: Editor) {
    super()
    this.dom = h(
      'iframe',
      {
        className: 'html-preview',
        // @ts-expect-error
        sandbox: 'allow-scripts',
        referrerPolicy: 'no-referrer',
      },
      [],
    )

    editor.on('localNoteUpdated', this.render)
    this.render()
  }

  private render = () => {
    const value = this.editor.localNote
    this.dom.srcdoc = value
  }

  setEditor(editor: Editor) {
    this.editor.off('localNoteUpdated', this.render)
    this.editor = editor
    this.editor.on('localNoteUpdated', this.render)
    this.render()
  }
}
