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
import { Breadcrumb } from './view/breadcrumb'
import { Editor, SaveStatus } from './view/editor'
import { HtmlPreview } from './view/html_preview'
import { LayoutToggle } from './view/layout_toggle'
import { MarkdownPreview } from './view/markdown_preview'
import { MobileToolbar } from './view/mobile_toolbar'
import { Sidebar } from './view/sidebar'
import { SidebarToggle } from './view/sidebar_toggle'
import { ThemePicker } from './view/theme_picker'
import { ViewModePicker } from './view/view_mode_picker'

class App extends Disposable implements ViewController {
  dom: HTMLElement
  private rpcClient: RpcClient<ServerAPI, ClientAPI>
  private noteService: NoteService
  private editor: Editor
  private markdownPreview?: MarkdownPreview
  private htmlPreview?: HtmlPreview
  private mobileToolbar: MobileToolbar | undefined
  private sidebarToggle: SidebarToggle
  private themePicker: ThemePicker
  private viewModePicker: ViewModePicker
  private layoutToggle: LayoutToggle
  private breadcrumb: Breadcrumb
  private sidebar: Sidebar
  private id: string
  private $connectionStatus: HTMLElement
  private $saveStatus: HTMLElement
  private $main: HTMLElement
  private $editorPane: HTMLElement
  private isSocketConnected = false
  private isBrowserOnline = navigator.onLine
  private saveStatus: SaveStatus = 'idle'

  constructor(id: string) {
    super()
    this.id = id

    this.rpcClient = this.register(
      new RpcClient<ServerAPI, ClientAPI>({
        noteUpdate: (payload) => {
          this.noteService.emit('noteUpdate', payload)
        },
        treeUpdate: (payload) => {
          this.noteService.emit('treeUpdate', payload)
        },
      }),
    )

    this.noteService = this.register(new NoteService(this.rpcClient))

    this.sidebarToggle = this.register(new SidebarToggle())
    this.themePicker = this.register(new ThemePicker())
    this.viewModePicker = this.register(new ViewModePicker())
    this.layoutToggle = this.register(new LayoutToggle())
    this.breadcrumb = this.register(new Breadcrumb(id))
    this.sidebar = this.register(new Sidebar(id, this.noteService))

    this.editor = new Editor({
      id,
      noteService: this.noteService,
      onSaveStatusChange: (status) => {
        this.saveStatus = status
        this.applySaveStatus()
      },
    })

    if (isMobile) {
      this.mobileToolbar = this.register(new MobileToolbar(this.editor))
    }

    this.dom = h('div', { id: 'app' }, [
      h('header', {}, [
        this.sidebarToggle.dom,
        this.breadcrumb.dom,
        h('div', { className: 'status-cluster' }, [
          (this.$connectionStatus = h('span', { className: 'connection-status' }, '')),
          (this.$saveStatus = h('span', { className: 'save-status' }, '')),
        ]),
        h('div', { className: 'header-actions' }, [
          this.viewModePicker.dom,
          this.themePicker.dom,
          this.layoutToggle.dom,
        ]),
      ]),
      (this.$main = h('main', {}, [
        this.sidebar.dom,
        h('div', {
          className: 'sidebar-backdrop',
          onclick: () => UiStore.shared.setTreeVisible(false),
        }),
        (this.$editorPane = h('div', { className: 'editor-pane' }, [this.editor.dom])),
      ])),
      this.mobileToolbar?.dom,
    ])
  }

  init() {
    document.documentElement.classList.toggle('mobile', isMobile)

    this.isSocketConnected = this.rpcClient.connected

    this.register(
      this.rpcClient.on('connected', () => {
        this.isSocketConnected = true
        this.applyConnectionStatus()
      }),
    )

    this.register(
      this.rpcClient.on('disconnected', () => {
        this.isSocketConnected = false
        this.applyConnectionStatus()
      }),
    )

    this.register(listenDom(window, 'online', () => {
      this.isBrowserOnline = true
      this.applyConnectionStatus()
    }))
    this.register(listenDom(window, 'offline', () => {
      this.isBrowserOnline = false
      this.applyConnectionStatus()
    }))

    this.editor.init()
    this.sidebarToggle.init()
    this.themePicker.init()
    this.viewModePicker.init()
    this.layoutToggle.init()
    this.breadcrumb.init()
    this.sidebar.init()

    this.register(UiStore.shared.on('themeChanged', this.applyTheme.bind(this)))
    this.register(
      listenDom(window.matchMedia('(prefers-color-scheme: dark)') as any, 'change', this.applyTheme.bind(this)),
    )
    this.applyTheme()

    this.register(UiStore.shared.on('viewModeChanged', this.applyViewMode.bind(this)))
    this.register(UiStore.shared.on('treeVisibilityChanged', this.applySidebarVisibility.bind(this)))
    this.register(UiStore.shared.on('layoutWidthChanged', this.applyLayoutWidth.bind(this)))
    this.applyViewMode()
    this.applyLayoutWidth()
    this.applyConnectionStatus()
    this.applySaveStatus()
    this.applySidebarVisibility()

    document.title = `${this.id} - 1paper`

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

    this.editor.dispose()
    this.editor.dom.remove()
    this.editor = new Editor({
      id: newId,
      noteService: this.noteService,
      onSaveStatusChange: (status) => {
        this.saveStatus = status
        this.applySaveStatus()
      },
    })
    await this.editor.init()

    this.markdownPreview?.setEditor(this.editor)
    this.htmlPreview?.setEditor(this.editor)
    this.mobileToolbar?.setEditor(this.editor)
    await this.breadcrumb.setId(newId)
    await this.sidebar.setId(newId)
    document.title = `${newId} - 1paper`

    await this.applyViewMode()
  }

  private applyConnectionStatus() {
    const { $connectionStatus } = this
    let label = ''
    let visible = false
    let isOffline = false

    if (!this.isSocketConnected) {
      visible = true
      if (!this.isBrowserOnline) {
        label = 'Offline'
        isOffline = true
      } else {
        label = 'Connecting...'
      }
    }

    $connectionStatus.classList.toggle('is-visible', visible)
    $connectionStatus.classList.toggle('is-offline', isOffline)
    $connectionStatus.textContent = label
  }

  private applySaveStatus() {
    const { $saveStatus } = this
    const visible = this.saveStatus !== 'idle'
    $saveStatus.classList.toggle('is-visible', visible)
    $saveStatus.classList.toggle('is-error', this.saveStatus === 'error')
    $saveStatus.textContent =
      this.saveStatus === 'saving' ? 'Saving...' : this.saveStatus === 'error' ? 'Error' : ''
  }

  private async applyViewMode() {
    const viewMode = UiStore.shared.viewMode

    if (viewMode === 'text') {
      if (!this.$editorPane.contains(this.editor.dom)) {
        this.$editorPane.appendChild(this.editor.dom)
      }
    } else {
      this.editor.dom.remove()
    }

    if (viewMode === 'markdown') {
      if (!this.markdownPreview) {
        const { MarkdownPreview } = await import('./view/markdown_preview')
        this.markdownPreview = new MarkdownPreview(this.editor)
      }
      if (!this.$editorPane.contains(this.markdownPreview.dom)) {
        this.$editorPane.appendChild(this.markdownPreview.dom)
      }
    } else {
      this.markdownPreview?.dom.remove()
    }

    if (viewMode === 'html') {
      if (!this.htmlPreview) {
        const { HtmlPreview } = await import('./view/html_preview')
        this.htmlPreview = new HtmlPreview(this.editor)
      }
      if (!this.$editorPane.contains(this.htmlPreview.dom)) {
        this.$editorPane.appendChild(this.htmlPreview.dom)
      }
    } else {
      this.htmlPreview?.dom.remove()
    }
  }

  private applyTheme() {
    const theme = UiStore.shared.getComputedTheme()
    document.documentElement.dataset.theme = theme
  }
  private applySidebarVisibility() {
    this.$main.classList.toggle('is-sidebar-open', UiStore.shared.isTreeVisible())
  }
  private applyLayoutWidth() {
    const layoutWidth = UiStore.shared.getLayoutWidth()
    const cssVarValue = layoutWidth === 'wide' ? 'var(--editor-max-width-wide)' : 'var(--editor-max-width-normal)'
    document.documentElement.style.setProperty('--editor-max-width', cssVarValue)
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
