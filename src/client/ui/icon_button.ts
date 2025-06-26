import { ElementProps, h } from '../util/dom'
import { ViewController } from '../util/view_controller'
import './icon_button.css'
import { Svg } from './svg'

export type IconButtonOptions = {
  icon: string
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
      [new Svg(options.icon).dom],
    )
  }
  setIcon(icon: string) {
    this.dom.innerHTML = icon
  }
}
