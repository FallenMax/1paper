import { Disposable } from '../../common/disposable'
import { icons } from '../icon/icons'
import { Theme, UiStore } from '../store/ui.store'
import { IconButton } from '../ui/icon_button'
import { ViewController } from '../util/view_controller'

const cycle: Record<Theme, Theme> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
}
const themeIcons: Record<Theme, string> = {
  light: icons.sunOutline,
  dark: icons.moonOutline,
  system: icons.desktopOutline,
}
const themeLabels: Record<Theme, string> = {
  light: 'Theme: light (click for dark)',
  dark: 'Theme: dark (click for system)',
  system: 'Theme: system (click for light)',
}

export class ThemePicker extends Disposable implements ViewController {
  dom: HTMLElement
  private button: IconButton
  constructor() {
    super()
    this.button = new IconButton({
      icon: themeIcons[UiStore.shared.getTheme()],
      buttonOptions: {
        title: themeLabels[UiStore.shared.getTheme()],
        onclick: () => {
          UiStore.shared.setTheme(cycle[UiStore.shared.getTheme()])
        },
      },
    })
    this.dom = this.button.dom
  }
  init() {
    this.register(UiStore.shared.on('themeChanged', this.applyTheme.bind(this)))
    this.applyTheme()
  }
  applyTheme() {
    const theme = UiStore.shared.getTheme()
    this.button.setIcon(themeIcons[theme])
    this.dom.title = themeLabels[theme]
  }
}
