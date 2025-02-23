import { assert } from '../../common/assert'

export class TitleMenu {
  constructor(private $titleMenu: HTMLSelectElement, private id: string) {}

  init() {
    const $current = this.$titleMenu.querySelector(`option[value="current"]`)!
    if (!$current.textContent) {
      $current.textContent = this.id
    }

    // show recent visited
    {
      this.saveRecentVisited()
      this.renderRecentVisited()
      window.addEventListener('storage', (e) => {
        if (e.key === 'visited') {
          this.renderRecentVisited()
        }
      })
    }

    // handle user action
    this.$titleMenu.addEventListener('change', (e) => {
      const $option = e.target as HTMLSelectElement
      const value = $option.value
      if (value === 'go-to') {
        const newId = window.prompt('Enter a note id to create/open:', this.id)
        if (newId) {
          this.goToNote(newId)
        }
      } else if (value === 'clear-recent') {
        this.clearRecentVisited()
        this.renderRecentVisited()
      } else if (value.startsWith('recent:')) {
        this.goToNote(value.slice(7))
      }
      e.preventDefault()
      e.stopPropagation()
      this.$titleMenu.value = 'current'
    })
  }

  goToNote(id: string) {
    location.assign('/' + id)
  }

  renderRecentVisited() {
    const visited = this.loadRecentVisited().filter((id) => id !== this.id)
    const $recentVisited = this.$titleMenu.querySelector('.recent-visited')!
    $recentVisited.innerHTML = ''
    if (visited.length > 0) {
      visited.forEach((id) => {
        const $option = document.createElement('option')
        $option.value = `recent:${id}`
        $option.textContent = `📄 ${id}`
        $recentVisited.appendChild($option)
      })
      const $clear = document.createElement('option')
      $clear.value = 'clear-recent'
      $clear.textContent = '🗑️ Clear recent'
      $recentVisited.appendChild($clear)
    } else {
      const $option = document.createElement('option')
      $option.value = '(Empty)'
      $option.textContent = '(Empty)'
      $option.disabled = true
      $recentVisited.appendChild($option)
    }
  }

  saveRecentVisited() {
    const visited = this.loadRecentVisited()
    const existIndex = visited.findIndex((id) => id === this.id)
    if (existIndex !== -1) {
      visited.splice(existIndex, 1)
    }
    visited.unshift(this.id)
    try {
      localStorage.setItem('visited', JSON.stringify(visited))
    } catch (error) {}
  }

  loadRecentVisited(): string[] {
    let visited: string[]
    try {
      visited = JSON.parse(localStorage.getItem('visited') || '[]')
      assert(
        Array.isArray(visited) && visited.every((id) => typeof id === 'string'),
        'expect visited to be an array of strings',
      )
      visited = visited.slice(0, 20)
    } catch (error) {
      visited = []
    }
    return visited
  }
  clearRecentVisited() {
    try {
      localStorage.removeItem('visited')
    } catch (error) {}
  }
}
