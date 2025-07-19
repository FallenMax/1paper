import { Disposable } from '../../common/disposable'
import { icons } from '../icon/icons'
import { IconButton } from '../ui/icon_button'
import { h } from '../util/dom'
import { Router } from '../util/router'
import { ViewController } from '../util/view_controller'
import { LayoutToggle } from './layout_toggle'
import { SidebarToggle } from './sidebar_toggle'
import { ThemePicker } from './theme_picker'
import './top_toolbar.css'
import { ViewModePicker } from './view_mode_picker'

export class TopToolbar extends Disposable implements ViewController {
  dom: HTMLElement
  id: string
  private themePicker: ThemePicker
  private viewModePicker: ViewModePicker
  private sidebarToggle: SidebarToggle
  private layoutToggle: LayoutToggle
  constructor(id: string) {
    super()
    this.id = id
    this.themePicker = new ThemePicker()
    this.viewModePicker = new ViewModePicker()
    this.sidebarToggle = new SidebarToggle()
    this.layoutToggle = new LayoutToggle()

    this.dom = h('div', { className: 'top-toolbar' }, [
      // Sidebar toggle
      this.sidebarToggle.dom,
      // Theme
      this.themePicker.dom,
      // View mode
      this.viewModePicker.dom,
      // Spacer
      h('div'),
      // Layout toggle (desktop only)
      h('div', { className: 'layout-toggle-wrapper' }, [this.layoutToggle.dom]),
      // Add note
      new IconButton({
        icon: icons.addOutline,
        buttonOptions: {
          title: 'Add/open note',
          onclick: () => {
            const newId = window.prompt('Enter a note id to create/open:', this.id)
            if (newId) {
              this.goToNote(newId)
            }
          },
        },
      }).dom,
    ])
  }

  init() {
    this.themePicker.init()
    this.viewModePicker.init()
    this.sidebarToggle.init()
    this.layoutToggle.init()
  }

  async setId(newId: string): Promise<void> {
    this.id = newId
  }

  goToNote(id: string) {
    Router.shared.navigateTo(id)
  }
}
