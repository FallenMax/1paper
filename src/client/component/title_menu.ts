import { NoteService } from '../service/note.service'
import { h } from '../util/dom'
import { ViewController } from '../util/view_controller'
import './title_menu.css'

export type TitleMenuOptions = {
  onSetTheme: (theme: 'light' | 'dark' | 'system') => void
  onSetViewAs: (viewAs: 'text' | 'markdown' | 'html') => void
}
export class TitleMenu implements ViewController {
  dom!: HTMLSelectElement
  id: string
  private $recentVisited: HTMLOptGroupElement
  private options: TitleMenuOptions
  constructor(id: string, private noteService: NoteService, options: TitleMenuOptions) {
    this.id = id
    this.options = options
    this.dom = h(
      'select',
      {
        className: 'title-menu',
        onchange: (e) => {
          const $option = e.target as HTMLSelectElement
          const value = $option.value
          switch (value) {
            case 'go-to': {
              const newId = window.prompt('Enter a note id to create/open:', this.id)
              if (newId) {
                this.goToNote(newId)
              }
              break
            }
            case 'clear-recent': {
              this.noteService.clearRecentVisited()
              this.applyRecentVisited()
              break
            }
            case 'theme:light':
            case 'theme:dark':
            case 'theme:system': {
              const theme = value.split(':')[1]
              this.options.onSetTheme(theme as 'light' | 'dark' | 'system')
              break
            }
            case 'view-as:text':
            case 'view-as:markdown':
            case 'view-as:html': {
              const viewAs = value.split(':')[1]
              this.options.onSetViewAs(viewAs as 'text' | 'markdown' | 'html')
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
          this.dom.value = 'current'
        },
      },
      [
        h('option', { value: 'current', textContent: this.id }),
        h('option', { value: 'go-to', textContent: '📝 Create or open...' }),
        (this.$recentVisited = h('optgroup', { className: 'recent-visited', label: 'Recent:' })),
        h('optgroup', { className: 'theme', label: 'Theme:' }, [
          h('option', { value: 'theme:light', textContent: 'Light' }),
          h('option', { value: 'theme:dark', textContent: 'Dark' }),
          h('option', { value: 'theme:system', textContent: 'System' }),
        ]),
        h('optgroup', { className: 'view-as', label: 'View as:' }, [
          h('option', { value: 'view-as:text', textContent: 'Text' }),
          h('option', { value: 'view-as:markdown', textContent: 'Markdown' }),
          h('option', { value: 'view-as:html', textContent: 'HTML' }),
        ]),
      ],
    )
  }

  init() {
    this.noteService.markVisited(this.id)
    this.noteService.on('recentVisitedChanged', this.applyRecentVisited.bind(this))
    this.applyRecentVisited()
  }

  goToNote(id: string) {
    location.assign('/' + id)
  }

  applyRecentVisited() {
    const { $recentVisited } = this
    const visited = this.noteService.getRecentVisited().filter((id) => id !== this.id)

    if (visited.length > 0) {
      $recentVisited.replaceChildren(
        ...visited.map((id) => h('option', { value: `recent:${id}`, textContent: `📄 ${id}` })),
        h('option', { value: 'clear-recent', textContent: '🗑️ Clear recent' }),
      )
    } else {
      $recentVisited.replaceChildren(h('option', { value: '(Empty)', textContent: '(Empty)', disabled: true }))
    }
  }
}
