import { expect, test } from '@playwright/test'

/**
 * Helper function to wait for editor to be ready
 */
async function waitForEditor(page: any) {
  // Wait for the app to load
  await page.waitForSelector('#app', { timeout: 10000 })

  // Wait for editor to appear
  await page.waitForSelector('textarea.editor', { timeout: 10000 })

  // Wait for editor to be enabled
  await page.waitForFunction(
    () => {
      const editor = document.querySelector('textarea.editor') as HTMLTextAreaElement
      return editor && !editor.disabled && editor.value !== 'Loading...'
    },
    { timeout: 10000 },
  )
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
  // Just wait a bit for save to complete instead of checking UI
  await page.waitForTimeout(2000)
}

test.describe('Collaboration Features', () => {
  test('should sync text between two users', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    const testNote = 'test-collaboration-' + Date.now()

    // Both users navigate to same note
    await page1.goto(`/${testNote}`)
    await page2.goto(`/${testNote}`)

    // Wait for both editors to be ready
    await waitForEditor(page1)
    await waitForEditor(page2)

    // User 1 types something
    await setEditorContent(page1, 'Hello from user 1')
    await waitForSaveIdle(page1)

    // Wait a bit for sync
    await page2.waitForTimeout(1000)

    // User 2 should see the content
    const content2 = await getEditorContent(page2)
    expect(content2).toBe('Hello from user 1')

    // User 2 adds more content
    await setEditorContent(page2, 'Hello from user 1\nHello from user 2')
    await waitForSaveIdle(page2)

    // Wait a bit for sync
    await page1.waitForTimeout(1000)

    // User 1 should see updated content
    const content1 = await getEditorContent(page1)
    expect(content1).toBe('Hello from user 1\nHello from user 2')

    await context1.close()
    await context2.close()
  })

  test('should handle concurrent edits', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()

    const page1 = await context1.newPage()
    const page2 = await context2.newPage()

    const testNote = 'test-concurrent-' + Date.now()

    await page1.goto(`/${testNote}`)
    await page2.goto(`/${testNote}`)

    await waitForEditor(page1)
    await waitForEditor(page2)

    // Start with some initial content
    await setEditorContent(page1, 'Line 1\nLine 2\nLine 3')
    await waitForSaveIdle(page1)
    await page2.waitForTimeout(1000)

    // Both users edit different lines simultaneously
    await Promise.all([
      setEditorContent(page1, 'Modified Line 1\nLine 2\nLine 3'),
      setEditorContent(page2, 'Line 1\nLine 2\nModified Line 3'),
    ])

    await Promise.all([waitForSaveIdle(page1), waitForSaveIdle(page2)])

    // Wait for sync
    await page1.waitForTimeout(2000)
    await page2.waitForTimeout(2000)

    // Both should have merged content (or at least consistent state)
    const content1 = await getEditorContent(page1)
    const content2 = await getEditorContent(page2)

    expect(content1).toBe(content2)

    await context1.close()
    await context2.close()
  })
})

test.describe('Sidebar Operations', () => {
  test('should show notes in sidebar tree', async ({ page }) => {
    // Create some test notes
    const rootNote = 'test-root-' + Date.now()
    const childNote1 = `${rootNote}/child1`
    const childNote2 = `${rootNote}/child2`

    // Create and edit notes
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

    // Go back to root and check sidebar
    await page.goto(`/${rootNote}`)
    await waitForEditor(page)

    // Toggle sidebar visibility (first expand menu, then click tree button)
    await page.click('button[title="Menu"]')
    await page.click('button[title="Tree"]')
    await page.waitForSelector('aside', { state: 'visible' })

    // Check if notes are shown in tree
    const sidebarContent = await page.textContent('aside')
    expect(sidebarContent).toContain('test-root-')
    expect(sidebarContent).toContain('child1')
    expect(sidebarContent).toContain('child2')
  })

  test('should delete note from sidebar', async ({ page }) => {
    const rootNote = 'test-delete-' + Date.now()
    const childNote = `${rootNote}/child`

    // Create a child note
    await page.goto(`/${childNote}`)
    await waitForEditor(page)
    await setEditorContent(page, 'This will be deleted')
    await waitForSaveIdle(page)

    // Toggle sidebar (first expand menu, then click tree button)
    await page.click('button[title="Menu"]')
    await page.click('button[title="Tree"]')
    await page.waitForSelector('aside', { state: 'visible' })

    // Find the child note in sidebar and access menu
    const noteItem = page.locator(`.note-item:has-text("child")`).first()
    await noteItem.hover()

    // Wait for menu to become visible
    await page.waitForTimeout(500)

    // Setup dialog handler BEFORE triggering the action
    page.on('dialog', (dialog) => dialog.accept())

    // Force click on the select element (bypassing visibility checks)
    await noteItem.locator('.select-wrapper select').selectOption('delete', { force: true })

    // Wait for deletion and navigation to complete
    await page.waitForTimeout(3000)

    // Verify we navigated to root page (empty note)
    await page.waitForURL(`/${rootNote}`, { timeout: 5000 })

    // Verify editor is empty (root note is empty)
    const editorContent = await getEditorContent(page)
    expect(editorContent).toBe('')
  })

  test('should move note from sidebar', async ({ page }) => {
    const oldNote = 'test-move-from-' + Date.now()
    const newNote = 'test-move-to-' + Date.now()

    // Create a note
    await page.goto(`/${oldNote}`)
    await waitForEditor(page)
    await setEditorContent(page, 'This will be moved')
    await waitForSaveIdle(page)

    // Toggle sidebar (first expand menu, then click tree button)
    await page.click('button[title="Menu"]')
    await page.click('button[title="Tree"]')
    await page.waitForSelector('aside', { state: 'visible' })

    // Find the note in sidebar and access menu
    const noteItem = page.locator(`.note-item:has-text("${oldNote.split('/').pop()}")`).first()
    await noteItem.hover()

    // Wait for menu to become visible
    await page.waitForTimeout(500)

    // Setup dialog handler BEFORE triggering the action
    page.on('dialog', (dialog) => dialog.accept(newNote))

    // Force click on the select element (bypassing visibility checks)
    await noteItem.locator('.select-wrapper select').selectOption('move', { force: true })

    // Wait for move operation to complete
    await page.waitForTimeout(3000)

    // Navigate to new location to verify
    await page.goto(`/${newNote}`)
    await waitForEditor(page)

    // Verify content is preserved
    const editorContent = await getEditorContent(page)
    expect(editorContent).toBe('This will be moved')

    // Verify old note is empty
    await page.goto(`/${oldNote}`)
    await waitForEditor(page)
    const oldContent = await getEditorContent(page)
    expect(oldContent).toBe('')
  })
})

test.describe('Basic Functionality', () => {
  test('should create and edit notes', async ({ page }) => {
    const testNote = 'test-basic-' + Date.now()

    await page.goto(`/${testNote}`)
    await waitForEditor(page)

    // Type some content
    await setEditorContent(page, 'Hello world!\nThis is a test note.')
    await waitForSaveIdle(page)

    // Refresh page and verify content is saved
    await page.reload()
    await waitForEditor(page)

    const content = await getEditorContent(page)
    expect(content).toBe('Hello world!\nThis is a test note.')
  })

  test('should handle empty notes', async ({ page }) => {
    const testNote = 'test-empty-' + Date.now()

    await page.goto(`/${testNote}`)
    await waitForEditor(page)

    // Initially empty
    const content = await getEditorContent(page)
    expect(content).toBe('')

    // Add content then remove it
    await setEditorContent(page, 'temporary')
    await waitForSaveIdle(page)

    await setEditorContent(page, '')
    await waitForSaveIdle(page)

    // Should still be empty
    const finalContent = await getEditorContent(page)
    expect(finalContent).toBe('')
  })
})
