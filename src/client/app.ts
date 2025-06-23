import { ClientAPI, ServerAPI } from '../common/api.type'
import { generatePageId } from '../common/lib/generate_id'
import './app.css'
import { Editor } from './component/editor'
import { HtmlPreview } from './component/html_preview'
import { MarkdownPreview } from './component/markdown_preview'
import { MobileToolbar } from './component/mobile_toolbar'
import { TitleMenu } from './component/title_menu'
import { RpcClient } from './lib/rpc_client'
import { NoteService } from './service/note.service'
import { ThemeService } from './service/theme.service'
import { h } from './util/dom'
import { isMobile } from './util/env'
import { ViewController } from './util/view_controller'

class AppVC implements ViewController {
  dom: HTMLElement
  private rpcClient: RpcClient<ServerAPI, ClientAPI>
  private noteService: NoteService
  private themeService = new ThemeService()
  private editor: Editor
  private markdownPreview?: MarkdownPreview
  private htmlPreview?: HtmlPreview
  private $saveStatus: HTMLElement
  private $networkStatus: HTMLElement
  private mobileToolbar: MobileToolbar | undefined
  private titleMenu: TitleMenu
  readonly id: string
  private $main: HTMLElement

  constructor(id: string) {
    this.id = id

    this.rpcClient = new RpcClient<ServerAPI, ClientAPI>({
      noteUpdate: (payload) => {
        this.noteService.emit('noteUpdate', payload)
      },
    })

    this.noteService = new NoteService(this.rpcClient)

    this.titleMenu = new TitleMenu(id, this.noteService, {
      onSetTheme: (theme) => {
        this.themeService.setTheme(theme)
      },
      onSetViewAs: (viewAs) => {
        this.setViewAs(viewAs)
      },
    })

    this.editor = new Editor({
      id,
      noteService: this.noteService,
      onSaveStatusChange: (isSaving) => {
        this.$saveStatus.classList.toggle('is-active', isSaving)
      },
    })

    if (isMobile) {
      this.mobileToolbar = new MobileToolbar(this.editor)
    }

    this.dom = h('div', { id: 'app' }, [
      h('header', {}, [
        this.titleMenu.dom,
        h('div', { className: 'spacer' }),
        (this.$saveStatus = h('small', { className: 'save-status', textContent: 'Saving...' })),
        (this.$networkStatus = h('small', {
          className: 'network-status',
          style: { display: 'none' },
          textContent: 'Connecting...',
        })),
      ]),
      (this.$main = h('main', {}, [this.editor.dom])),
      h('footer'),
      this.mobileToolbar?.dom,
    ])
  }

  init() {
    document.documentElement.classList.toggle('mobile', isMobile)

    this.rpcClient.on('connected', () => {
      this.$networkStatus.style.display = 'none'
    })
    this.rpcClient.on('disconnected', () => {
      this.$networkStatus.style.display = 'block'
    })

    this.editor.init()
    this.titleMenu.init()

    this.themeService.on('themeChanged', this.applyTheme.bind(this))
    this.applyTheme()
    this.applyViewAs()

    document.title = `${id} - 1paper`
  }

  setViewAs(viewAs: 'text' | 'markdown' | 'html') {
    const url = new URL(location.href)
    const searchParams = url.searchParams
    if (viewAs === 'markdown') {
      searchParams.set('view', 'markdown')
    } else if (viewAs === 'html') {
      searchParams.set('view', 'html')
    } else {
      searchParams.delete('view')
    }
    url.search = searchParams.toString()
    history.replaceState(null, '', url.href)
    this.applyViewAs()
  }

  private async applyViewAs() {
    const url = new URL(location.href)
    const searchParams = url.searchParams
    const view = searchParams.get('view')

    if (view === 'markdown') {
      if (!this.markdownPreview) {
        const { MarkdownPreview } = await import('./component/markdown_preview')
        this.markdownPreview = new MarkdownPreview(this.editor, this.themeService)
      }
      if (!this.$main.contains(this.markdownPreview.dom)) {
        this.$main.appendChild(this.markdownPreview.dom)
      }
    } else {
      this.markdownPreview?.dom.remove()
    }

    if (view === 'html') {
      if (!this.htmlPreview) {
        const { HtmlPreview } = await import('./component/html_preview')
        this.htmlPreview = new HtmlPreview(this.editor)
      }
      if (!this.$main.contains(this.htmlPreview.dom)) {
        this.$main.appendChild(this.htmlPreview.dom)
      }
    } else {
      this.htmlPreview?.dom.remove()
    }
  }

  private applyTheme() {
    const theme = this.themeService.getComputedTheme()
    document.documentElement.dataset.theme = theme
  }
}

const id = decodeURIComponent(location.pathname.slice(1))
if (id === '') {
  location.replace('/' + generatePageId())
} else {
  const app = new AppVC(id)
  document.body.appendChild(app.dom)
  app.init()
}
