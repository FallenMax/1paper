import hashString = require('string-hash')
import { ErrorCode, UserError } from '../../common/error'
import { EventEmitter } from '../../common/event'
import { applyPatch, createPatch, Patch } from '../../common/lib/diff3'
import { DbConnection, Table } from '../lib/database'

const NOTE_MAX_SIZE = 100000

type Hash = number

export interface Note {
  _id: string
  note: string
}

interface PatchNodeOptions {
  id: string
  patch: Patch
  hash: Hash
  byClient: string | undefined
}

export class NoteService extends EventEmitter<{
  noteUpdate: { id: string; h: number; p: Patch; byClient: string | undefined }
  treeUpdate: { rootId: string }
}> {
  private table: Table<Note>
  private taskPromise = Promise.resolve() as unknown as Promise<any>

  constructor(private connection: DbConnection) {
    super()
    this.table = new Table<Note>(this.connection, 'notes')
  }

  async patchNote(options: PatchNodeOptions) {
    return this.queueTask(() => this.doPatchNote(options))
  }

  async setNote(options: { id: string; text: string; byClient: string | undefined }): Promise<void> {
    return this.queueTask(() => this.doSetNote(options))
  }

  private async doSetNote(options: { id: string; text: string; byClient: string | undefined }): Promise<void> {
    const { id, text, byClient } = options
    const existingNote = await this.doGetNote(id)

    // Skip if content is the same
    if (existingNote.note === text) {
      return
    }

    const patch = createPatch(existingNote.note, text)
    const hash = hashString(text)

    await this.doPatchNote({ id, patch, hash, byClient })
  }

  async getDescendantNoteIds(id: string): Promise<string[]> {
    return this.queueTask(() => this.doGetDescendantNoteIds(id))
  }

  async deleteRecursively(id: string): Promise<void> {
    await this.queueTask(async () => {
      const descendantIds = await this.doGetDescendantNoteIds(id)
      const allIds = [id, ...descendantIds]
      const existingNotes = await Promise.all(
        allIds.map(async (noteId) => {
          const note = await this.doGetNote(noteId)
          return { id: noteId, note }
        }),
      )

      const notesToDelete = existingNotes.filter(({ note }) => note.note.length > 0)

      // Delete all notes by setting them to empty
      for (const { id: noteId } of notesToDelete) {
        try {
          await this.doSetNote({ id: noteId, text: '', byClient: undefined })
        } catch (error) {
          console.error(error)
        }
      }
    })
  }

  async moveRecursively(oldId: string, newId: string) {
    await this.queueTask(async () => {
      // Prevent moving a note to its own descendant path
      if (newId.startsWith(oldId + '/')) {
        throw new UserError(ErrorCode.INVALID_OPERATION)
      }

      // Get all descendant notes that will be moved
      const descendantIds = await this.doGetDescendantNoteIds(oldId)
      const allOldIds = [oldId, ...descendantIds]

      // Check if target tree already exists
      const targetNote = await this.doGetNote(newId)
      if (targetNote.note.length > 0) {
        throw new UserError(ErrorCode.TARGET_ALREADY_EXISTS)
      }
      const targetDescendantIds = await this.doGetDescendantNoteIds(newId)
      if (targetDescendantIds.length > 0) {
        throw new UserError(ErrorCode.TARGET_ALREADY_EXISTS)
      }

      // Get existing notes that actually have content
      const existingNotes = await Promise.all(
        allOldIds.map(async (noteId) => {
          const note = await this.doGetNote(noteId)
          return { id: noteId, note }
        }),
      )

      const notesToMove = existingNotes.filter(({ note }) => note.note.length > 0)

      if (notesToMove.length === 0) {
        throw new UserError(ErrorCode.NOTE_NOT_FOUND)
      }

      const moveOperations = notesToMove.map(({ id, note }) => {
        const targetId = id === oldId ? newId : id.replace(oldId + '/', newId + '/')
        return {
          oldId: id,
          newId: targetId,
          content: note.note,
        }
      })

      // First, create all new notes
      for (const { newId: targetId, content } of moveOperations) {
        await this.doSetNote({ id: targetId, text: content, byClient: undefined })
      }

      // Then, delete all old notes
      for (const { oldId: sourceId } of moveOperations) {
        await this.doSetNote({ id: sourceId, text: '', byClient: undefined })
      }
    })
  }

  async getNote(id: string): Promise<Note> {
    return this.queueTask(() => this.doGetNote(id))
  }

  async getTreeNoteIds(id: string): Promise<string[]> {
    return this.queueTask(() => this.doGetTreeNoteIds(id))
  }

  //-------------- Implementation --------------
  private async queueTask<T>(task: () => Promise<T>): Promise<T> {
    // Wait for the previous task to complete successfully
    try {
      await this.taskPromise
    } catch (error) {}

    this.taskPromise = task()
    return this.taskPromise
  }

  private async doGetNote(id: string): Promise<Note> {
    const note = await this.table.findOne({ _id: id })
    if (note) {
      return note
    }
    return {
      _id: id,
      note: '',
    }
  }

  private async doGetTreeNoteIds(id: string): Promise<string[]> {
    const rootId = id.split('/')[0]
    if (!rootId) return []
    const results = await this.table.collection
      .find(
        {
          $or: [{ _id: rootId }, { _id: { $regex: `^${rootId}/` } }],
        },
        { projection: { _id: 1 } },
      )
      .toArray()
    return results.filter((item) => !item._id.endsWith('/')).map((item) => item._id)
  }

  private async doPatchNote({ id, patch, hash, byClient }: PatchNodeOptions) {
    const existNote = await this.doGetNote(id)
    const wasEmpty = existNote.note.length === 0

    const result = applyPatch(existNote.note, patch)
    if (result == null || hash !== hashString(result)) {
      throw new UserError(ErrorCode.HASH_MISMATCH)
    }
    if (result.length > NOTE_MAX_SIZE) {
      throw new UserError(ErrorCode.EXCEEDED_MAX_SIZE)
    }

    const empty = result.length === 0

    if (empty) {
      await this.table.remove({ _id: id })
    } else {
      await this.table.upsert({ _id: id }, { note: result, _id: id })
    }

    this.emit('noteUpdate', { id, h: hash, p: patch, byClient })
    if (empty !== wasEmpty) {
      const rootId = id.split('/')[0]!
      this.emit('treeUpdate', { rootId })
    }
  }

  private async doGetDescendantNoteIds(id: string): Promise<string[]> {
    const results = await this.table.collection
      .find({ _id: { $regex: `^${id}/` } }, { projection: { _id: 1 } })
      .toArray()
    return results.filter((item) => !item._id.endsWith('/')).map((item) => item._id)
  }
}
