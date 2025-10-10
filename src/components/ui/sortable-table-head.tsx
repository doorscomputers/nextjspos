import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface SortableTableHeadProps {
  children: React.ReactNode
  sortKey?: string
  currentSortKey?: string | null
  currentSortDirection?: 'asc' | 'desc' | null
  onSort?: (key: string) => void
  className?: string
  align?: 'left' | 'center' | 'right'
}

export function SortableTableHead({
  children,
  sortKey,
  currentSortKey,
  currentSortDirection,
  onSort,
  className,
  align = 'left'
}: SortableTableHeadProps) {
  const isSortable = sortKey && onSort
  const isActive = currentSortKey === sortKey

  const handleClick = () => {
    if (isSortable) {
      onSort(sortKey)
    }
  }

  return (
    <th
      className={cn(
        "text-left text-foreground",
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        isSortable && 'cursor-pointer select-none hover:bg-muted/50 transition-colors',
        className
      )}
      onClick={handleClick}
    >
      <div className={cn(
        "flex items-center gap-2",
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center'
      )}>
        <span>{children}</span>
        {isSortable && (
          <span className="inline-flex">
            {!isActive && <ArrowUpDown className="h-4 w-4 text-muted-foreground" />}
            {isActive && currentSortDirection === 'asc' && (
              <ArrowUp className="h-4 w-4 text-primary" />
            )}
            {isActive && currentSortDirection === 'desc' && (
              <ArrowDown className="h-4 w-4 text-primary" />
            )}
          </span>
        )}
      </div>
    </th>
  )
}
