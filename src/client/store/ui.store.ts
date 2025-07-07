import { EventEmitter } from '../../common/event'

import { Storage } from '../util/storage'

export type Theme = 'light' | 'dark' | 'system'

export type ViewMode = 'text' | 'markdown' | 'html'

export const uiStorage = new Storage<{
  recent: string[]
  theme: 'light' | 'dark' | 'system'
  treeVisible: boolean
}>('ui')

export class UiStore extends EventEmitter<{
  themeChanged: Theme
  viewModeChanged: ViewMode
  recentVisitedChanged: string[]
  treeVisibilityChanged: boolean
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
    window.addEventListener('storage', (e) => {
      if (e.key === uiStorage.prefixed('theme')) {
        this.emit('themeChanged', e.newValue as Theme)
      } else if (e.key === uiStorage.prefixed('recent')) {
        this.emit('recentVisitedChanged', uiStorage.get('recent') ?? [])
      } else if (e.key === uiStorage.prefixed('treeVisible')) {
        this.emit('treeVisibilityChanged', uiStorage.get('treeVisible') ?? true)
      }
    })
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
  //-------------- Recent --------------
  markVisited(id: string) {
    const visited = uiStorage.get('recent') ?? []
    const existIndex = visited.indexOf(id)
    if (existIndex !== -1) {
      visited.splice(existIndex, 1)
    }
    visited.unshift(id)
    uiStorage.set('recent', visited)
  }

  getRecentVisited(): string[] {
    return uiStorage.get('recent') ?? []
  }

  clearRecentVisited() {
    uiStorage.remove('recent')
  }
  //-------------- Sidebar (Tree) --------------
  isTreeVisible() {
    return uiStorage.get('treeVisible') ?? false
  }
  setTreeVisible(visible: boolean) {
    uiStorage.set('treeVisible', visible)
    this.emit('treeVisibilityChanged', visible)
  }
}
