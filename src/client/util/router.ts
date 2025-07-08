import { EventEmitter } from '../../common/event'
import { listenDom } from './dom'

export class Router extends EventEmitter<{
  navigatedTo: { id: string }
}> {
  static shared = new Router()

  constructor() {
    super()
    // Handle browser back/forward buttons
    this.register(
      listenDom(window, 'popstate', () => {
        const newId = decodeURIComponent(location.pathname.slice(1))
        this.emit('navigatedTo', { id: newId })
      }),
    )
  }

  async navigateTo(noteId: string): Promise<void> {
    // Preserve search params (like view mode)
    const url = new URL(location.href)
    url.pathname = '/' + noteId
    history.pushState(null, '', url.href)

    this.emit('navigatedTo', { id: noteId })
  }
}
