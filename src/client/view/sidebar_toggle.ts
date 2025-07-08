import { Disposable } from '../../common/disposable'
import { icons } from '../icon/icons'
import { UiStore } from '../store/ui.store'
import { IconButton } from '../ui/icon_button'
import { ViewController } from '../util/view_controller'

export class SidebarToggle extends Disposable implements ViewController {
  dom: HTMLElement
  get isTreeVisible() {
    return UiStore.shared.isTreeVisible()
  }
  constructor() {
    super()
    this.dom = new IconButton({
      icon: this.isTreeVisible ? icons.folder : icons.folderOutline,
      buttonOptions: {
        title: 'Tree',
        onclick: () => {
          UiStore.shared.setTreeVisible(!this.isTreeVisible)
        },
      },
    }).dom
  }
  init() {
    this.register(
      UiStore.shared.on('treeVisibilityChanged', () => {
        this.applyExpandState()
      }),
    )
    this.applyExpandState()
  }

  applyExpandState() {
    this.dom.innerHTML = this.isTreeVisible ? icons.folder : icons.folderOutline
  }
}
