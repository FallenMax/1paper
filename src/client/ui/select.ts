import { h } from '../util/dom'
import { ViewController } from '../util/view_controller'
import { Icon } from './icon'
import './select.css'

export type OptionItem = {
  label: string
  value: string
  disabled?: boolean
}

export type SelectOptions = {
  options: OptionItem[]
  onChange: (value: string) => void
  initialValue: string
  label?: string
  icon?: string
}

const PLACEHOLDER_VALUE = '__current'
export class Select implements ViewController {
  dom: HTMLElement
  private options: OptionItem[]
  private value: string
  private $select: HTMLSelectElement
  private label: string
  private icon?: Icon
  constructor({ options, onChange, initialValue, label, icon }: SelectOptions) {
    this.value = initialValue ?? PLACEHOLDER_VALUE
    this.options = options
    this.label = label ?? ''
    this.dom = h('div', { className: 'select-wrapper', title: label }, [
      (this.icon = icon ? new Icon(icon) : undefined)?.dom,
      (this.$select = h('select', {
        onchange: (e) => {
          const $select = e.target as HTMLSelectElement
          const value = $select.value
          e.preventDefault()
          e.stopPropagation()

          $select.value = this.value ?? PLACEHOLDER_VALUE
          if (value === PLACEHOLDER_VALUE) {
            return
          }

          onChange(value)
        },
      })),
    ])
    this.apply()
  }
  setIcon(icon: string) {
    if (this.icon) {
      this.icon.dom.remove()
    }
    this.icon = new Icon(icon)
    this.dom.prepend(this.icon.dom)
  }
  setOptions(options: OptionItem[]) {
    this.options = options
    this.applyOptions()
  }
  setValue(value: string) {
    this.value = value
    this.applyValue()
  }
  private apply() {
    this.applyOptions()
    this.applyValue()
  }
  private applyOptions() {
    const $options = [
      h('option', { value: PLACEHOLDER_VALUE }, this.label ? `(${this.label})` : ''),
      ...this.options.map((option) => h('option', { value: option.value, disabled: option.disabled }, option.label)),
    ]
    this.$select.replaceChildren(...$options)
    if (!this.options.some((option) => option.value === this.value)) {
      this.setValue(PLACEHOLDER_VALUE)
    }
  }
  private applyValue() {
    this.$select.value = this.value
  }
}
