import { Disposable } from '../../common/disposable'
import { icons } from '../icon/icons'
import { NoteService } from '../service/note.service'
import { UiStore } from '../store/ui.store'
import { Icon } from '../ui/icon'
import { Link } from '../ui/link'
import { Select } from '../ui/select'
import { h } from '../util/dom'
import { showError } from '../util/error'
import { Router } from '../util/router'
import { ViewController } from '../util/view_controller'
import './sidebar.css'

interface TreeNode {
  segment: string // Path segment, e.g., "my", "note"
  fullPath: string // Full path, e.g., "/jay/my"
  children: TreeNode[] // Child nodes
}

export class Sidebar extends Disposable implements ViewController {
  dom: HTMLElement
  private $noteList: HTMLUListElement
  private $header: HTMLElement
  private treeNoteIds: string[] = []
  get rootId() {
    return this.id.split('/')[0]
  }
  constructor(private id: string, private noteService: NoteService) {
    super()
    this.dom = h('aside', {}, [
      h('section', {}, [
        (this.$header = h('h3', {}, [new Icon(icons.folder).dom, `Notes in "${this.rootId}"`])),
        (this.$noteList = h('ul', { className: 'note-list' }, [])),
      ]),
    ])
  }
  async init() {
    this.register(
      UiStore.shared.on('treeVisibilityChanged', () => {
        this.applyExpandState()
      }),
    )

    // Listen for sidebar updates from server
    this.register(
      this.noteService.on('treeUpdate', ({ rootId }) => {
        // Only refresh if this sidebar's root matches the notification
        if (this.rootId === rootId) {
          this.updateTreeNoteIds()
        }
      }),
    )

    this.applyExpandState()
    await this.updateTreeNoteIds()
  }

  /** Build tree structure from note IDs */
  private buildTree(noteIds: string[]): TreeNode[] {
    const root: TreeNode = {
      segment: '',
      fullPath: '',
      children: [],
    }

    // Build tree structure from each note ID
    for (const noteId of noteIds) {
      const segments = noteId.split('/').filter((s) => s.length > 0)
      let current = root

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]
        const fullPath = '/' + segments.slice(0, i + 1).join('/')

        let child = current.children.find((c) => c.segment === segment)
        if (!child) {
          child = {
            segment,
            fullPath,
            children: [],
          }
          current.children.push(child)
        }

        current = child
      }
    }

    // Sort children at each level
    const sortTreeNodes = (nodes: TreeNode[]) => {
      nodes.sort((a, b) => a.segment.localeCompare(b.segment))
      for (const node of nodes) {
        sortTreeNodes(node.children)
      }
    }
    sortTreeNodes(root.children)

    return root.children
  }

  /** Render tree structure recursively */
  private renderTree(nodes: TreeNode[], level: number = 0): HTMLElement[] {
    const elements: HTMLElement[] = []

    for (const node of nodes) {
      elements.push(this.makeTreeItem(node, level))
      elements.push(...this.renderTree(node.children, level + 1))
    }

    return elements
  }

  private async updateTreeNoteIds() {
    this.treeNoteIds = await this.noteService.fetchTreeNoteIds(this.id)
    if (!this.treeNoteIds.includes(this.id)) {
      this.treeNoteIds.push(this.id)
    }
    this.treeNoteIds.sort()
    const treeNodes = this.buildTree(this.treeNoteIds)
    const elements = this.renderTree(treeNodes)
    this.$noteList.replaceChildren(...elements)
  }

  private makeTreeItem(node: TreeNode, level: number): HTMLElement {
    const noteId = node.fullPath.slice(1)
    const isCurrentNote = noteId === this.id

    const menuSelect = new Select({
      icon: icons.ellipsisHorizontal,
      label: 'Actions',
      initialValue: '',
      options: [
        { label: 'Delete', value: 'delete' },
        { label: 'Move', value: 'move' },
      ],
      onChange: async (action) => {
        if (action === 'delete') {
          await this.handleDelete(noteId)
        } else if (action === 'move') {
          await this.handleMove(noteId)
        }
      },
    })

    const linkElement = new Link({ href: node.fullPath, children: [node.segment] })

    const menuWrapper = h('div', { className: 'tree-item-menu' }, [menuSelect.dom])

    return h(
      'li',
      {
        className: `note-item ${isCurrentNote ? 'is-current' : ''}`,
        style: { paddingLeft: `${level * 16}px` },
      },
      [h('div', { className: 'tree-item-content' }, [linkElement.dom, menuWrapper])],
    )
  }

  private async handleDelete(noteId: string): Promise<void> {
    try {
      // Get all descendant notes that will be affected
      const descendantIds = await this.noteService.fetchDescendantNoteIds(noteId)
      const allAffectedIds = [noteId, ...descendantIds]

      // Show confirmation dialog
      let confirmMessage = `Are you sure you want to delete "${noteId}"?`

      if (descendantIds.length > 0) {
        confirmMessage += `\n\nThis will also delete ${descendantIds.length} child note(s):`
        const noteList = allAffectedIds.map((id) => `• ${id}`).join('\n')
        confirmMessage += `\n${noteList}`

        const expectedNumber = allAffectedIds.length
        const userInput = prompt(
          `${confirmMessage}\n\nTo confirm this dangerous operation, please enter the number of notes that will be deleted: ${expectedNumber}`,
        )

        if (userInput !== expectedNumber.toString()) {
          return // User cancelled or entered wrong number
        }
      } else {
        // Single note deletion, simple confirmation
        if (!confirm(confirmMessage)) {
          return
        }
      }

      // Proceed with deletion
      const result = await this.noteService.deleteNote(noteId)

      // If we just deleted the current note, navigate away
      if (noteId === this.id && this.id !== this.rootId) {
        await Router.shared.navigateTo(this.rootId)
      } else {
        // Refresh the tree
        await this.updateTreeNoteIds()
      }
    } catch (error) {
      showError(error)
    }
  }

  private async handleMove(oldId: string): Promise<void> {
    try {
      // Get all descendant notes that will be affected
      const descendantIds = await this.noteService.fetchDescendantNoteIds(oldId)
      const allAffectedIds = [oldId, ...descendantIds]

      // Get new path from user
      const newId = prompt(`Enter new path for "${oldId}":`, oldId)
      if (!newId || newId === oldId) {
        return
      }

      // Prevent moving to descendant path
      if (newId.startsWith(oldId + '/')) {
        alert(`Cannot move "${oldId}" to its own descendant path "${newId}".`)
        return
      }

      // Show confirmation dialog
      let confirmMessage = `Are you sure you want to move "${oldId}" to "${newId}"?`

      if (descendantIds.length > 0) {
        confirmMessage += `\n\nThis will also move ${descendantIds.length} child note(s):`

        // Show affected notes with their new paths
        const moveList = allAffectedIds
          .map((id) => {
            const targetId = id.replace(oldId, newId)
            return `• ${id} → ${targetId}`
          })
          .join('\n')
        confirmMessage += `\n${moveList}`

        const expectedNumber = allAffectedIds.length
        const userInput = prompt(
          `${confirmMessage}\n\nTo confirm this operation, please enter the number of notes that will be moved: ${expectedNumber}`,
        )

        if (userInput !== expectedNumber.toString()) {
          return // User cancelled or entered wrong number
        }
      } else {
        // Single note move, simple confirmation
        if (!confirm(confirmMessage)) {
          return
        }
      }

      // Proceed with move
      const result = await this.noteService.moveNote(oldId, newId)

      // If we just moved the current note, navigate to new location
      if (oldId === this.id) {
        await Router.shared.navigateTo(newId)
      } else {
        // Refresh the tree
        await this.updateTreeNoteIds()
      }
    } catch (error) {
      showError(error)
    }
  }

  private applyExpandState() {
    this.dom.style.display = UiStore.shared.isTreeVisible() ? 'block' : 'none'
  }

  /** Switch to a different note ID */
  async setId(newId: string): Promise<void> {
    if (newId === this.id) {
      return
    }

    this.id = newId
    this.$header.replaceChildren(new Icon(icons.folder).dom, `Notes in "${this.rootId}"`)

    await this.updateTreeNoteIds()
  }
}
