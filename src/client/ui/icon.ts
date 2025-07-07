import { ViewController } from '../util/view_controller'

export class Icon implements ViewController {
  dom: HTMLElement
  constructor(svgString: string) {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = svgString
    this.dom = wrapper.firstChild as any
  }
}
