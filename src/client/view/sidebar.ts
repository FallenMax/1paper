import { Disposable } from '../../common/disposable'
import { UserError } from '../../common/error'
import { icons } from '../icon/icons'
import { NoteService } from '../service/note.service'
import { UiStore } from '../store/ui.store'
import { IconButton } from '../ui/icon_button'
import { Link } from '../ui/link'
import { showConfirmPopover, showInputPopover, showMenuPopover } from '../ui/popover'
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
  private $addInput!: HTMLInputElement
  private treeNoteIds: string[] = []
  get rootId() {
    return this.id.split('/')[0]
  }
  constructor(private id: string, private noteService: NoteService) {
    super()
    this.dom = h('aside', { className: 'sidebar' }, [
      (this.$noteList = h('ul', { className: 'note-list' }, [])),
      this.makeAddFooter(),
    ])
  }

  async init() {
    this.register(
      UiStore.shared.on('treeVisibilityChanged', () => {
        this.applyExpandState()
      }),
    )

    this.register(
      this.noteService.on('treeUpdate', ({ rootId }) => {
        if (this.rootId === rootId) {
          this.updateTreeNoteIds()
        }
      }),
    )

    this.applyExpandState()
    await this.updateTreeNoteIds()
  }

  private makeAddFooter(): HTMLElement {
    this.$addInput = h('input', {
      className: 'add-note-input',
      type: 'text',
      placeholder: 'new note',
      spellcheck: false,
      autocomplete: 'off',
      onkeydown: (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          this.submitNewNote()
        } else if (e.key === 'Escape') {
          this.$addInput.value = ''
          this.$addInput.blur()
        }
      },
    }) as HTMLInputElement

    const $addButton = new IconButton({
      icon: icons.addOutline,
      buttonOptions: {
        title: 'Create note',
        onclick: () => this.submitNewNote(),
      },
    }).dom

    return h('div', { className: 'sidebar-footer' }, [
      h('form', { className: 'add-note-form', onsubmit: (e: Event) => e.preventDefault() }, [
        this.$addInput,
        $addButton,
      ]),
    ])
  }

  private submitNewNote() {
    const raw = this.$addInput.value.trim()
    if (!raw) return
    const name = raw.replace(/^\/+/, '').replace(/\s+/g, '-')
    if (!name) return
    const targetPath = name.includes('/') ? name : `${this.rootId}/${name}`
    this.$addInput.value = ''
    Router.shared.navigateTo(targetPath)
  }

  /** Build tree structure from note IDs */
  private buildTree(noteIds: string[]): TreeNode[] {
    const root: TreeNode = {
      segment: '',
      fullPath: '',
      children: [],
    }

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

    const menuButton = new IconButton({
      icon: icons.ellipsisHorizontal,
      buttonOptions: {
        title: 'Actions',
        onclick: (e: MouseEvent) => {
          e.stopPropagation()
          showMenuPopover({
            anchor: menuButton.dom,
            items: [
              { label: 'New sub-note', value: 'addChild' },
              { label: 'Move to…', value: 'move' },
              { label: 'Delete note', value: 'delete', isDanger: true },
            ],
            onSelect: (action) => {
              if (action === 'addChild') {
                this.handleAddChild(noteId, menuButton.dom)
              } else if (action === 'delete') {
                this.handleDelete(noteId, menuButton.dom)
              } else if (action === 'move') {
                this.handleMove(noteId, menuButton.dom)
              }
            },
          })
        },
      },
    })

    const linkElement = new Link({ href: node.fullPath, children: [node.segment] })

    const menuWrapper = h('div', { className: 'tree-item-menu' }, [menuButton.dom])

    return h(
      'li',
      {
        className: `note-item ${isCurrentNote ? 'is-current' : ''}`,
        style: level > 0 ? { marginLeft: `${level * 12}px` } : undefined,
      },
      [h('div', { className: 'tree-item-content' }, [linkElement.dom, menuWrapper])],
    )
  }

  private handleAddChild(parentNoteId: string, anchor: HTMLElement): void {
    showInputPopover({
      anchor,
      prompt: `New child under ${parentNoteId}`,
      placeholder: 'name',
      submitLabel: 'Create',
      onSubmit: (childName) => {
        const sanitized = childName.trim().replace(/\s+/g, '-')
        if (!sanitized) return
        Router.shared.navigateTo(`${parentNoteId}/${sanitized}`).catch(showError)
      },
    })
  }

  private async handleDelete(noteId: string, anchor: HTMLElement): Promise<void> {
    try {
      const descendantIds = await this.noteService.fetchDescendantNoteIds(noteId)
      const total = descendantIds.length + 1
      const hasDescendants = descendantIds.length > 0

      showConfirmPopover({
        anchor,
        message: hasDescendants
          ? `Delete ${noteId} and ${descendantIds.length} sub-note${descendantIds.length === 1 ? '' : 's'}?`
          : `Delete ${noteId}?`,
        itemList: hasDescendants ? [noteId, ...descendantIds].slice(0, 12) : undefined,
        confirmLabel: hasDescendants ? `Delete ${total} notes` : 'Delete',
        isDanger: true,
        onConfirm: async () => {
          try {
            await this.noteService.deleteNote(noteId)
            if (noteId === this.id && this.id !== this.rootId) {
              await Router.shared.navigateTo(this.rootId)
            } else {
              await this.updateTreeNoteIds()
            }
          } catch (error) {
            showError(error)
          }
        },
      })
    } catch (error) {
      showError(error)
    }
  }

  /** Map the open note id after moving a subtree (e.g. 1/2 → 3/2 when moving 1 → 3). */
  private notePathAfterMove(currentId: string, oldId: string, target: string): string | null {
    if (currentId === oldId) return target
    const childPrefix = oldId + '/'
    if (currentId.startsWith(childPrefix)) {
      return target + currentId.slice(oldId.length)
    }
    return null
  }

  private async handleMove(oldId: string, anchor: HTMLElement): Promise<void> {
    try {
      const descendantIds = await this.noteService.fetchDescendantNoteIds(oldId)
      const hasDescendants = descendantIds.length > 0

      showInputPopover({
        anchor,
        prompt: hasDescendants
          ? `Move ${oldId} (and ${descendantIds.length} sub-note${descendantIds.length === 1 ? '' : 's'}) to`
          : `Move ${oldId} to`,
        initialValue: oldId,
        placeholder: 'new path',
        submitLabel: 'Move',
        onSubmit: async (newId) => {
          const target = newId.trim()
          if (!target || target === oldId) return
          if (target.startsWith(oldId + '/')) {
            showError(
              new UserError(
                `Cannot move "${oldId}" into its own descendant path "${target}". Use a path outside this note's tree.`,
              ),
            )
            return
          }
          try {
            await this.noteService.moveNote(oldId, target)
            const newCurrentId = this.notePathAfterMove(this.id, oldId, target)
            if (newCurrentId != null) {
              await Router.shared.navigateTo(newCurrentId)
            } else {
              await this.updateTreeNoteIds()
            }
          } catch (error) {
            showError(error)
          }
        },
      })
    } catch (error) {
      showError(error)
    }
  }

  private applyExpandState() {
    // Visibility is now controlled by the parent (main.is-sidebar-open)
    // No-op kept to satisfy event subscription contract.
  }

  /** Switch to a different note ID */
  async setId(newId: string): Promise<void> {
    if (newId === this.id) {
      return
    }
    this.id = newId
    await this.updateTreeNoteIds()
  }
}
