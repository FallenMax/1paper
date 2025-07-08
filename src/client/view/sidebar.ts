import { Disposable } from '../../common/disposable'
import { icons } from '../icon/icons'
import { NoteService } from '../service/note.service'
import { UiStore } from '../store/ui.store'
import { Icon } from '../ui/icon'
import { Link } from '../ui/link'
import { h } from '../util/dom'
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
    return h(
      'li',
      {
        className: `note-item ${node.fullPath.slice(1) === this.id ? 'is-current' : ''}`,
        style: { paddingLeft: `${level * 16}px` },
      },
      [new Link({ href: node.fullPath, children: [node.segment] }).dom],
    )
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
