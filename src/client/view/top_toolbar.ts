import { Disposable } from '../../common/disposable'
import { icons } from '../icon/icons'
import { IconButton } from '../ui/icon_button'
import { h, listenDom } from '../util/dom'
import { Router } from '../util/router'
import { ViewController } from '../util/view_controller'
import { SidebarToggle } from './sidebar_toggle'
import { ThemePicker } from './theme_picker'
import './top_toolbar.css'
import { ViewModePicker } from './view_mode_picker'

export class TopToolbar extends Disposable implements ViewController {
  dom: HTMLElement
  id: string
  private $toggleButton: HTMLButtonElement
  private themePicker: ThemePicker
  private viewModePicker: ViewModePicker
  private $controls: HTMLElement
  private sidebarToggle: SidebarToggle
  private isExpanded = false
  constructor(id: string) {
    super()
    this.id = id
    this.themePicker = new ThemePicker()
    this.viewModePicker = new ViewModePicker()
    this.sidebarToggle = new SidebarToggle()

    this.dom = h('div', { className: 'top-toolbar' }, [
      // Menu toggle
      (this.$toggleButton = new IconButton({
        icon: icons.menuOutline,
        buttonOptions: {
          className: 'menu-toggle',
          title: 'Menu',
          onclick: () => {
            this.isExpanded = !this.isExpanded
            this.applyExpandState()
          },
        },
      }).dom),
      // Controls
      (this.$controls = h('div', { className: 'controls' }, [
        h('div', { className: 'controls-inner' }, [
          // Sidebar toggle
          this.sidebarToggle.dom,
          // Theme
          this.themePicker.dom,
          // View mode
          this.viewModePicker.dom,
          // Spacer
          h('div'),
        ]),
      ])),
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
    const actualControlWidth = this.$controls.firstElementChild!.clientWidth
    this.$controls.style.setProperty('--max-width', actualControlWidth + 'px')
    this.register(
      listenDom(this.$controls, 'transitionend', (e) => {
        if (!this.isExpanded) {
          this.$controls.remove()
        }
      }),
    )
    this.applyExpandState()
  }

  async setId(newId: string): Promise<void> {
    this.id = newId
  }

  goToNote(id: string) {
    Router.shared.navigateTo(id)
  }

  private applyExpandState() {
    if (this.isExpanded) {
      if (!this.dom.contains(this.$controls)) {
        this.$toggleButton.after(this.$controls)
      }
    }
    setTimeout(() => {
      this.dom.classList.toggle('is-expanded', this.isExpanded)
      this.$toggleButton.innerHTML = this.isExpanded ? icons.closeOutline : icons.menuOutline
      this.$toggleButton.title = this.isExpanded ? 'Close' : 'Menu'
    }, 0)
  }
}
