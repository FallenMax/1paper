import { ElementProps, h } from '../util/dom'
import { ViewController } from '../util/view_controller'
import './icon_button.css'
import { Svg } from './svg'

export type IconButtonOptions = {
  icon: string
  buttonOptions?: ElementProps<'button'>
}
export class IconButton implements ViewController {
  dom: HTMLElement
  constructor(options: IconButtonOptions) {
    this.dom = h(
      'button',
      {
        className: 'icon-button',
        ...options.buttonOptions,
      },
      [new Svg(options.icon).dom],
    )
  }
  setIcon(icon: string) {
    this.dom.innerHTML = icon
  }
}
