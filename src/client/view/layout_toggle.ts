import { Disposable } from '../../common/disposable'
import { icons } from '../icon/icons'
import { LayoutWidth, UiStore } from '../store/ui.store'
import { IconButton } from '../ui/icon_button'
import { ViewController } from '../util/view_controller'

export class LayoutToggle extends Disposable implements ViewController {
  dom: HTMLElement
  get layoutWidth(): LayoutWidth {
    return UiStore.shared.getLayoutWidth()
  }
  constructor() {
    super()
    this.dom = new IconButton({
      icon: this.getIcon(),
      buttonOptions: {
        title: this.getTitle(),
        onclick: () => {
          const newWidth = this.layoutWidth === 'normal' ? 'wide' : 'normal'
          UiStore.shared.setLayoutWidth(newWidth)
        },
      },
    }).dom
  }
  init() {
    this.register(
      UiStore.shared.on('layoutWidthChanged', () => {
        this.applyLayoutWidth()
      }),
    )
    this.applyLayoutWidth()
  }

  private getIcon(): string {
    return icons.resizeOutline
  }

  private getTitle(): string {
    return this.layoutWidth === 'normal' ? 'Switch to wide layout' : 'Switch to normal layout'
  }

  private applyLayoutWidth() {
    this.dom.innerHTML = this.getIcon()
    this.dom.title = this.getTitle()
  }
}
