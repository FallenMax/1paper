import hashString from 'string-hash'
import { ErrorCode } from '../../common/error'
import { EventEmitter } from '../../common/event'
import { applyPatch, createPatch, merge3, Patch } from '../../common/lib/diff3'
import { getTransformer } from '../lib/transformer/transformer'
import { END, START, TextTransformer } from '../lib/transformer/transformer.type'
import { NoteService } from '../service/note.service'
import { h, listenDom } from '../util/dom'
import { isDebugging } from '../util/env'
import { UserError } from '../util/error'
import { ViewController } from '../util/view_controller'
import './editor.css'

const noop = (_error?: any) => {}

const showError = (e: any) => {
  console.error(e)
  window.alert((e && e.errmsg) || 'Unknown error occurred, please refresh to retry.')
}

// attempt to set textarea value while preserving selected range
const setTextareaValue = (textarea: HTMLTextAreaElement, value: string) => {
  if (value === textarea.value) {
    return
  }

  const prev = textarea.value
  const next = value
  const start = textarea.selectionStart
  const end = textarea.selectionEnd

  const prevWithSelectionMark =
    prev.substring(0, start) + START + prev.substring(start, end) + END + prev.substring(end)
  const nextWithSelectingMark = merge3(next, prev, prevWithSelectionMark) || next + START + END
  const [before, , between, , after] = nextWithSelectingMark.split(new RegExp(`(${START}|${END})`, 'mg'))
  textarea.value = [before, between, after].join('')
  textarea.setSelectionRange(before.length, before.length + between.length)
}

export interface EditorOptions {
  id: string
  noteService: NoteService
  onSaveStatusChange: (isSaving: boolean) => void
}

export class Editor
  extends EventEmitter<{
    localNoteUpdated: void
  }>
  implements ViewController
{
  dom: HTMLTextAreaElement

  //-------------- State Properties --------------
  /** note versions */
  private common = ''
  private remote = ''

  /** branch status */
  private remoteUpdated = false
  private localUpdated = false
  private remoteStale = false

  /** operation status */
  private operation: 'idle' | 'push' | 'pull' = 'idle'

  /** special conditions */
  private isCompositing = false

  /** timers */
  private syncTimer: number | undefined
  private periodicSyncTimer: number = 0
  private disableTimer: number = 0

  constructor(private options: EditorOptions) {
    super()
    this.dom = h('textarea', {
      className: 'editor',
      spellcheck: false,
      disabled: true,
      value: 'Loading...',
      oninput: () => {
        this.localUpdated = true
        this.deferSync()
        this.emit('localNoteUpdated', undefined)
      },
      onkeydown: (e) => {
        if (this.isCompositing) {
          return
        }

        const { selectionStart, selectionEnd } = this.dom
        const hasSelection = selectionStart !== selectionEnd
        const transformer = getTransformer(e, hasSelection)
        if (transformer) {
          const applied = this.transformText(transformer)
          if (applied) {
            e.preventDefault()
          }
        }
      },
    })
    this.register(listenDom(this.dom, 'compositionstart', () => (this.isCompositing = true)))
    this.register(listenDom(this.dom, 'compositionend', () => (this.isCompositing = false)))
  }

  //-------------- Initialization --------------
  async init() {
    try {
      const { id, noteService } = this.options

      // Setup note update listener
      this.register(noteService.on('noteUpdate', this.handleNoteUpdate))

      let note = (window as any).__note
      if (note == null) {
        const result = await noteService.fetchNote(id)
        if (typeof result.note !== 'string') {
          throw new UserError('Failed to fetch note')
        }
        note = result.note
      }
      ;(window as any).__note = undefined

      this.dom.value = note
      this.common = note
      this.remote = note

      this.remoteUpdated = false
      this.localUpdated = false
      this.remoteStale = false

      this.setOperation('idle')
      this.isCompositing = false

      // Subscribe to note updates
      await noteService.subscribe(id)
      this.register(() => noteService.unsubscribe(id))

      // Setup beforeunload handler
      this.register(listenDom(window, 'beforeunload', this.handleBeforeUnload))

      // Setup periodic sync timer
      this.periodicSyncTimer = window.setInterval(() => {
        noteService.subscribe(id) // in case server restarted and subscriptions are lost
        this.deferSync()
      }, 1000 * 60)
      this.register(() => window.clearInterval(this.periodicSyncTimer))

      this.register(() => clearTimeout(this.syncTimer))
      this.register(() => clearTimeout(this.disableTimer))

      this.dom.disabled = false
      this.emit('localNoteUpdated', undefined)
    } catch (error) {
      showError(error)
    }
  }

  get localNote() {
    return this.dom.value
  }

  //-------------- Operation Methods --------------
  private setOperation(op: 'idle' | 'push' | 'pull') {
    this.operation = op
    if (op === 'idle') {
      window.clearTimeout(this.disableTimer)
      this.dom.disabled = false
    } else {
      window.clearTimeout(this.disableTimer)
      this.disableTimer = window.setTimeout(() => {
        this.dom.disabled = true
      }, 1000 * 10)
    }
  }

  private async pushLocal(callback = noop) {
    if (isDebugging) {
      console.info('operation:pushLocal')
    }
    try {
      const current = this.dom.value
      const patch = createPatch(this.remote, current)
      const hash = hashString(current)

      await this.options.noteService.saveNote(this.options.id, patch, hash)

      this.remote = current
      this.common = current
      this.remoteUpdated = false
      this.remoteStale = false
      this.localUpdated = current !== this.dom.value
      callback()
    } catch (e: any) {
      if (e?.errcode) {
        switch (e.errcode) {
          case ErrorCode.HASH_MISMATCH:
            this.remoteStale = true
            break
          case ErrorCode.EXCEEDED_MAX_SIZE:
            window.alert(`Note's size exceeded limit (100,000 characters).`)
            break
        }
      }
      callback(e)
    }
  }

  private pullRemote(callback = noop) {
    if (isDebugging) {
      console.info('operation:pullRemote')
    }
    this.options.noteService
      .fetchNote(this.options.id)
      .then(({ note }) => {
        this.remote = note
        this.remoteStale = false
        this.remoteUpdated = false
      })
      .finally(callback)
  }

  private rebaseLocal(callback = noop) {
    if (isDebugging) {
      console.info('operation:rebaseLocal')
    }
    let rebasedLocal = merge3(this.remote, this.common, this.dom.value)
    if (rebasedLocal == null) {
      console.warn('failed to merge, discarding local note :(')
      rebasedLocal = this.remote
    }
    setTextareaValue(this.dom, rebasedLocal)
    this.common = this.remote
    this.remoteUpdated = false
    this.localUpdated = true

    this.emit('localNoteUpdated', undefined)
    callback()
  }

  private forwardLocal(callback = noop) {
    if (isDebugging) {
      console.info('operation:forwardLocal')
    }
    setTextareaValue(this.dom, this.remote)
    this.common = this.remote
    this.remoteUpdated = false
    this.emit('localNoteUpdated', undefined)
    callback()
  }

  /** pattern match current state and exec corresponding sync operation */
  private requestSync = () => {
    if (this.remoteStale) {
      if (this.operation !== 'idle') {
        this.deferSync()
        return
      }
      this.setOperation('pull')
      this.options.onSaveStatusChange(true)
      this.pullRemote(() => {
        this.setOperation('idle')
        this.options.onSaveStatusChange(false)
        this.requestSync()
      })
      return
    }

    if (this.localUpdated && this.remoteUpdated) {
      if (this.isCompositing) {
        this.deferSync()
        return
      }
      this.rebaseLocal(this.requestSync)
      return
    }

    if (this.localUpdated) {
      if (this.operation !== 'idle' || this.isCompositing) {
        this.deferSync()
        return
      }
      this.setOperation('push')
      this.options.onSaveStatusChange(true)
      this.dom.disabled = false
      this.pushLocal((error) => {
        if (error) {
          console.error(error)
          this.setOperation('idle')
          this.deferSync()
          this.dom.disabled = true
          return
        }
        this.setOperation('idle')
        this.options.onSaveStatusChange(false)
        this.dom.disabled = false
        this.requestSync()
      })
      return
    }

    if (this.remoteUpdated) {
      if (this.isCompositing) {
        this.deferSync()
        return
      }
      this.forwardLocal(this.requestSync)
      return
    }
  }

  private deferSync() {
    if (isDebugging) {
      console.info('deferSync')
    }
    clearTimeout(this.syncTimer)
    this.syncTimer = window.setTimeout(this.requestSync, 100)
  }

  //-------------- Event Handlers --------------

  private handleNoteUpdate = (params: { h: number; p: Patch }) => {
    const { h: hash, p: patch } = params
    const note = applyPatch(this.remote, patch)
    const verified = note != null && hashString(note) === hash
    if (verified) {
      this.remote = note!
      this.remoteUpdated = true
      this.remoteStale = false
    } else {
      this.remoteStale = true
    }
    this.requestSync()
  }

  private handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.localUpdated) {
      const message = 'Your change has not been saved, quit?'
      e.returnValue = message // Gecko, Trident, Chrome 34+
      return message // Gecko, WebKit, Chrome <34
    }
  }

  transformText(transformer: TextTransformer): boolean {
    const $textarea = this.dom

    const value = $textarea.value
    const start = $textarea.selectionStart
    const end = $textarea.selectionEnd

    const state = [value.substring(0, start), START, value.substring(start, end), END, value.substring(end)].join('')

    const transformed = transformer(state)

    if (transformed != null) {
      const [before, _start, between, _end, after] = transformed.split(new RegExp(`(${START}|${END})`, 'mg'))
      $textarea.value = [before, between, after].join('')
      $textarea.setSelectionRange(before.length, before.length + between.length)

      this.localUpdated = true
      this.deferSync()

      return true
    }
    return false
  }
}
