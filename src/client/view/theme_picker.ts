import { icons } from '../icon/icons'
import { UiStore } from '../store/ui.store'
import { IconButton } from '../ui/icon_button'
import { ViewController } from '../util/view_controller'

const themeIcons = {
  light: icons.sunOutline,
  dark: icons.moonOutline,
  system: icons.desktopOutline,
} as const

export class ThemePicker implements ViewController {
  static readonly themes = ['light', 'dark', 'system'] as const
  dom: HTMLElement
  private iconButton: IconButton
  constructor() {
    this.iconButton = new IconButton({
      icon: icons.sunOutline,
      buttonOptions: {
        title: 'Theme',
        onclick: () => {
          const index = ThemePicker.themes.indexOf(UiStore.shared.getTheme())
          const nextIndex = (index + 1) % ThemePicker.themes.length
          UiStore.shared.setTheme(ThemePicker.themes[nextIndex])
        },
      },
    })
    this.dom = this.iconButton.dom
  }
  init() {
    UiStore.shared.on('themeChanged', this.applyTheme.bind(this))
    this.applyTheme()
  }
  applyTheme() {
    const theme = UiStore.shared.getTheme()
    this.iconButton.setIcon(themeIcons[theme])
  }
}
