import { EventEmitter } from '../../common/event'
import { listenDom } from '../util/dom'

import { Storage } from '../util/storage'

export type Theme = 'light' | 'dark' | 'system'

export type ViewMode = 'text' | 'markdown' | 'html'

export type LayoutWidth = 'normal' | 'wide'

export const uiStorage = new Storage<{
  theme: 'light' | 'dark' | 'system'
  treeVisible: boolean
  layoutWidth: LayoutWidth
}>('ui')

export class UiStore extends EventEmitter<{
  themeChanged: Theme
  viewModeChanged: ViewMode
  treeVisibilityChanged: boolean
  layoutWidthChanged: LayoutWidth
}> {
  static shared = new UiStore()
  get viewMode(): ViewMode {
    const url = new URL(location.href)
    const searchParams = url.searchParams
    const view = searchParams.get('view') ?? 'text'
    return view as ViewMode
  }
  constructor() {
    super()
    this.register(
      listenDom(window, 'storage', (e) => {
        if (e.key === uiStorage.prefixed('theme')) {
          this.emit('themeChanged', e.newValue as Theme)
        } else if (e.key === uiStorage.prefixed('treeVisible')) {
          this.emit('treeVisibilityChanged', uiStorage.get('treeVisible') ?? true)
        } else if (e.key === uiStorage.prefixed('layoutWidth')) {
          this.emit('layoutWidthChanged', uiStorage.get('layoutWidth') ?? 'normal')
        }
      }),
    )
  }
  //-------------- Theme  --------------
  getTheme() {
    return uiStorage.get('theme') ?? 'system'
  }
  getComputedTheme(): 'light' | 'dark' {
    const theme = this.getTheme()
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return theme
  }
  setTheme(theme: 'light' | 'dark' | 'system') {
    uiStorage.set('theme', theme)
    this.emit('themeChanged', theme)
  }
  //-------------- View mode --------------
  setViewMode(viewMode: ViewMode) {
    const url = new URL(location.href)
    const searchParams = url.searchParams
    if (viewMode === 'markdown') {
      searchParams.set('view', 'markdown')
    } else if (viewMode === 'html') {
      searchParams.set('view', 'html')
    } else {
      searchParams.delete('view')
    }
    url.search = searchParams.toString()
    history.replaceState(null, '', url.href)

    this.emit('viewModeChanged', viewMode)
  }
  //-------------- Sidebar (Tree) --------------
  isTreeVisible() {
    return uiStorage.get('treeVisible') ?? false
  }
  setTreeVisible(visible: boolean) {
    uiStorage.set('treeVisible', visible)
    this.emit('treeVisibilityChanged', visible)
  }
  //-------------- Layout Width --------------
  getLayoutWidth(): LayoutWidth {
    return uiStorage.get('layoutWidth') ?? 'normal'
  }
  setLayoutWidth(width: LayoutWidth) {
    uiStorage.set('layoutWidth', width)
    this.emit('layoutWidthChanged', width)
  }
}
