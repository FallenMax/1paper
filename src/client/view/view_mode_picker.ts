import { Disposable } from '../../common/disposable'
import { icons } from '../icon/icons'
import { UiStore, ViewMode } from '../store/ui.store'
import { Select } from '../ui/select'
import { ViewController } from '../util/view_controller'

export class ViewModePicker extends Disposable implements ViewController {
  dom: HTMLElement
  select: Select
  get mode() {
    return UiStore.shared.viewMode
  }
  constructor() {
    super()
    this.select = new Select({
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Markdown', value: 'markdown' },
        { label: 'HTML', value: 'html' },
      ],
      onChange: (value) => {
        UiStore.shared.setViewMode(value as ViewMode)
      },
      initialValue: this.mode,
      label: 'View Mode',
      icon: icons.eyeOutline,
    })
    this.dom = this.select.dom
  }
  init() {
    this.register(UiStore.shared.on('viewModeChanged', this.applyViewMode.bind(this)))
    this.applyViewMode()
  }
  applyViewMode() {
    this.select.setValue(this.mode)
    this.select.setIcon(this.mode === 'text' ? icons.eyeOutline : icons.eye)
  }
}
