import { Disposable } from '../../common/disposable'
import { UiStore, ViewMode } from '../store/ui.store'
import { SegmentedControl } from '../ui/segmented_control'
import { ViewController } from '../util/view_controller'

export class ViewModePicker extends Disposable implements ViewController {
  dom: HTMLElement
  control: SegmentedControl
  get mode() {
    return UiStore.shared.viewMode
  }
  constructor() {
    super()
    this.control = new SegmentedControl({
      options: [
        { label: 'Text', value: 'text' },
        { label: 'MD', value: 'markdown' },
        { label: 'HTML', value: 'html' },
      ],
      onChange: (value) => {
        UiStore.shared.setViewMode(value as ViewMode)
      },
      initialValue: this.mode,
    })
    this.dom = this.control.dom
  }
  init() {
    this.register(UiStore.shared.on('viewModeChanged', this.applyViewMode.bind(this)))
    this.applyViewMode()
  }
  applyViewMode() {
    this.control.setValue(this.mode)
  }
}
