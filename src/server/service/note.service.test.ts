import { MongoClient } from 'mongodb'
import { UserError } from '../../common/error'
import { createPatch } from '../../common/lib/diff3'
import { config, isTesting } from '../config'
import { DbConnection } from '../lib/database'
import { NoteService } from './note.service'
import hashString = require('string-hash')

describe('NoteService', () => {
  let noteService: NoteService

  beforeAll(async () => {
    if (!isTesting) {
      throw new Error('Tests can only run in test environment. Set NODE_ENV=test')
    }
    if (!config.mongodb.database.includes('test')) {
      throw new Error('Database name must contain "test" for safety')
    }

    const client = new MongoClient(config.mongodb.url)
    try {
      await client.connect()
      const db = client.db(config.mongodb.database)

      // Drop all collections
      const collections = await db.listCollections().toArray()
      for (const collection of collections) {
        await db.collection(collection.name).deleteMany({})
      }

      console.log(`Test database ${config.mongodb.database} cleaned`)
    } finally {
      await client.close()
    }

    const conn = new DbConnection()
    await conn.connect()
    noteService = new NoteService(conn)
  })

  describe('Basic Note Operations', () => {
    it('should create a note', async () => {
      const note = await noteService.getNote('test')
      expect(note).toBeDefined()
      expect(note._id).toBe('test')
      expect(note.note).toBe('')
    })

    it('should patch a note with content', async () => {
      const noteId = 'test-patch'
      const content = 'Hello world'
      const patch = createPatch('', content)
      const hash = hashString(content)

      await noteService.patchNote({
        id: noteId,
        patch,
        hash,
        byClient: 'test-client',
      })

      const note = await noteService.getNote(noteId)
      expect(note.note).toBe(content)
    })

    it('should get an existing note', async () => {
      const noteId = 'test-existing'
      const content = 'Existing note content'
      const patch = createPatch('', content)
      const hash = hashString(content)

      // Create note first
      await noteService.patchNote({
        id: noteId,
        patch,
        hash,
        byClient: 'test-client',
      })

      // Get the note
      const note = await noteService.getNote(noteId)
      expect(note._id).toBe(noteId)
      expect(note.note).toBe(content)
    })

    it('should update an existing note', async () => {
      const noteId = 'test-update'
      const initialContent = 'Initial content'
      const updatedContent = 'Updated content'

      // Create initial note
      let patch = createPatch('', initialContent)
      let hash = hashString(initialContent)
      await noteService.patchNote({
        id: noteId,
        patch,
        hash,
        byClient: 'test-client',
      })

      // Update the note
      patch = createPatch(initialContent, updatedContent)
      hash = hashString(updatedContent)
      await noteService.patchNote({
        id: noteId,
        patch,
        hash,
        byClient: 'test-client',
      })

      const note = await noteService.getNote(noteId)
      expect(note.note).toBe(updatedContent)
    })

    it('should delete a note by setting empty content', async () => {
      const noteId = 'test-delete'
      const content = 'Content to delete'

      // Create note first
      let patch = createPatch('', content)
      let hash = hashString(content)
      await noteService.patchNote({
        id: noteId,
        patch,
        hash,
        byClient: 'test-client',
      })

      // Delete by setting empty content
      patch = createPatch(content, '')
      hash = hashString('')
      await noteService.patchNote({
        id: noteId,
        patch,
        hash,
        byClient: 'test-client',
      })

      const note = await noteService.getNote(noteId)
      expect(note.note).toBe('')
    })
  })

  describe('Tree Operations', () => {
    beforeEach(async () => {
      // Create a hierarchical structure for testing
      // tree/
      //   root
      //   folder1/
      //     note1
      //     note2
      //   folder2/
      //     subfolder/
      //       deep-note
      const notesToCreate = ['tree', 'tree/folder1/note1', 'tree/folder1/note2', 'tree/folder2/subfolder/deep-note']

      for (const noteId of notesToCreate) {
        const content = `Content of ${noteId}`
        const patch = createPatch('', content)
        const hash = hashString(content)
        await noteService.patchNote({
          id: noteId,
          patch,
          hash,
          byClient: 'test-client',
        })
      }
    })

    it('should get all tree note IDs for a root note', async () => {
      const treeNoteIds = await noteService.getTreeNoteIds('tree')
      expect(treeNoteIds).toContain('tree')
      expect(treeNoteIds).toContain('tree/folder1/note1')
      expect(treeNoteIds).toContain('tree/folder1/note2')
      expect(treeNoteIds).toContain('tree/folder2/subfolder/deep-note')
      expect(treeNoteIds.length).toBe(4)
    })

    it('should get tree note IDs for a nested note', async () => {
      const treeNoteIds = await noteService.getTreeNoteIds('tree/folder1/note1')
      expect(treeNoteIds).toContain('tree')
      expect(treeNoteIds).toContain('tree/folder1/note1')
      expect(treeNoteIds).toContain('tree/folder1/note2')
      expect(treeNoteIds).toContain('tree/folder2/subfolder/deep-note')
      expect(treeNoteIds.length).toBe(4)
    })

    it('should get descendant note IDs', async () => {
      const descendantIds = await noteService.getDescendantNoteIds('tree')
      expect(descendantIds).toContain('tree/folder1/note1')
      expect(descendantIds).toContain('tree/folder1/note2')
      expect(descendantIds).toContain('tree/folder2/subfolder/deep-note')
      expect(descendantIds).not.toContain('tree') // Should not include the parent itself
      expect(descendantIds.length).toBe(3)
    })

    it('should get descendant note IDs for a folder', async () => {
      const descendantIds = await noteService.getDescendantNoteIds('tree/folder1')
      expect(descendantIds).toContain('tree/folder1/note1')
      expect(descendantIds).toContain('tree/folder1/note2')
      expect(descendantIds).not.toContain('tree/folder2/subfolder/deep-note')
      expect(descendantIds.length).toBe(2)
    })

    it('should return empty array for note with no descendants', async () => {
      const descendantIds = await noteService.getDescendantNoteIds('tree/folder1/note1')
      expect(descendantIds).toEqual([])
    })

    it('should return empty array for non-existent note descendants', async () => {
      const descendantIds = await noteService.getDescendantNoteIds('non-existent')
      expect(descendantIds).toEqual([])
    })
  })

  describe('Delete Operations', () => {
    beforeEach(async () => {
      // Create a hierarchical structure for testing
      const notesToCreate = [
        'delete-test',
        'delete-test/folder1/note1',
        'delete-test/folder1/note2',
        'delete-test/folder2/subfolder/deep-note',
      ]

      for (const noteId of notesToCreate) {
        const content = `Content of ${noteId}`
        const patch = createPatch('', content)
        const hash = hashString(content)
        await noteService.patchNote({
          id: noteId,
          patch,
          hash,
          byClient: 'test-client',
        })
      }
    })

    it('should delete a single note recursively', async () => {
      // Delete a leaf note
      await noteService.deleteRecursively('delete-test/folder1/note1')

      const note = await noteService.getNote('delete-test/folder1/note1')
      expect(note.note).toBe('')

      // Other notes should remain
      const otherNote = await noteService.getNote('delete-test/folder1/note2')
      expect(otherNote.note).toBe('Content of delete-test/folder1/note2')
    })

    it('should delete a folder and all its descendants', async () => {
      // Delete folder1 and all its children
      await noteService.deleteRecursively('delete-test/folder1')

      const note1 = await noteService.getNote('delete-test/folder1/note1')
      const note2 = await noteService.getNote('delete-test/folder1/note2')

      expect(note1.note).toBe('')
      expect(note2.note).toBe('')

      // Other notes should remain
      const otherNote = await noteService.getNote('delete-test/folder2/subfolder/deep-note')
      expect(otherNote.note).toBe('Content of delete-test/folder2/subfolder/deep-note')
    })

    it('should delete entire tree recursively', async () => {
      await noteService.deleteRecursively('delete-test')

      const rootNote = await noteService.getNote('delete-test')
      const note1 = await noteService.getNote('delete-test/folder1/note1')
      const note2 = await noteService.getNote('delete-test/folder1/note2')
      const deepNote = await noteService.getNote('delete-test/folder2/subfolder/deep-note')

      expect(rootNote.note).toBe('')
      expect(note1.note).toBe('')
      expect(note2.note).toBe('')
      expect(deepNote.note).toBe('')
    })

    it('should handle deletion of non-existent note', async () => {
      // Should not throw error
      await noteService.deleteRecursively('non-existent-note')
    })
  })

  describe('Move Operations', () => {
    beforeEach(async () => {
      // Create a hierarchical structure for testing
      const notesToCreate = [
        'move-test',
        'move-test/folder1/note1',
        'move-test/folder1/note2',
        'move-test/folder2/subfolder/deep-note',
      ]

      for (const noteId of notesToCreate) {
        const content = `Content of ${noteId}`
        const patch = createPatch('', content)
        const hash = hashString(content)
        await noteService.patchNote({
          id: noteId,
          patch,
          hash,
          byClient: 'test-client',
        })
      }
    })

    it('should move a single note', async () => {
      await noteService.moveRecursively('move-test/folder1/note1', 'move-test/folder1/renamed-note')

      // Old note should be empty
      const oldNote = await noteService.getNote('move-test/folder1/note1')
      expect(oldNote.note).toBe('')

      // New note should have the content
      const newNote = await noteService.getNote('move-test/folder1/renamed-note')
      expect(newNote.note).toBe('Content of move-test/folder1/note1')
    })

    it('should move a folder and all its descendants', async () => {
      await noteService.moveRecursively('move-test/folder1', 'move-test/renamed-folder')

      // Old notes should be empty
      const oldNote1 = await noteService.getNote('move-test/folder1/note1')
      const oldNote2 = await noteService.getNote('move-test/folder1/note2')
      expect(oldNote1.note).toBe('')
      expect(oldNote2.note).toBe('')

      // New notes should have the content
      const newNote1 = await noteService.getNote('move-test/renamed-folder/note1')
      const newNote2 = await noteService.getNote('move-test/renamed-folder/note2')
      expect(newNote1.note).toBe('Content of move-test/folder1/note1')
      expect(newNote2.note).toBe('Content of move-test/folder1/note2')
    })

    it('should move entire tree', async () => {
      await noteService.moveRecursively('move-test', 'moved-tree')

      // Old notes should be empty
      const oldRoot = await noteService.getNote('move-test')
      const oldNote1 = await noteService.getNote('move-test/folder1/note1')
      const oldDeepNote = await noteService.getNote('move-test/folder2/subfolder/deep-note')
      expect(oldRoot.note).toBe('')
      expect(oldNote1.note).toBe('')
      expect(oldDeepNote.note).toBe('')

      // New notes should have the content
      const newRoot = await noteService.getNote('moved-tree')
      const newNote1 = await noteService.getNote('moved-tree/folder1/note1')
      const newDeepNote = await noteService.getNote('moved-tree/folder2/subfolder/deep-note')
      expect(newRoot.note).toBe('Content of move-test')
      expect(newNote1.note).toBe('Content of move-test/folder1/note1')
      expect(newDeepNote.note).toBe('Content of move-test/folder2/subfolder/deep-note')
    })

    it('should prevent moving to descendant path', async () => {
      await expect(noteService.moveRecursively('move-test', 'move-test/folder1/invalid')).rejects.toThrow()
    })

    it('should prevent moving to existing target', async () => {
      // Create target note first
      const content = 'Existing target content'
      const patch = createPatch('', content)
      const hash = hashString(content)
      await noteService.patchNote({
        id: 'existing-target',
        patch,
        hash,
        byClient: 'test-client',
      })

      await expect(noteService.moveRecursively('move-test/folder1/note1', 'existing-target')).rejects.toThrow()
    })
  })

  describe('Error Handling', () => {
    it('should throw error for hash mismatch', async () => {
      const noteId = 'error-test'
      const content = 'Test content'
      const patch = createPatch('', content)
      const wrongHash = hashString('wrong content')

      await expect(
        noteService.patchNote({
          id: noteId,
          patch,
          hash: wrongHash,
          byClient: 'test-client',
        }),
      ).rejects.toThrow(UserError)
    })

    it('should throw error for note exceeding max size', async () => {
      const noteId = 'large-note'
      const largeContent = 'a'.repeat(100001) // Exceeds NOTE_MAX_SIZE (100000)
      const patch = createPatch('', largeContent)
      const hash = hashString(largeContent)

      await expect(
        noteService.patchNote({
          id: noteId,
          patch,
          hash,
          byClient: 'test-client',
        }),
      ).rejects.toThrow(UserError)
    })

    it('should handle concurrent patch operations', async () => {
      const noteId = 'concurrent-test'
      const content1 = 'First content'
      const content2 = 'Second content'

      const patch1 = createPatch('', content1)
      const hash1 = hashString(content1)

      const patch2 = createPatch('', content2)
      const hash2 = hashString(content2)

      // Both operations should succeed because they're queued
      const promises = [
        noteService.patchNote({
          id: noteId,
          patch: patch1,
          hash: hash1,
          byClient: 'client1',
        }),
        noteService.patchNote({
          id: noteId + '2',
          patch: patch2,
          hash: hash2,
          byClient: 'client2',
        }),
      ]

      await Promise.all(promises)

      const note1 = await noteService.getNote(noteId)
      const note2 = await noteService.getNote(noteId + '2')

      expect(note1.note).toBe(content1)
      expect(note2.note).toBe(content2)
    })

    it('should handle empty note ID', async () => {
      const note = await noteService.getNote('')
      expect(note._id).toBe('')
      expect(note.note).toBe('')
    })

    it('should handle note ID with special characters', async () => {
      const noteId = 'test/with-dashes_and.dots'
      const content = 'Content with special characters'
      const patch = createPatch('', content)
      const hash = hashString(content)

      await noteService.patchNote({
        id: noteId,
        patch,
        hash,
        byClient: 'test-client',
      })

      const note = await noteService.getNote(noteId)
      expect(note.note).toBe(content)
    })
  })

  describe('Edge Cases', () => {
    it('should handle moving note with empty content', async () => {
      const oldId = 'empty-note'
      const newId = 'moved-empty-note'

      // Create empty note (this should not actually create anything in DB)
      const note = await noteService.getNote(oldId)
      expect(note.note).toBe('')

      // Try to move empty note - should throw error
      await expect(noteService.moveRecursively(oldId, newId)).rejects.toThrow(UserError)
    })

    it('should handle deleting note with empty content', async () => {
      const noteId = 'empty-note-delete'

      // Try to delete empty note - should not throw error
      await noteService.deleteRecursively(noteId)

      const note = await noteService.getNote(noteId)
      expect(note.note).toBe('')
    })

    it('should handle very deep nesting', async () => {
      const deepPath = 'root/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z'
      const content = 'Deep nested content'
      const patch = createPatch('', content)
      const hash = hashString(content)

      await noteService.patchNote({
        id: deepPath,
        patch,
        hash,
        byClient: 'test-client',
      })

      const note = await noteService.getNote(deepPath)
      expect(note.note).toBe(content)

      const descendants = await noteService.getDescendantNoteIds('root')
      expect(descendants).toContain(deepPath)
    })

    it('should handle note IDs with leading/trailing slashes', async () => {
      const noteId = 'normal-path'
      const content = 'Normal content'
      const patch = createPatch('', content)
      const hash = hashString(content)

      await noteService.patchNote({
        id: noteId,
        patch,
        hash,
        byClient: 'test-client',
      })

      // Test getting descendants with various slash patterns
      const descendants1 = await noteService.getDescendantNoteIds('normal-path/')
      const descendants2 = await noteService.getDescendantNoteIds('/normal-path')
      const descendants3 = await noteService.getDescendantNoteIds('/normal-path/')

      expect(descendants1).toEqual([])
      expect(descendants2).toEqual([])
      expect(descendants3).toEqual([])
    })
  })

  describe('Event Emission', () => {
    it('should emit noteUpdate event when patching note', async () => {
      const noteId = 'event-test'
      const content = 'Event test content'
      const patch = createPatch('', content)
      const hash = hashString(content)

      let eventEmitted = false
      const handler = (data: any) => {
        expect(data.id).toBe(noteId)
        expect(data.h).toBe(hash)
        expect(data.byClient).toBe('test-client')
        eventEmitted = true
      }

      const unsubscribe = noteService.on('noteUpdate', handler)

      await noteService.patchNote({
        id: noteId,
        patch,
        hash,
        byClient: 'test-client',
      })

      expect(eventEmitted).toBe(true)
      unsubscribe() // Clean up
    })

    it('should emit treeUpdate event when note becomes non-empty', async () => {
      const noteId = 'tree-event-test2'
      const content = 'Tree event test content'
      const patch = createPatch('', content)
      const hash = hashString(content)

      let treeEventEmitted = false
      const handler = (data: any) => {
        expect(data.rootId).toBe('tree-event-test2')
        treeEventEmitted = true
      }

      const unsubscribe = noteService.on('treeUpdate', handler)

      await noteService.patchNote({
        id: noteId,
        patch,
        hash,
        byClient: 'test-client',
      })

      expect(treeEventEmitted).toBe(true)
      unsubscribe() // Clean up
    })

    it('should emit treeUpdate event when note becomes empty', async () => {
      const noteId = 'tree-empty-event-test2'
      const content = 'Content to be emptied'

      // Create note first
      let patch = createPatch('', content)
      let hash = hashString(content)
      await noteService.patchNote({
        id: noteId,
        patch,
        hash,
        byClient: 'test-client',
      })

      let treeEventEmitted = false
      const handler = (data: any) => {
        expect(data.rootId).toBe('tree-empty-event-test2')
        treeEventEmitted = true
      }

      const unsubscribe = noteService.on('treeUpdate', handler)

      // Empty the note
      patch = createPatch(content, '')
      hash = hashString('')
      await noteService.patchNote({
        id: noteId,
        patch,
        hash,
        byClient: 'test-client',
      })

      expect(treeEventEmitted).toBe(true)
      unsubscribe() // Clean up
    })
  })
})
