/**
 * Reusable Column Visibility Toggle Component
 *
 * Usage:
 * <ColumnVisibilityToggle
 *   columns={columns}
 *   visibleColumns={visibleColumns}
 *   onToggle={setVisibleColumns}
 * />
 */

import { useState, useRef, useEffect } from 'react'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

export interface Column {
  id: string
  label: string
  required?: boolean // Required columns cannot be hidden
}

interface ColumnVisibilityToggleProps {
  columns?: Column[]
  availableColumns?: Column[] // Accept both prop names for backwards compatibility
  visibleColumns: string[]
  onToggle?: (visibleColumns: string[]) => void
  onChange?: (visibleColumns: string[]) => void // Accept both prop names
  className?: string
}

export default function ColumnVisibilityToggle({
  columns: columnsProp,
  availableColumns,
  visibleColumns,
  onToggle: onToggleProp,
  onChange,
  className = ''
}: ColumnVisibilityToggleProps) {
  // Use whichever prop was provided
  const columns = columnsProp || availableColumns || []
  const onToggle = onToggleProp || onChange || (() => {})
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const toggleColumn = (columnId: string) => {
    const column = columns.find(c => c.id === columnId)
    if (column?.required) return // Cannot toggle required columns

    if (visibleColumns.includes(columnId)) {
      onToggle(visibleColumns.filter(id => id !== columnId))
    } else {
      onToggle([...visibleColumns, columnId])
    }
  }

  const showAll = () => {
    onToggle(columns.map(c => c.id))
  }

  const hideAll = () => {
    onToggle(columns.filter(c => c.required).map(c => c.id))
  }

  const visibleCount = visibleColumns.length
  const totalCount = columns.length

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <EyeIcon className="w-5 h-5" />
        <span>Columns ({visibleCount}/{totalCount})</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Show/Hide Columns</h3>
            <div className="flex gap-2 mt-2">
              <button
                onClick={showAll}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Show All
              </button>
              <button
                onClick={hideAll}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Hide All
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto py-2">
            {columns.map((column) => {
              const isVisible = visibleColumns.includes(column.id)
              const isRequired = column.required

              return (
                <label
                  key={column.id}
                  className={`flex items-center gap-3 px-4 py-2 hover:bg-gray-50 ${
                    isRequired ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => toggleColumn(column.id)}
                    disabled={isRequired}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    {isVisible ? (
                      <EyeIcon className="w-4 h-4 text-blue-600" />
                    ) : (
                      <EyeSlashIcon className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-900">
                      {column.label}
                      {isRequired && <span className="text-xs text-gray-500 ml-1">(required)</span>}
                    </span>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
