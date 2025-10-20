export function getPageNumbers(totalPages: number, currentPage: number, maxPagesToShow = 7): (number | string)[] {
  const pages: (number | string)[] = []

  if (totalPages <= maxPagesToShow) {
    for (let i = 1; i <= totalPages; i += 1) {
      pages.push(i)
    }
    return pages
  }

  if (currentPage <= 4) {
    for (let i = 1; i <= 5; i += 1) {
      pages.push(i)
    }
    pages.push('...')
    pages.push(totalPages)
    return pages
  }

  if (currentPage >= totalPages - 3) {
    pages.push(1)
    pages.push('...')
    for (let i = totalPages - 4; i <= totalPages; i += 1) {
      pages.push(i)
    }
    return pages
  }

  pages.push(1)
  pages.push('...')
  for (let i = currentPage - 1; i <= currentPage + 1; i += 1) {
    pages.push(i)
  }
  pages.push('...')
  pages.push(totalPages)
  return pages
}

export function getPageDisplayRange(totalItems: number, currentPage: number, itemsPerPage: number) {
  if (totalItems === 0) {
    return { start: 0, end: 0 }
  }

  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems)

  return {
    start: startIndex + 1,
    end: endIndex,
  }
}
