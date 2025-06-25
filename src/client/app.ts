import { ClientAPI, ServerAPI } from '../common/api.type'
import { generatePageId } from '../common/lib/generate_id'
import './app.css'
import { RpcClient } from './lib/rpc_client'
import { NoteService } from './service/note.service'
import { UiStore } from './store/ui.store'
import { h } from './util/dom'
import { isMobile } from './util/env'
import { ViewController } from './util/view_controller'
import { Editor } from './view/editor'
import { HtmlPreview } from './view/html_preview'
import { MarkdownPreview } from './view/markdown_preview'
import { MobileToolbar } from './view/mobile_toolbar'
import { TopToolbar } from './view/top_toolbar'

class AppVC implements ViewController {
  dom: HTMLElement
  private rpcClient: RpcClient<ServerAPI, ClientAPI>
  private noteService: NoteService
  private editor: Editor
  private markdownPreview?: MarkdownPreview
  private htmlPreview?: HtmlPreview
  private $saveStatus: HTMLElement
  private mobileToolbar: MobileToolbar | undefined
  private topToolbar: TopToolbar
  readonly id: string
  private $main: HTMLElement
  private isDisconnected = false
  private isSaving = false

  constructor(id: string) {
    this.id = id

    this.rpcClient = new RpcClient<ServerAPI, ClientAPI>({
      noteUpdate: (payload) => {
        this.noteService.emit('noteUpdate', payload)
      },
    })

    this.noteService = new NoteService(this.rpcClient)

    this.topToolbar = new TopToolbar(id)

    this.editor = new Editor({
      id,
      noteService: this.noteService,
      onSaveStatusChange: (isSaving) => {
        this.isSaving = isSaving
        this.applySaveStatus()
      },
    })

    if (isMobile) {
      this.mobileToolbar = new MobileToolbar(this.editor)
    }

    const url = `${location.origin}/${id}`
    this.dom = h('div', { id: 'app' }, [
      h('header', {}, [
        this.topToolbar.dom,
        h('div', { className: 'spacer' }),
        // h('a', { href: location.origin + '/' + id, textContent: id, className: 'note-name' }),
        (this.$saveStatus = h('span', { className: 'save-status', textContent: 'Saving...' })),
      ]),
      (this.$main = h('main', {}, [this.editor.dom])),
      h('footer', {}, [h('a', { href: url, target: '_blank' }, url)]),
      this.mobileToolbar?.dom,
    ])
  }

  init() {
    document.documentElement.classList.toggle('mobile', isMobile)

    this.rpcClient.on('connected', () => {
      this.isDisconnected = false
      this.applySaveStatus()
    })
    this.rpcClient.on('disconnected', () => {
      this.isDisconnected = true
      this.applySaveStatus()
    })

    this.editor.init()
    this.topToolbar.init()

    UiStore.shared.on('themeChanged', this.applyTheme.bind(this))
    this.applyTheme()

    UiStore.shared.on('viewModeChanged', this.applyViewMode.bind(this))
    this.applyViewMode()
    this.applySaveStatus

    document.title = `${id} - 1paper`
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
  const app = new AppVC(id)
  document.body.appendChild(app.dom)
  app.init()
}
