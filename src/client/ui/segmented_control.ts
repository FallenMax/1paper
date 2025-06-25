import { h } from '../util/dom'
import { ViewController } from '../util/view_controller'
import './segmented_control.css'

export type SegmentedControlOptions = {
  options: {
    label: string
    value: string
  }[]
  onChange: (value: string) => void
  initialValue: string
}
export class SegmentedControl implements ViewController {
  dom: HTMLElement
  private options: SegmentedControlOptions
  private value: string
  constructor(options: SegmentedControlOptions) {
    this.value = options.initialValue
    this.options = options
    this.dom = h('div', { className: 'segmented-control' }, [
      ...options.options.map((option) =>
        h('button', { className: option.value, onclick: () => options.onChange(option.value) }, option.label),
      ),
    ])
    this.apply()
  }
  setValue(value: string) {
    this.value = value
    this.apply()
  }
  private apply() {
    const $buttons = this.dom.querySelectorAll('button')
    for (const $button of $buttons) {
      $button.classList.toggle('is-active', $button.classList.contains(this.value))
    }
  }
}
