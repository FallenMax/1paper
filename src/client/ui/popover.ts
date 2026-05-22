import { h, listenDom } from '../util/dom'
import './popover.css'

export type PopoverPlacement = 'right' | 'bottom-end'

export type PopoverVariant = 'menu' | 'panel'

export interface PopoverOptions {
  anchor: HTMLElement
  content: HTMLElement
  variant?: PopoverVariant
  placement?: PopoverPlacement
  onClose?: () => void
}

/**
 * Lightweight popover anchored to a trigger element. Positions itself with
 * `position: fixed` using the anchor's bounding rect, so it escapes any
 * overflow:auto / transformed ancestor. Dismisses on outside click or Escape.
 *
 * Only one popover is open per anchor at a time. Calling a show* helper for
 * an anchor that already has a popover toggles it closed (no flicker reopen).
 */
export class Popover {
  private dom: HTMLElement
  private cleanups: (() => void)[] = []
  private closed = false

  constructor(private opts: PopoverOptions) {
    const variant = opts.variant ?? 'panel'
    this.dom = h('div', { className: `popover popover--${variant}`, role: 'dialog' }, [opts.content])
  }

  open() {
    if (this.closed) return

    // Append invisibly, compute placement (sync), then reveal — avoids the
    // one-frame flash at a wrong-side position before the boundary flip.
    document.body.appendChild(this.dom)
    this.position()
    this.dom.classList.add('is-ready')

    popoverByAnchor.set(this.opts.anchor, this)
    currentPopover = this

    // Defer the dismiss listeners one frame so the click that opened the
    // popover doesn't immediately close it.
    const attachDismiss = () => {
      this.cleanups.push(
        listenDom(document, 'mousedown', (e) => {
          if (this.closed) return
          const target = e.target as Node
          if (this.dom.contains(target)) return
          // The anchor's own click is handled by the trigger logic
          // (toggle in the show* helpers); leave it to fire normally and
          // close from outside-of-anchor only.
          if (this.opts.anchor.contains(target)) return
          this.close()
        }),
      )
      this.cleanups.push(
        listenDom(document, 'keydown', (e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            this.close()
          }
        }),
      )
    }
    requestAnimationFrame(attachDismiss)

    this.cleanups.push(listenDom(window, 'resize', () => this.position()))
    this.cleanups.push(listenDom(window, 'scroll', () => this.position(), { capture: true }))

    // Auto-focus first focusable element
    const first = this.dom.querySelector<HTMLElement>('input, button')
    first?.focus()
  }

  close() {
    if (this.closed) return
    this.closed = true
    if (popoverByAnchor.get(this.opts.anchor) === this) {
      popoverByAnchor.delete(this.opts.anchor)
    }
    if (currentPopover === this) {
      currentPopover = null
    }
    for (const fn of this.cleanups) fn()
    this.cleanups = []
    this.dom.remove()
    this.opts.onClose?.()
  }

  private position() {
    const r = this.opts.anchor.getBoundingClientRect()
    const placement = this.opts.placement ?? 'right'
    const gap = 6

    this.dom.style.position = 'fixed'
    this.dom.style.transform = placement === 'bottom-end' ? 'translateX(-100%)' : ''

    if (placement === 'right') {
      this.dom.style.top = `${r.top}px`
      this.dom.style.left = `${r.right + gap}px`
    } else {
      this.dom.style.top = `${r.bottom + gap}px`
      this.dom.style.left = `${r.right}px`
    }

    // Boundary check is sync: getBoundingClientRect on the inserted element
    // forces a layout, so we can flip without waiting for a frame.
    const rect = this.dom.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    if (placement === 'right' && rect.right > vw - 8) {
      this.dom.style.left = `${Math.max(8, r.left - gap - rect.width)}px`
    }
    if (rect.bottom > vh - 8) {
      this.dom.style.top = `${Math.max(8, vh - 8 - rect.height)}px`
    }
  }
}

//-------------- Single-instance popover registry --------------

const popoverByAnchor = new WeakMap<HTMLElement, Popover>()
let currentPopover: Popover | null = null

/**
 * Ensure at most one popover is open at a time.
 * - Same anchor with active popover → close it, return true (toggle off; the
 *   caller should NOT open a new one).
 * - Different anchor → close the current popover, return false (the caller
 *   may open a new popover).
 */
function toggleOff(anchor: HTMLElement): boolean {
  const existing = popoverByAnchor.get(anchor)
  if (existing) {
    existing.close()
    return true
  }
  if (currentPopover) {
    currentPopover.close()
  }
  return false
}

//-------------- Helpers --------------

export interface ConfirmPopoverOptions {
  anchor: HTMLElement
  message: string
  itemList?: string[]
  confirmLabel: string
  isDanger?: boolean
  onConfirm: () => void
}

export function showConfirmPopover(opts: ConfirmPopoverOptions): Popover | null {
  if (toggleOff(opts.anchor)) return null
  let popover!: Popover

  const cancelBtn = h(
    'button',
    {
      className: 'popover-button',
      onclick: () => popover.close(),
    },
    'Cancel',
  )
  const confirmBtn = h(
    'button',
    {
      className: `popover-button is-primary ${opts.isDanger ? 'is-danger' : ''}`,
      onclick: () => {
        opts.onConfirm()
        popover.close()
      },
    },
    opts.confirmLabel,
  )

  const children: HTMLElement[] = [h('p', { className: 'popover-message' }, opts.message)]
  if (opts.itemList && opts.itemList.length > 0) {
    children.push(
      h(
        'ul',
        { className: 'popover-list' },
        opts.itemList.map((item) => h('li', {}, item)),
      ),
    )
  }
  children.push(h('div', { className: 'popover-actions' }, [cancelBtn, confirmBtn]))

  const content = h('div', { className: 'popover-body' }, children)
  popover = new Popover({ anchor: opts.anchor, content, variant: 'panel' })
  popover.open()
  return popover
}

export interface MenuPopoverOptions {
  anchor: HTMLElement
  items: { label: string; value: string; isDanger?: boolean }[]
  onSelect: (value: string) => void
  placement?: PopoverPlacement
}

export function showMenuPopover(opts: MenuPopoverOptions): Popover | null {
  if (toggleOff(opts.anchor)) return null
  let popover!: Popover

  const buttons = opts.items.map((item) =>
    h(
      'button',
      {
        className: `popover-menu-item ${item.isDanger ? 'is-danger' : ''}`,
        onclick: () => {
          // Close before onSelect so sync follow-up popovers (e.g. input) on the
          // same anchor are not swallowed by toggleOff.
          popover.close()
          opts.onSelect(item.value)
        },
      },
      item.label,
    ),
  )

  const content = h('div', { className: 'popover-menu' }, buttons)
  popover = new Popover({
    anchor: opts.anchor,
    content,
    variant: 'menu',
    placement: opts.placement ?? 'right',
  })
  popover.open()
  return popover
}

export interface InputPopoverOptions {
  anchor: HTMLElement
  prompt: string
  initialValue?: string
  placeholder?: string
  submitLabel: string
  onSubmit: (value: string) => void
}

export function showInputPopover(opts: InputPopoverOptions): Popover | null {
  if (toggleOff(opts.anchor)) return null
  let popover!: Popover

  const input = h('input', {
    className: 'popover-input',
    type: 'text',
    value: opts.initialValue ?? '',
    placeholder: opts.placeholder ?? '',
    spellcheck: false,
    autocomplete: 'off',
    onkeydown: (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        submit()
      }
    },
  }) as HTMLInputElement

  function submit() {
    const v = input.value.trim()
    if (!v) return
    opts.onSubmit(v)
    popover.close()
  }

  const cancelBtn = h(
    'button',
    { className: 'popover-button', onclick: () => popover.close() },
    'Cancel',
  )
  const submitBtn = h(
    'button',
    { className: 'popover-button is-primary', onclick: submit },
    opts.submitLabel,
  )

  const content = h('div', { className: 'popover-body' }, [
    h('p', { className: 'popover-message' }, opts.prompt),
    input,
    h('div', { className: 'popover-actions' }, [cancelBtn, submitBtn]),
  ])

  popover = new Popover({ anchor: opts.anchor, content, variant: 'panel' })
  popover.open()
  // Re-focus input (Popover.open focuses first focusable, which is the input)
  input.select()
  return popover
}
