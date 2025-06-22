import { h } from '../util/dom'
import { ViewController } from '../util/view_controller'
import { Editor } from './editor'
import './html_preview.css'

export class HtmlPreview implements ViewController {
  dom: HTMLIFrameElement
  constructor(private editor: Editor) {
    this.dom = h(
      'iframe',
      {
        className: 'html-preview',
        // @ts-expect-error
        sandbox: 'allow-scripts',
        referrerPolicy: 'no-referrer',
        style: {
          width: '100%',
          height: '100%',
          border: 'none',
        },
      },
      [],
    )

    editor.on('localNoteUpdated', this.render.bind(this))

    this.render()
  }

  render() {
    const value = this.editor.localNote
    this.dom.srcdoc = value
  }
}
