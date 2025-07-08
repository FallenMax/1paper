import { ClientAPI, ServerAPI } from '../common/api.type'
import { Disposable } from '../common/disposable'
import { generatePageId } from '../common/lib/generate_id'
import './app.css'
import { RpcClient } from './lib/rpc_client'
import { NoteService } from './service/note.service'
import { UiStore } from './store/ui.store'
import { h, listenDom } from './util/dom'
import { isMobile } from './util/env'
import { Router } from './util/router'
import { ViewController } from './util/view_controller'
import { Editor } from './view/editor'
import { HtmlPreview } from './view/html_preview'
import { MarkdownPreview } from './view/markdown_preview'
import { MobileToolbar } from './view/mobile_toolbar'
import { Sidebar } from './view/sidebar'
import { TopToolbar } from './view/top_toolbar'

class App extends Disposable implements ViewController {
  dom: HTMLElement
  private rpcClient: RpcClient<ServerAPI, ClientAPI>
  private noteService: NoteService
  private editor: Editor
  private markdownPreview?: MarkdownPreview
  private htmlPreview?: HtmlPreview
  private mobileToolbar: MobileToolbar | undefined
  private topToolbar: TopToolbar
  private sidebar: Sidebar
  private id: string
  private $saveStatus: HTMLElement
  private $main: HTMLElement
  private isDisconnected = false
  private isSaving = false

  constructor(id: string) {
    super()
    this.id = id

    this.rpcClient = this.register(
      new RpcClient<ServerAPI, ClientAPI>({
        noteUpdate: (payload) => {
          this.noteService.emit('noteUpdate', payload)
        },
      }),
    )

    this.noteService = this.register(new NoteService(this.rpcClient))

    this.topToolbar = this.register(new TopToolbar(id))
    this.sidebar = this.register(new Sidebar(id, this.noteService))

    this.editor = new Editor({
      id,
      noteService: this.noteService,
      onSaveStatusChange: (isSaving) => {
        this.isSaving = isSaving
        this.applySaveStatus()
      },
    })

    if (isMobile) {
      this.mobileToolbar = this.register(new MobileToolbar(this.editor))
    }

    this.dom = h('div', { id: 'app' }, [
      h('header', {}, [
        this.topToolbar.dom,
        h('div', { className: 'spacer' }),
        (this.$saveStatus = h('span', { className: 'save-status' }, 'Saving...')),
      ]),
      (this.$main = h('main', {}, [this.editor.dom, this.sidebar.dom])),
      this.mobileToolbar?.dom,
    ])
  }

  init() {
    document.documentElement.classList.toggle('mobile', isMobile)

    this.register(
      this.rpcClient.on('connected', () => {
        this.isDisconnected = false
        this.applySaveStatus()
      }),
    )

    this.register(
      this.rpcClient.on('disconnected', () => {
        this.isDisconnected = true
        this.applySaveStatus()
      }),
    )

    this.editor.init()
    this.topToolbar.init()
    this.sidebar.init()

    this.register(UiStore.shared.on('themeChanged', this.applyTheme.bind(this)))
    this.register(
      listenDom(window.matchMedia('(prefers-color-scheme: dark)') as any, 'change', this.applyTheme.bind(this)),
    )
    this.applyTheme()

    this.register(UiStore.shared.on('viewModeChanged', this.applyViewMode.bind(this)))
    this.applyViewMode()
    this.applySaveStatus()

    document.title = `${id} - 1paper`

    this.register(
      Router.shared.on('navigatedTo', (e) => {
        this.setId(e.id)
      }),
    )
  }

  /** Switch to a different note ID using SPA navigation */
  async setId(newId: string): Promise<void> {
    if (newId === this.id) {
      return
    }

    this.id = newId

    // Create new editor
    this.editor.dispose()
    this.editor.dom.remove()
    this.editor = new Editor({
      id: newId,
      noteService: this.noteService,
      onSaveStatusChange: (isSaving) => {
        this.isSaving = isSaving
        this.applySaveStatus()
      },
    })
    await this.editor.init()

    this.markdownPreview?.setEditor(this.editor)
    this.htmlPreview?.setEditor(this.editor)
    this.mobileToolbar?.setEditor(this.editor)
    await this.topToolbar.setId(newId)
    await this.sidebar.setId(newId)
    document.title = `${newId} - 1paper`

    await this.applyViewMode()
  }

  private applySaveStatus() {
    const { $saveStatus } = this
    $saveStatus.classList.toggle('is-saving', this.isSaving || this.isDisconnected)
    $saveStatus.classList.toggle('is-error', this.isDisconnected)
    $saveStatus.textContent = this.isDisconnected ? 'Connecting...' : 'Saving...'
  }
  private async applyViewMode() {
    const viewMode = UiStore.shared.viewMode

    if (viewMode === 'text') {
      if (!this.$main.contains(this.editor.dom)) {
        this.$main.appendChild(this.editor.dom)
      }
    } else {
      this.editor.dom.remove()
    }

    if (viewMode === 'markdown') {
      if (!this.markdownPreview) {
        const { MarkdownPreview } = await import('./view/markdown_preview')
        this.markdownPreview = new MarkdownPreview(this.editor)
      }
      if (!this.$main.contains(this.markdownPreview.dom)) {
        this.$main.appendChild(this.markdownPreview.dom)
      }
    } else {
      this.markdownPreview?.dom.remove()
    }

    if (viewMode === 'html') {
      if (!this.htmlPreview) {
        const { HtmlPreview } = await import('./view/html_preview')
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
    const theme = UiStore.shared.getComputedTheme()
    document.documentElement.dataset.theme = theme
  }
}

const id = decodeURIComponent(location.pathname.slice(1))
if (id === '') {
  location.replace('/' + generatePageId())
} else {
  const app = new App(id)
  document.body.appendChild(app.dom)
  app.init()
}
