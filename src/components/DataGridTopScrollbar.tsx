'use client'

import { useCallback, useRef, useState } from 'react'
import type { ContentReadyEvent } from 'devextreme/ui/data_grid'

type Scrollable = ReturnType<ContentReadyEvent['component']['getScrollable']>

/**
 * Shared horizontal scrollbar shown ABOVE a DevExtreme DataGrid, kept in step with
 * the grid's own bottom scrollbar. Hidden when nothing is cut off.
 * Usage: const top = useDataGridTopScrollbar()
 *        <DataGridTopScrollbar bar={top} />  <DataGrid onContentReady={top.onContentReady} ...>
 */
export function useDataGridTopScrollbar() {
  const scrollableRef = useRef<Scrollable | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const syncing = useRef(false)
  const [size, setSize] = useState({ content: 0, client: 0 })

  const onContentReady = useCallback((e: ContentReadyEvent) => {
    const scrollable = e.component.getScrollable()
    if (!scrollable) return
    if (scrollableRef.current !== scrollable) {
      scrollableRef.current = scrollable
      // Grid scrolled (bottom bar, wheel, touch) → move the top bar.
      scrollable.on('scroll', (ev: { scrollOffset?: { left: number } }) => {
        if (syncing.current) return
        const left = ev.scrollOffset?.left ?? scrollable.scrollLeft()
        if (barRef.current && barRef.current.scrollLeft !== left) {
          syncing.current = true
          barRef.current.scrollLeft = left
          requestAnimationFrame(() => (syncing.current = false))
        }
      })
    }
    const next = { content: scrollable.scrollWidth(), client: scrollable.clientWidth() }
    setSize(prev => (prev.content === next.content && prev.client === next.client ? prev : next))
  }, [])

  /** Top bar scrolled → move the grid. */
  const onBarScroll = useCallback(() => {
    if (syncing.current || !barRef.current || !scrollableRef.current) return
    syncing.current = true
    scrollableRef.current.scrollTo({ left: barRef.current.scrollLeft })
    requestAnimationFrame(() => (syncing.current = false))
  }, [])

  return { barRef, size, onContentReady, onBarScroll }
}

export function DataGridTopScrollbar({ bar }: { bar: ReturnType<typeof useDataGridTopScrollbar> }) {
  const { barRef, size, onBarScroll } = bar
  const visible = size.content > size.client + 1
  return (
    <div
      ref={barRef}
      onScroll={onBarScroll}
      aria-hidden="true"
      className={visible ? 'overflow-x-auto overflow-y-hidden h-4 border-b border-gray-200 dark:border-gray-700' : 'hidden'}
    >
      <div style={{ width: size.content, height: 1 }} />
    </div>
  )
}
