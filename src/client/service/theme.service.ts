import { EventEmitter } from '../../common/event'
import { metaStorage } from './meta.storage'

export type Theme = 'light' | 'dark' | 'system'

export class ThemeService extends EventEmitter<{
  themeChanged: Theme
}> {
  constructor() {
    super()
    window.addEventListener('storage', (e) => {
      if (e.key === metaStorage.prefixed('theme')) {
        this.emit('themeChanged', e.newValue as Theme)
      }
    })
  }
  getTheme() {
    return metaStorage.get('theme') ?? 'system'
  }
  getComputedTheme(): 'light' | 'dark' {
    const theme = this.getTheme()
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return theme
  }
  setTheme(theme: 'light' | 'dark' | 'system') {
    metaStorage.set('theme', theme)
    this.emit('themeChanged', theme)
  }
}
