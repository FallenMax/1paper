import { UiStore, ViewMode } from '../store/ui.store'
import { SegmentedControl } from '../ui/segmented_control'
import { ViewController } from '../util/view_controller'

export class ViewModePickerVC implements ViewController {
  dom: HTMLElement
  segmentedControl: SegmentedControl
  constructor() {
    this.segmentedControl = new SegmentedControl({
      options: [
        { label: 'Text', value: 'text' },
        { label: 'Markdown', value: 'markdown' },
        { label: 'HTML', value: 'html' },
      ],
      onChange: (value) => UiStore.shared.setViewMode(value as ViewMode),
      initialValue: UiStore.shared.viewMode,
    })
    this.dom = this.segmentedControl.dom
  }
  init() {
    UiStore.shared.on('viewModeChanged', (viewMode) => {
      this.segmentedControl.setValue(viewMode)
    })
  }
}
