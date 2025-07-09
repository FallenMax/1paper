import hashString = require('string-hash')
import { Disposable } from '../../common/disposable'
import { ErrorCode, UserError } from '../../common/error'
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
  source?: string
}

export class NoteService extends Disposable {
  private table: Table<Note>

  constructor(private connection: DbConnection) {
    super()
    this.table = new Table<Note>(this.connection, 'notes')
  }

  private taskPromise = Promise.resolve() as unknown as Promise<any>

  /**
   * Queue a task to avoid race conditions
   */
  private async queueTask<T>(task: () => Promise<T>): Promise<T> {
    // Wait for previous task to complete
    await Promise.allSettled([this.taskPromise])

    // Execute the new task and update the promise chain
    this.taskPromise = task()
    return this.taskPromise
  }

  async patchNote(options: PatchNodeOptions) {
    return this.queueTask(() => this.doPatchNote(options))
  }

  private async doPatchNote({ id, patch, hash, source }: PatchNodeOptions): Promise<{ hash: number; patch: Patch }> {
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

    if (empty !== wasEmpty) {
      // [TODO] notify client
    }
    return { hash, patch }
  }

  /**
   * Get all descendant note IDs for a given note ID
   */
  private async doGetDescendantNoteIds(id: string): Promise<string[]> {
    const results = await this.table.collection
      .find({ _id: { $regex: `^${id}/` } }, { projection: { _id: 1 } })
      .toArray()
    return results.filter((item) => !item._id.endsWith('/')).map((item) => item._id)
  }

  /**
   * Get all descendant note IDs for a given note ID (queued version)
   */
  async getDescendantNoteIds(id: string): Promise<string[]> {
    return this.queueTask(() => this.doGetDescendantNoteIds(id))
  }

  /**
   * Delete a note and all its descendants recursively
   */
  async deleteNote(
    id: string,
    source?: string,
  ): Promise<{
    deletedNotes: Array<{ id: string; hash: number; patch: Patch }>
    affectedCount: number
  }> {
    return this.queueTask(async () => {
      // Get the main note
      const existingNote = await this.doGetNote(id)

      // Get all descendant notes
      const descendantIds = await this.doGetDescendantNoteIds(id)

      // Filter out empty notes (they don't really exist)
      const allIds = [id, ...descendantIds]
      const existingNotes = await Promise.all(
        allIds.map(async (noteId) => {
          const note = await this.doGetNote(noteId)
          return { id: noteId, note }
        }),
      )

      const notesToDelete = existingNotes.filter(({ note }) => note.note.length > 0)

      if (notesToDelete.length === 0) {
        // No actual notes to delete
        return {
          deletedNotes: [],
          affectedCount: 0,
        }
      }

      // Delete all notes by setting them to empty
      const deleteResults = await Promise.all(
        notesToDelete.map(async ({ id: noteId, note }) => {
          const patch = createPatch(note.note, '')
          const hash = hashString('')
          const result = await this.doPatchNote({ id: noteId, patch, hash, source })
          return { id: noteId, ...result }
        }),
      )

      return {
        deletedNotes: deleteResults,
        affectedCount: notesToDelete.length,
      }
    })
  }

  /**
   * Move a note and all its descendants recursively
   */
  async moveNote(
    oldId: string,
    newId: string,
    source?: string,
  ): Promise<Array<{ id: string; hash: number; patch: Patch }>> {
    return this.queueTask(async () => {
      // Get the main note
      const existingNote = await this.doGetNote(oldId)
      if (existingNote.note.length === 0) {
        throw new UserError(ErrorCode.NOTE_NOT_FOUND)
      }

      // Get all descendant notes that will be moved
      const descendantIds = await this.doGetDescendantNoteIds(oldId)
      const allOldIds = [oldId, ...descendantIds]

      // Check if target root already exists
      const targetNote = await this.doGetNote(newId)
      if (targetNote.note.length > 0) {
        throw new UserError(ErrorCode.TARGET_ALREADY_EXISTS)
      }

      // Check if any target descendants already exist
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

      // Create move operations for all notes
      const moveOperations = notesToMove.map(({ id, note }) => {
        // Ensure precise path replacement
        const targetId = id === oldId ? newId : id.replace(oldId + '/', newId + '/')
        return {
          oldId: id,
          newId: targetId,
          content: note.note,
        }
      })

      // Execute all move operations
      const results: Array<{ id: string; hash: number; patch: Patch }> = []

      // First, create all new notes
      for (const { newId: targetId, content } of moveOperations) {
        const patch = createPatch('', content)
        const hash = hashString(content)
        const createResult = await this.doPatchNote({ id: targetId, patch, hash, source })
        results.push({ id: targetId, ...createResult })
      }

      // Then, delete all old notes
      for (const { oldId: sourceId, content } of moveOperations) {
        const patch = createPatch(content, '')
        const hash = hashString('')
        const deleteResult = await this.doPatchNote({ id: sourceId, patch, hash, source })
        results.push({ id: sourceId, ...deleteResult })
      }

      return results
    })
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

  async getNote(id: string): Promise<Note> {
    return this.queueTask(() => this.doGetNote(id))
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

  async getTreeNoteIds(id: string): Promise<string[]> {
    return this.queueTask(() => this.doGetTreeNoteIds(id))
  }
}
