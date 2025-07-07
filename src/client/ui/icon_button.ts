import { ElementProps, h } from '../util/dom'
import { ViewController } from '../util/view_controller'
import { Icon } from './icon'
import './icon_button.css'

export type IconButtonOptions = {
  icon: string
  label?: string
  buttonOptions?: ElementProps<'button'>
}
export class IconButton implements ViewController {
  dom: HTMLButtonElement
  constructor(options: IconButtonOptions) {
    this.dom = h(
      'button',
      {
        ...options.buttonOptions,
        className: 'icon-button ' + (options.buttonOptions?.className ?? ''),
      },
      [new Icon(options.icon).dom, options.label],
    )
  }
  setIcon(icon: string) {
    this.dom.innerHTML = icon
  }
}
