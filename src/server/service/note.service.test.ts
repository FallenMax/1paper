import { MongoClient } from 'mongodb'
import { UserError } from '../../common/error'
import { createPatch } from '../../common/lib/diff3'
import { config, isTesting } from '../config'
import { DbConnection } from '../lib/database'
import { NoteService } from './note.service'
import hashString = require('string-hash')

describe('NoteService', () => {
  let noteService: NoteService
  let conn: DbConnection

  async function cleanDatabase() {
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
    } finally {
      await client.close()
    }
  }

  beforeAll(async () => {
    conn = new DbConnection()
    await conn.connect()
    noteService = new NoteService(conn)
  })

  beforeEach(cleanDatabase)

  describe('Basic Note Operations', () => {
    it('should create a note', async () => {
      const note = await noteService.getNote('basic-test')
      expect(note).toBeDefined()
      expect(note._id).toBe('basic-test')
      expect(note.note).toBe('')
    })

    it('should patch a note with content', async () => {
      const noteId = 'basic-patch'
      const content = 'Hello world'

      await noteService.setNote({
        id: noteId,
        text: content,
        byClient: 'test-client',
      })

      const note = await noteService.getNote(noteId)
      expect(note.note).toBe(content)
    })

    it('should get an existing note', async () => {
      const noteId = 'basic-existing'
      const content = 'Existing note content'

      // Create note first
      await noteService.setNote({
        id: noteId,
        text: content,
        byClient: 'test-client',
      })

      // Get the note
      const note = await noteService.getNote(noteId)
      expect(note._id).toBe(noteId)
      expect(note.note).toBe(content)
    })

    it('should update an existing note', async () => {
      const noteId = 'basic-update'
      const initialContent = 'Initial content'
      const updatedContent = 'Updated content'

      // Create initial note
      await noteService.setNote({
        id: noteId,
        text: initialContent,
        byClient: 'test-client',
      })

      // Update the note
      const patch = createPatch(initialContent, updatedContent)
      const hash = hashString(updatedContent)
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
      const noteId = 'basic-delete'
      const content = 'Content to delete'

      // Create note first
      await noteService.setNote({
        id: noteId,
        text: content,
        byClient: 'test-client',
      })

      // Delete by setting empty content
      await noteService.setNote({
        id: noteId,
        text: '',
        byClient: 'test-client',
      })

      const note = await noteService.getNote(noteId)
      expect(note.note).toBe('')
    })
  })

  describe('Tree Operations', () => {
    const TEST_PREFIX = 'tree-ops'

    beforeEach(async () => {
      // Create a hierarchical structure for testing
      // tree-ops/
      //   root
      //   folder1/
      //     note1
      //     note2
      //   folder2/
      //     subfolder/
      //       deep-note
      const notesToCreate = [
        `${TEST_PREFIX}`,
        `${TEST_PREFIX}/folder1/note1`,
        `${TEST_PREFIX}/folder1/note2`,
        `${TEST_PREFIX}/folder2/subfolder/deep-note`,
      ]

      // Create all notes sequentially to ensure proper ordering
      for (const noteId of notesToCreate) {
        const content = `Content of ${noteId}`
        await noteService.setNote({
          id: noteId,
          text: content,
          byClient: 'test-client',
        })
      }

      // Verify all notes were created successfully
      for (const noteId of notesToCreate) {
        const note = await noteService.getNote(noteId)
        if (note.note === '') {
          throw new Error(`Failed to create test data: ${noteId}`)
        }
      }
    })

    it('should get all tree note IDs for a root note', async () => {
      // Double-check that test data exists
      const rootNote = await noteService.getNote(TEST_PREFIX)
      const note1 = await noteService.getNote(`${TEST_PREFIX}/folder1/note1`)
      expect(rootNote.note).toBe(`Content of ${TEST_PREFIX}`)
      expect(note1.note).toBe(`Content of ${TEST_PREFIX}/folder1/note1`)

      const treeNoteIds = await noteService.getTreeNoteIds(TEST_PREFIX)

      // Debug output if test fails
      if (treeNoteIds.length !== 4) {
        console.log('Expected 4 notes, got:', treeNoteIds.length)
        console.log('Tree note IDs:', treeNoteIds)
      }

      expect(treeNoteIds).toContain(`${TEST_PREFIX}/folder1/note1`)
      expect(treeNoteIds).toContain(`${TEST_PREFIX}/folder1/note2`)
      expect(treeNoteIds).toContain(`${TEST_PREFIX}/folder2/subfolder/deep-note`)
      expect(treeNoteIds.length).toBe(4)
    })

    it('should get tree note IDs for a nested note', async () => {
      const treeNoteIds = await noteService.getTreeNoteIds(`${TEST_PREFIX}/folder1/note1`)
      expect(treeNoteIds).toContain(`${TEST_PREFIX}/folder1/note1`)
      expect(treeNoteIds).toContain(`${TEST_PREFIX}/folder1/note2`)
      expect(treeNoteIds).toContain(`${TEST_PREFIX}/folder2/subfolder/deep-note`)
      expect(treeNoteIds.length).toBe(4)
    })

    it('should get descendant note IDs', async () => {
      const descendantIds = await noteService.getDescendantNoteIds(TEST_PREFIX)
      expect(descendantIds).toContain(`${TEST_PREFIX}/folder1/note1`)
      expect(descendantIds).toContain(`${TEST_PREFIX}/folder1/note2`)
      expect(descendantIds).toContain(`${TEST_PREFIX}/folder2/subfolder/deep-note`)
      expect(descendantIds).not.toContain(TEST_PREFIX) // Should not include the parent itself
      expect(descendantIds.length).toBe(3)
    })

    it('should get descendant note IDs for a folder', async () => {
      const descendantIds = await noteService.getDescendantNoteIds(`${TEST_PREFIX}/folder1`)
      expect(descendantIds).toContain(`${TEST_PREFIX}/folder1/note1`)
      expect(descendantIds).toContain(`${TEST_PREFIX}/folder1/note2`)
      expect(descendantIds).not.toContain(`${TEST_PREFIX}/folder2/subfolder/deep-note`)
      expect(descendantIds.length).toBe(2)
    })

    it('should return empty array for note with no descendants', async () => {
      const descendantIds = await noteService.getDescendantNoteIds(`${TEST_PREFIX}/folder1/note1`)
      expect(descendantIds).toEqual([])
    })

    it('should return empty array for non-existent note descendants', async () => {
      const descendantIds = await noteService.getDescendantNoteIds('non-existent-note')
      expect(descendantIds).toEqual([])
    })
  })

  describe('Delete Operations', () => {
    const TEST_PREFIX = 'delete-ops'

    beforeEach(async () => {
      // Create a hierarchical structure for testing
      const notesToCreate = [
        TEST_PREFIX,
        `${TEST_PREFIX}/folder1/note1`,
        `${TEST_PREFIX}/folder1/note2`,
        `${TEST_PREFIX}/folder2/subfolder/deep-note`,
      ]

      for (const noteId of notesToCreate) {
        const content = `Content of ${noteId}`
        await noteService.setNote({
          id: noteId,
          text: content,
          byClient: 'test-client',
        })
      }

      // Verify all notes were created successfully
      for (const noteId of notesToCreate) {
        const note = await noteService.getNote(noteId)
        if (note.note === '') {
          throw new Error(`Failed to create test data: ${noteId}`)
        }
      }
    })

    it('should delete a single note recursively', async () => {
      // Delete a leaf note
      await noteService.deleteRecursively(`${TEST_PREFIX}/folder1/note1`)

      const note = await noteService.getNote(`${TEST_PREFIX}/folder1/note1`)
      expect(note.note).toBe('')

      // Other notes should remain
      const otherNote = await noteService.getNote(`${TEST_PREFIX}/folder1/note2`)
      expect(otherNote.note).toBe(`Content of ${TEST_PREFIX}/folder1/note2`)
    })

    it('should delete a folder and all its descendants', async () => {
      // Delete folder1 and all its children
      await noteService.deleteRecursively(`${TEST_PREFIX}/folder1`)

      const note1 = await noteService.getNote(`${TEST_PREFIX}/folder1/note1`)
      const note2 = await noteService.getNote(`${TEST_PREFIX}/folder1/note2`)

      expect(note1.note).toBe('')
      expect(note2.note).toBe('')

      // Other notes should remain
      const otherNote = await noteService.getNote(`${TEST_PREFIX}/folder2/subfolder/deep-note`)
      expect(otherNote.note).toBe(`Content of ${TEST_PREFIX}/folder2/subfolder/deep-note`)
    })

    it('should delete entire tree recursively', async () => {
      // Verify data exists before deletion
      const rootNoteBefore = await noteService.getNote(TEST_PREFIX)
      expect(rootNoteBefore.note).toBe(`Content of ${TEST_PREFIX}`)

      await noteService.deleteRecursively(TEST_PREFIX)

      // Add a small delay to ensure all async operations complete
      await new Promise((resolve) => setTimeout(resolve, 10))

      const rootNote = await noteService.getNote(TEST_PREFIX)
      const note1 = await noteService.getNote(`${TEST_PREFIX}/folder1/note1`)
      const note2 = await noteService.getNote(`${TEST_PREFIX}/folder1/note2`)
      const deepNote = await noteService.getNote(`${TEST_PREFIX}/folder2/subfolder/deep-note`)

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
    const TEST_PREFIX = 'move-ops'

    beforeEach(async () => {
      // Create a hierarchical structure for testing
      const notesToCreate = [
        TEST_PREFIX,
        `${TEST_PREFIX}/folder1/note1`,
        `${TEST_PREFIX}/folder1/note2`,
        `${TEST_PREFIX}/folder2/subfolder/deep-note`,
      ]

      for (const noteId of notesToCreate) {
        const content = `Content of ${noteId}`
        await noteService.setNote({
          id: noteId,
          text: content,
          byClient: 'test-client',
        })
      }

      // Verify all notes were created successfully
      for (const noteId of notesToCreate) {
        const note = await noteService.getNote(noteId)
        if (note.note === '') {
          throw new Error(`Failed to create test data: ${noteId}`)
        }
      }
    })

    it('should move a single note', async () => {
      await noteService.moveRecursively(`${TEST_PREFIX}/folder1/note1`, `${TEST_PREFIX}/folder1/renamed-note`)

      // Old note should be empty
      const oldNote = await noteService.getNote(`${TEST_PREFIX}/folder1/note1`)
      expect(oldNote.note).toBe('')

      // New note should have the content
      const newNote = await noteService.getNote(`${TEST_PREFIX}/folder1/renamed-note`)
      expect(newNote.note).toBe(`Content of ${TEST_PREFIX}/folder1/note1`)
    })

    it('should move a folder and all its descendants', async () => {
      // Verify data exists before moving
      const note1Before = await noteService.getNote(`${TEST_PREFIX}/folder1/note1`)
      expect(note1Before.note).toBe(`Content of ${TEST_PREFIX}/folder1/note1`)

      await noteService.moveRecursively(`${TEST_PREFIX}/folder1`, `${TEST_PREFIX}-renamed-folder`)

      // Add a small delay to ensure all async operations complete
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Old notes should be empty
      const oldNote1 = await noteService.getNote(`${TEST_PREFIX}/folder1/note1`)
      const oldNote2 = await noteService.getNote(`${TEST_PREFIX}/folder1/note2`)
      expect(oldNote1.note).toBe('')
      expect(oldNote2.note).toBe('')

      // New notes should have the content
      const newNote1 = await noteService.getNote(`${TEST_PREFIX}-renamed-folder/note1`)
      const newNote2 = await noteService.getNote(`${TEST_PREFIX}-renamed-folder/note2`)
      expect(newNote1.note).toBe(`Content of ${TEST_PREFIX}/folder1/note1`)
      expect(newNote2.note).toBe(`Content of ${TEST_PREFIX}/folder1/note2`)
    })

    it('should move entire tree', async () => {
      // Verify data exists before moving
      const rootNoteBefore = await noteService.getNote(TEST_PREFIX)
      expect(rootNoteBefore.note).toBe(`Content of ${TEST_PREFIX}`)

      await noteService.moveRecursively(TEST_PREFIX, `${TEST_PREFIX}-moved-tree`)

      // Add a small delay to ensure all async operations complete
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Old notes should be empty
      const oldRoot = await noteService.getNote(TEST_PREFIX)
      const oldNote1 = await noteService.getNote(`${TEST_PREFIX}/folder1/note1`)
      const oldDeepNote = await noteService.getNote(`${TEST_PREFIX}/folder2/subfolder/deep-note`)
      expect(oldRoot.note).toBe('')
      expect(oldNote1.note).toBe('')
      expect(oldDeepNote.note).toBe('')

      // New notes should have the content
      const newRoot = await noteService.getNote(`${TEST_PREFIX}-moved-tree`)
      const newNote1 = await noteService.getNote(`${TEST_PREFIX}-moved-tree/folder1/note1`)
      const newDeepNote = await noteService.getNote(`${TEST_PREFIX}-moved-tree/folder2/subfolder/deep-note`)
      expect(newRoot.note).toBe(`Content of ${TEST_PREFIX}`)
      expect(newNote1.note).toBe(`Content of ${TEST_PREFIX}/folder1/note1`)
      expect(newDeepNote.note).toBe(`Content of ${TEST_PREFIX}/folder2/subfolder/deep-note`)
    })

    it('should prevent moving to descendant path', async () => {
      await expect(noteService.moveRecursively(TEST_PREFIX, `${TEST_PREFIX}/folder1/invalid`)).rejects.toThrow()
    })

    it('should prevent moving to existing target', async () => {
      // Create target note first
      const content = 'Existing target content'
      await noteService.setNote({
        id: `${TEST_PREFIX}-existing-target`,
        text: content,
        byClient: 'test-client',
      })

      await expect(
        noteService.moveRecursively(`${TEST_PREFIX}/folder1/note1`, `${TEST_PREFIX}-existing-target`),
      ).rejects.toThrow()
    })
  })

  describe('Error Handling', () => {
    const TEST_PREFIX = 'error-test'

    it('should throw error for hash mismatch', async () => {
      const noteId = `${TEST_PREFIX}-hash-mismatch`
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
      const noteId = `${TEST_PREFIX}-large-note`
      const largeContent = 'a'.repeat(100001) // Exceeds NOTE_MAX_SIZE (100000)

      await expect(
        noteService.setNote({
          id: noteId,
          text: largeContent,
          byClient: 'test-client',
        }),
      ).rejects.toThrow(UserError)
    })

    it('should handle concurrent patch operations', async () => {
      const noteId = `${TEST_PREFIX}-concurrent`
      const content1 = 'First content'
      const content2 = 'Second content'

      // Both operations should succeed because they're queued
      const promises = [
        noteService.setNote({
          id: noteId,
          text: content1,
          byClient: 'client1',
        }),
        noteService.setNote({
          id: noteId + '2',
          text: content2,
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
      const noteId = `${TEST_PREFIX}/with-dashes_and.dots`
      const content = 'Content with special characters'

      await noteService.setNote({
        id: noteId,
        text: content,
        byClient: 'test-client',
      })

      const note = await noteService.getNote(noteId)
      expect(note.note).toBe(content)
    })
  })

  describe('Edge Cases', () => {
    const TEST_PREFIX = 'edge-test'

    it('should handle moving note with empty content', async () => {
      const oldId = `${TEST_PREFIX}-empty`
      const newId = `${TEST_PREFIX}-moved-empty`

      // Create empty note (this should not actually create anything in DB)
      const note = await noteService.getNote(oldId)
      expect(note.note).toBe('')

      // Try to move empty note - should throw error
      await expect(noteService.moveRecursively(oldId, newId)).rejects.toThrow(UserError)
    })

    it('should handle deleting note with empty content', async () => {
      const noteId = `${TEST_PREFIX}-empty-delete`

      // Try to delete empty note - should not throw error
      await noteService.deleteRecursively(noteId)

      const note = await noteService.getNote(noteId)
      expect(note.note).toBe('')
    })

    it('should handle very deep nesting', async () => {
      const deepPath = `${TEST_PREFIX}-root/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z`
      const content = 'Deep nested content'

      await noteService.setNote({
        id: deepPath,
        text: content,
        byClient: 'test-client',
      })

      const note = await noteService.getNote(deepPath)
      expect(note.note).toBe(content)

      const descendants = await noteService.getDescendantNoteIds(`${TEST_PREFIX}-root`)
      expect(descendants).toContain(deepPath)
    })

    it('should handle note IDs with leading/trailing slashes', async () => {
      const noteId = `${TEST_PREFIX}-normal-path`
      const content = 'Normal content'

      await noteService.setNote({
        id: noteId,
        text: content,
        byClient: 'test-client',
      })

      // Test getting descendants with various slash patterns
      const descendants1 = await noteService.getDescendantNoteIds(`${TEST_PREFIX}-normal-path/`)
      const descendants2 = await noteService.getDescendantNoteIds(`/${TEST_PREFIX}-normal-path`)
      const descendants3 = await noteService.getDescendantNoteIds(`/${TEST_PREFIX}-normal-path/`)

      expect(descendants1).toEqual([])
      expect(descendants2).toEqual([])
      expect(descendants3).toEqual([])
    })
  })

  describe('Event Emission', () => {
    const TEST_PREFIX = 'event-test'

    it('should emit noteUpdate event when patching note', async () => {
      const noteId = `${TEST_PREFIX}-note-update`
      const content = 'Event test content'
      const expectedHash = hashString(content)

      let eventEmitted = false
      const handler = (data: any) => {
        expect(data.id).toBe(noteId)
        expect(data.h).toBe(expectedHash)
        expect(data.byClient).toBe('test-client')
        eventEmitted = true
      }

      const unsubscribe = noteService.on('noteUpdate', handler)

      try {
        await noteService.setNote({
          id: noteId,
          text: content,
          byClient: 'test-client',
        })

        expect(eventEmitted).toBe(true)
      } finally {
        unsubscribe() // Always clean up, even if test fails
      }
    })

    it('should emit treeUpdate event when note becomes non-empty', async () => {
      const noteId = `${TEST_PREFIX}-tree-non-empty`
      const content = 'Tree event test content'

      let treeEventEmitted = false
      const handler = (data: any) => {
        expect(data.rootId).toBe(noteId)
        treeEventEmitted = true
      }

      const unsubscribe = noteService.on('treeUpdate', handler)

      try {
        await noteService.setNote({
          id: noteId,
          text: content,
          byClient: 'test-client',
        })

        expect(treeEventEmitted).toBe(true)
      } finally {
        unsubscribe() // Always clean up, even if test fails
      }
    })

    it('should emit treeUpdate event when note becomes empty', async () => {
      const noteId = `${TEST_PREFIX}-tree-empty`
      const content = 'Content to be emptied'

      // Create note first
      await noteService.setNote({
        id: noteId,
        text: content,
        byClient: 'test-client',
      })

      let treeEventEmitted = false
      const handler = (data: any) => {
        expect(data.rootId).toBe(noteId)
        treeEventEmitted = true
      }

      const unsubscribe = noteService.on('treeUpdate', handler)

      try {
        // Empty the note
        await noteService.setNote({
          id: noteId,
          text: '',
          byClient: 'test-client',
        })

        expect(treeEventEmitted).toBe(true)
      } finally {
        unsubscribe() // Always clean up, even if test fails
      }
    })
  })
})
