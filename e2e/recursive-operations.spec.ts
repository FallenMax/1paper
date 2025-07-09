import { expect, test } from '@playwright/test'

/**
 * Helper function to wait for editor to be ready
 */
async function waitForEditor(page: any) {
  await page.waitForSelector('#app', { timeout: 1000 })
  await page.waitForSelector('textarea.editor', { timeout: 1000 })
  await page.waitForFunction(
    () => {
      const editor = document.querySelector('textarea.editor') as HTMLTextAreaElement
      return editor && !editor.disabled && editor.value !== 'Loading...'
    },
    { timeout: 1000 },
  )
}

/**
 * Helper function to set editor content
 */
async function setEditorContent(page: any, content: string) {
  await page.evaluate((content) => {
    const editor = document.querySelector('textarea.editor') as HTMLTextAreaElement
    editor.value = content
    editor.dispatchEvent(new InputEvent('input'))
  }, content)
}

/**
 * Helper function to wait for save status to be idle
 */
async function waitForSaveIdle(page: any) {
  await page.waitForTimeout(200)
}

/**
 * Helper function to get editor content
 */
async function getEditorContent(page: any) {
  return await page.evaluate(() => {
    const editor = document.querySelector('textarea.editor') as HTMLTextAreaElement
    return editor.value
  })
}

test.describe('Recursive Operations', () => {
  test('should recursively delete note with children', async ({ page }) => {
    const rootNote = 'recursive-delete-' + Date.now()
    const childNote1 = `${rootNote}/child1`
    const childNote2 = `${rootNote}/child2`
    const grandChildNote = `${childNote1}/grandchild`

    // Create a hierarchy of notes
    await page.goto(`/${rootNote}`)
    await waitForEditor(page)
    await setEditorContent(page, 'Root note content')
    await waitForSaveIdle(page)

    await page.goto(`/${childNote1}`)
    await waitForEditor(page)
    await setEditorContent(page, 'Child 1 content')
    await waitForSaveIdle(page)

    await page.goto(`/${childNote2}`)
    await waitForEditor(page)
    await setEditorContent(page, 'Child 2 content')
    await waitForSaveIdle(page)

    await page.goto(`/${grandChildNote}`)
    await waitForEditor(page)
    await setEditorContent(page, 'Grandchild content')
    await waitForSaveIdle(page)

    // Go back to root and open sidebar
    await page.goto(`/${rootNote}`)
    await waitForEditor(page)

    await page.click('button[title="Menu"]')
    await page.click('button[title="Tree"]')
    await page.waitForSelector('aside', { state: 'visible' })

    // Find the root note and try to delete it
    const rootNoteItem = page.locator(`.note-item:has-text("${rootNote.split('/').pop()}")`).first()
    await rootNoteItem.hover()
    await page.waitForTimeout(500)

    // Setup dialog handler for the confirmation
    let dialogCount = 0
    page.on('dialog', (dialog) => {
      dialogCount++
      if (dialogCount === 1) {
        // First dialog should show the list and ask for confirmation number
        expect(dialog.message()).toContain('This will also delete 3 child note(s)')
        expect(dialog.message()).toContain('enter the number of notes that will be deleted: 4')
        dialog.accept('4') // Enter the correct number
      }
    })

    // Trigger delete operation
    await rootNoteItem.locator('.select-wrapper select').selectOption('delete', { force: true })
    await page.waitForTimeout(300)

    // Verify we navigated to empty root
    await page.waitForURL(`/${rootNote}`, { timeout: 500 })

    // Verify editor is empty (all notes deleted)
    const editorContent = await getEditorContent(page)
    expect(editorContent).toBe('')
  })

  test('should recursively move note with children', async ({ page }) => {
    const sourceRoot = 'move-source-' + Date.now()
    const sourceChild = `${sourceRoot}/child`
    const sourceGrandchild = `${sourceChild}/grandchild`
    const targetRoot = 'move-target-' + Date.now()

    // Create source hierarchy
    await page.goto(`/${sourceRoot}`)
    await waitForEditor(page)
    await setEditorContent(page, 'Source root content')
    await waitForSaveIdle(page)

    await page.goto(`/${sourceChild}`)
    await waitForEditor(page)
    await setEditorContent(page, 'Source child content')
    await waitForSaveIdle(page)

    await page.goto(`/${sourceGrandchild}`)
    await waitForEditor(page)
    await setEditorContent(page, 'Source grandchild content')
    await waitForSaveIdle(page)

    // Go back to source root and open sidebar
    await page.goto(`/${sourceRoot}`)
    await waitForEditor(page)

    await page.click('button[title="Menu"]')
    await page.click('button[title="Tree"]')
    await page.waitForSelector('aside', { state: 'visible' })

    // Find the source root note and try to move it
    const sourceNoteItem = page.locator(`.note-item:has-text("${sourceRoot.split('/').pop()}")`).first()
    await sourceNoteItem.hover()
    await page.waitForTimeout(500)

    // Setup dialog handlers
    let dialogCount = 0
    page.on('dialog', (dialog) => {
      dialogCount++
      if (dialogCount === 1) {
        // First dialog asks for new path
        expect(dialog.message()).toContain('Enter new path')
        dialog.accept(targetRoot)
      } else if (dialogCount === 2) {
        // Second dialog shows move confirmation
        expect(dialog.message()).toContain('This will also move 2 child note(s)')
        expect(dialog.message()).toContain('enter the number of notes that will be moved: 3')
        dialog.accept('3') // Enter the correct number
      }
    })

    // Trigger move operation
    await sourceNoteItem.locator('.select-wrapper select').selectOption('move', { force: true })
    await page.waitForTimeout(300)

    // Verify we navigated to the new location
    await page.waitForURL(`/${targetRoot}`, { timeout: 500 })

    // Verify content is preserved
    const editorContent = await getEditorContent(page)
    expect(editorContent).toBe('Source root content')

    // Verify child note was moved
    await page.goto(`/${targetRoot}/child`)
    await waitForEditor(page)
    const childContent = await getEditorContent(page)
    expect(childContent).toBe('Source child content')

    // Verify grandchild note was moved
    await page.goto(`/${targetRoot}/child/grandchild`)
    await waitForEditor(page)
    const grandchildContent = await getEditorContent(page)
    expect(grandchildContent).toBe('Source grandchild content')

    // Verify source is empty
    await page.goto(`/${sourceRoot}`)
    await waitForEditor(page)
    const sourceContent = await getEditorContent(page)
    expect(sourceContent).toBe('')
  })

  test('should handle wrong confirmation number', async ({ page }) => {
    const testNote = 'wrong-confirm-' + Date.now()
    const childNote = `${testNote}/child`

    // Create parent and child
    await page.goto(`/${testNote}`)
    await waitForEditor(page)
    await setEditorContent(page, 'Parent content')
    await waitForSaveIdle(page)

    await page.goto(`/${childNote}`)
    await waitForEditor(page)
    await setEditorContent(page, 'Child content')
    await waitForSaveIdle(page)

    // Go back to parent and try to delete
    await page.goto(`/${testNote}`)
    await waitForEditor(page)

    await page.click('button[title="Menu"]')
    await page.click('button[title="Tree"]')
    await page.waitForSelector('aside', { state: 'visible' })

    const noteItem = page.locator(`.note-item:has-text("${testNote.split('/').pop()}")`).first()
    await noteItem.hover()
    await page.waitForTimeout(500)

    // Setup dialog handler to enter wrong number
    page.on('dialog', (dialog) => {
      dialog.accept('1') // Wrong number - should be 2
    })

    // Trigger delete operation
    await noteItem.locator('.select-wrapper select').selectOption('delete', { force: true })
    await page.waitForTimeout(200)

    // Verify notes were NOT deleted (content should still be there)
    const editorContent = await getEditorContent(page)
    expect(editorContent).toBe('Parent content')

    // Verify child note still exists
    await page.goto(`/${childNote}`)
    await waitForEditor(page)
    const childContent = await getEditorContent(page)
    expect(childContent).toBe('Child content')
  })
})
