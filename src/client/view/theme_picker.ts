import { icons } from '../icon/icons'
import { Theme, UiStore } from '../store/ui.store'
import { Select } from '../ui/select'
import { ViewController } from '../util/view_controller'

const themeIcons = {
  light: icons.sunOutline,
  dark: icons.moonOutline,
  system: icons.desktopOutline,
} as const

export class ThemePicker implements ViewController {
  static readonly themes = ['light', 'dark', 'system'] as const
  dom: HTMLElement
  select: Select
  constructor() {
    this.select = new Select({
      icon: icons.sunOutline,
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'System', value: 'system' },
      ],
      onChange: (value) => {
        UiStore.shared.setTheme(value as Theme)
      },
      initialValue: UiStore.shared.getTheme(),
      label: 'Theme',
    })
    this.dom = this.select.dom
  }
  init() {
    UiStore.shared.on('themeChanged', this.applyTheme.bind(this))
    this.applyTheme()
  }
  applyTheme() {
    this.select.setValue(UiStore.shared.getTheme())
    this.select.setIcon(themeIcons[UiStore.shared.getTheme()])
  }
}
