import { icons } from '../icon/icons'
import { UiStore } from '../store/ui.store'
import { Select } from '../ui/select'
import { ViewController } from '../util/view_controller'

export class RecentList implements ViewController {
  dom: HTMLElement
  select: Select
  private id: string
  constructor(id: string) {
    this.id = id
    this.select = new Select({
      options: [],
      onChange: (value) => {
        switch (value) {
          case 'clear-recent': {
            UiStore.shared.clearRecentVisited()
            this.applyRecentVisited()
            break
          }
          default: {
            if (value.startsWith('recent:')) {
              location.assign('/' + value.slice(7))
            }
            break
          }
        }
        this.select.setValue('current')
      },
      initialValue: '',
      label: 'Recent',
      icon: icons.timeOutline,
    })
    this.dom = this.select.dom
  }

  init() {
    UiStore.shared.on('recentVisitedChanged', this.applyRecentVisited.bind(this))
    this.applyRecentVisited()
  }

  private applyRecentVisited() {
    const visited = UiStore.shared.getRecentVisited().filter((id) => id !== this.id)

    if (visited.length > 0) {
      this.select.setOptions([
        ...visited.map((id) => ({ label: `📄 ${id}`, value: `recent:${id}` })),
        { label: '🗑️ Clear recent', value: 'clear-recent' },
      ])
    } else {
      this.select.setOptions([{ label: '(Empty)', value: '(Empty)', disabled: true }])
    }
  }
}
