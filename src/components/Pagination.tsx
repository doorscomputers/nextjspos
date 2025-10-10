/**
 * Reusable Pagination Component
 *
 * Usage:
 * <Pagination
 *   currentPage={currentPage}
 *   totalPages={totalPages}  // OR totalItems + itemsPerPage
 *   onPageChange={(page) => setCurrentPage(page)}
 * />
 */

interface PaginationProps {
  currentPage: number
  totalPages?: number
  totalItems?: number
  itemsPerPage?: number
  onPageChange: (page: number) => void
  className?: string
}

export default function Pagination({
  currentPage,
  totalPages: totalPagesProp,
  totalItems,
  itemsPerPage,
  onPageChange,
  className = ''
}: PaginationProps) {
  // Calculate totalPages if totalItems and itemsPerPage are provided
  const totalPages = totalPagesProp ?? (totalItems && itemsPerPage ? Math.ceil(totalItems / itemsPerPage) : 1)
  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxPagesToShow = 7

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 3) {
        pages.push(1)
        pages.push('...')
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
      } else {
        pages.push(1)
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
        pages.push('...')
        pages.push(totalPages)
      }
    }
    return pages
  }

  const handlePageChange = (page: number) => {
    onPageChange(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (totalPages <= 1) return null

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {/* Previous button */}
      <button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Previous
      </button>

      {/* Page numbers */}
      <div className="hidden sm:flex items-center gap-1">
        {getPageNumbers().map((page, index) => (
          page === '...' ? (
            <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-500">...</span>
          ) : (
            <button
              key={page}
              onClick={() => handlePageChange(page as number)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === page
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {page}
            </button>
          )
        ))}
      </div>

      {/* Mobile page indicator */}
      <div className="sm:hidden text-sm text-gray-600">
        Page {currentPage} of {totalPages}
      </div>

      {/* Next button */}
      <button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Next
      </button>
    </div>
  )
}

/**
 * Items Per Page Selector Component
 */
interface ItemsPerPageProps {
  value: number
  onChange: (value: number) => void
  options?: number[]
  className?: string
}

export function ItemsPerPage({
  value,
  onChange,
  options = [10, 25, 50, 100, 500],
  className = ''
}: ItemsPerPageProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-sm text-gray-600">Items per page:</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  )
}

/**
 * Results Info Component
 */
interface ResultsInfoProps {
  currentPage?: number
  itemsPerPage?: number
  startIndex?: number
  endIndex?: number
  totalItems: number
  itemName?: string
  className?: string
}

export function ResultsInfo({
  currentPage,
  itemsPerPage,
  startIndex,
  endIndex,
  totalItems,
  itemName = 'items',
  className = ''
}: ResultsInfoProps) {
  // Calculate indices if currentPage and itemsPerPage are provided
  let start = startIndex ?? 0
  let end = endIndex ?? 0

  if (currentPage !== undefined && itemsPerPage !== undefined) {
    start = (currentPage - 1) * itemsPerPage
    end = start + itemsPerPage
  }

  const displayStart = Math.min(start + 1, totalItems)
  const displayEnd = Math.min(end, totalItems)

  return (
    <div className={`text-sm text-gray-600 ${className}`}>
      Showing <strong>{displayStart}</strong> to <strong>{displayEnd}</strong> of <strong>{totalItems}</strong> {itemName}
    </div>
  )
}
