import { ClientAPI, ServerAPI } from '../common/api.type'
import { generatePageId } from '../common/lib/generate_id'
import { Editor } from './component/editor'
import { MobileToolbar } from './component/mobile_toolbar'
import { TitleMenu } from './component/title_menu'
import { RpcClient } from './lib/rpc_client'
import { NoteService } from './service/note.service'
import { isMobile } from './util/env'

function $(selector: string) {
  return document.querySelector(selector) as HTMLElement
}

class App {
  private rpcClient: RpcClient<ServerAPI, ClientAPI>
  private noteService: NoteService
  private editor: Editor
  private $saveStatus = $('.save-status')!
  private $networkStatus = $('.network-status')!
  private mobileToolbar: MobileToolbar | undefined
  private titleMenu: TitleMenu
  readonly id: string

  constructor(id: string) {
    this.id = id
    if (isMobile) {
      document.documentElement.classList.add('mobile')
    }
    const $editor = $('.editor')! as HTMLTextAreaElement

    this.rpcClient = new RpcClient<ServerAPI, ClientAPI>({
      noteUpdate: (payload) => {
        this.noteService.emit('noteUpdate', payload)
      },
    })
    this.noteService = new NoteService(this.rpcClient)
    this.editor = new Editor($editor, {
      id,
      noteService: this.noteService,
      onSaveStatusChange: this.handleSaveStatusChange,
    })
    this.titleMenu = new TitleMenu($('.title-menu') as HTMLSelectElement, id)

    if (isMobile) {
      this.mobileToolbar = new MobileToolbar($('.mobile-toolbar')!, this.editor)
    }
  }

  init() {
    this.rpcClient.on('connected', () => {
      this.$networkStatus.style.display = 'none'
    })
    this.rpcClient.on('disconnected', () => {
      this.$networkStatus.style.display = 'block'
    })

    this.editor.init()
    this.mobileToolbar?.init()
    this.titleMenu.init()
  }

  private handleSaveStatusChange = (isSaving: boolean) => {
    this.$saveStatus.classList.toggle('is-active', isSaving)
  }
}

const id = decodeURIComponent(location.pathname.slice(1))
if (id === '') {
  location.replace('/' + generatePageId())
} else {
  const app = new App(id)
  app.init()
}

// setup service worker
// async function registerServiceWorker() {
//   await navigator.serviceWorker.register('/assets/sw.js', {
//     scope: '/',
//   })
// }
// registerServiceWorker().catch((e) => {
//   console.error(`Failed to register sw: ${e}`)
// })
