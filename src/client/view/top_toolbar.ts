import { icons } from '../icon/icons'
import { uiStorage, UiStore } from '../store/ui.store'
import { IconButton } from '../ui/icon_button'
import { Svg } from '../ui/svg'
import { h } from '../util/dom'
import { ViewController } from '../util/view_controller'
import { ThemePicker } from './theme_picker'
import './top_toolbar.css'
import { ViewModePickerVC } from './view_mode_picker'

export class TopToolbar implements ViewController {
  dom: HTMLElement
  id: string
  private $recentSelect: HTMLSelectElement
  private $toggleButton: HTMLButtonElement
  private themePicker: ThemePicker
  private viewModePicker: ViewModePickerVC
  private $controls: HTMLElement
  constructor(id: string) {
    this.id = id
    this.themePicker = new ThemePicker()
    this.viewModePicker = new ViewModePickerVC()
    this.dom = h('div', { className: 'top-toolbar' }, [
      // Menu toggle
      (this.$toggleButton = h(
        'button',
        {
          className: 'menu-toggle',
          onclick: () => {
            const expanded = uiStorage.get('menuExpanded') ?? false
            uiStorage.set('menuExpanded', !expanded)
            this.applyExpandState()
          },
        },
        [new Svg(icons.menuOutline).dom],
      )),
      // Controls
      (this.$controls = h('div', { className: 'controls' }, [
        h('div', { className: 'controls-inner' }, [
          // Recent
          h('div', { className: 'recent-visited-wrapper', title: 'Recent' }, [
            new Svg(icons.fileTrayOutline).dom,
            (this.$recentSelect = h('select', {
              className: 'recent-visited',
              onchange: (e) => {
                const $select = e.target as HTMLSelectElement
                const value = $select.value
                switch (value) {
                  case 'clear-recent': {
                    UiStore.shared.clearRecentVisited()
                    this.applyRecentVisited()
                    break
                  }
                  default: {
                    if (value.startsWith('recent:')) {
                      this.goToNote(value.slice(7))
                    }
                    break
                  }
                }
                e.preventDefault()
                e.stopPropagation()
                $select.value = 'current'
              },
            })),
          ]),
          // Theme
          this.themePicker.dom,
          // View mode
          this.viewModePicker.dom,
          // Spacer
          h('div', { style: { width: '4px' } }),
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
    UiStore.shared.markVisited(this.id)

    UiStore.shared.on('recentVisitedChanged', this.applyRecentVisited.bind(this))
    this.applyRecentVisited()

    this.applyExpandState()

    this.themePicker.init()
    this.viewModePicker.init()

    const actualControlWidth = this.$controls.firstElementChild!.clientWidth
    this.$controls.style.setProperty('--max-width', actualControlWidth + 'px')
  }

  goToNote(id: string) {
    location.assign('/' + id)
  }

  private applyExpandState() {
    const expanded = uiStorage.get('menuExpanded') ?? false
    this.dom.classList.toggle('is-expanded', expanded)
    this.$toggleButton.innerHTML = expanded ? icons.closeOutline : icons.menuOutline
    this.$toggleButton.title = expanded ? 'Close' : 'Menu'
  }

  private applyRecentVisited() {
    const { $recentSelect } = this
    const visited = UiStore.shared.getRecentVisited().filter((id) => id !== this.id)

    if (visited.length > 0) {
      $recentSelect.replaceChildren(
        h('option', { value: 'current', textContent: 'Recent:' }),
        ...visited.map((id) => h('option', { value: `recent:${id}`, textContent: `📄 ${id}` })),
        h('option', { value: 'clear-recent', textContent: '🗑️ Clear recent' }),
      )
    } else {
      $recentSelect.replaceChildren(
        h('option', { value: 'current', textContent: 'Recent:' }),
        h('option', { value: '(Empty)', textContent: '(Empty)', disabled: true }),
      )
    }
  }
}
