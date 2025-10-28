'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X, Filter, ChevronDown } from 'lucide-react'
import { Tutorial, TUTORIAL_CATEGORIES } from '@/lib/help-content'

interface SearchBarProps {
  onSearch: (query: string, filters: SearchFilters) => void
  tutorials: Tutorial[]
}

export interface SearchFilters {
  category?: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'all'
  subcategory?: string
}

export function SearchBar({ onSearch, tutorials }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({
    difficulty: 'all',
  })
  const [showResults, setShowResults] = useState(false)
  const [searchResults, setSearchResults] = useState<Tutorial[]>([])
  const searchRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Perform search
  useEffect(() => {
    if (query.trim().length > 0) {
      const lowerQuery = query.toLowerCase()
      const results = tutorials.filter((tutorial) => {
        // Text match
        const matchesQuery =
          tutorial.title.toLowerCase().includes(lowerQuery) ||
          tutorial.description.toLowerCase().includes(lowerQuery) ||
          tutorial.steps.some(
            (step) =>
              step.title.toLowerCase().includes(lowerQuery) ||
              step.description.toLowerCase().includes(lowerQuery)
          )

        // Filter match
        const matchesCategory = filters.category
          ? tutorial.category === filters.category
          : true
        const matchesDifficulty =
          filters.difficulty && filters.difficulty !== 'all'
            ? tutorial.difficulty === filters.difficulty
            : true
        const matchesSubcategory = filters.subcategory
          ? tutorial.subcategory === filters.subcategory
          : true

        return matchesQuery && matchesCategory && matchesDifficulty && matchesSubcategory
      })

      setSearchResults(results)
      setShowResults(true)
    } else {
      setSearchResults([])
      setShowResults(false)
    }
  }, [query, filters, tutorials])

  const handleSearch = () => {
    onSearch(query, filters)
    setShowResults(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const clearSearch = () => {
    setQuery('')
    setSearchResults([])
    setShowResults(false)
    onSearch('', filters)
  }

  const updateFilter = (key: keyof SearchFilters, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onSearch(query, newFilters)
  }

  const clearFilters = () => {
    const newFilters: SearchFilters = { difficulty: 'all' }
    setFilters(newFilters)
    onSearch(query, newFilters)
  }

  const hasActiveFilters =
    filters.category || filters.subcategory || (filters.difficulty && filters.difficulty !== 'all')

  return (
    <div ref={searchRef} className="relative w-full">
      {/* Search Input */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search tutorials... (e.g., 'create product', 'sales report')"
            className="w-full pl-10 pr-10 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <X className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-3 rounded-lg border transition-colors flex items-center space-x-2 ${
            hasActiveFilters
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Filter className="w-5 h-5" />
          <span className="hidden sm:inline">Filters</span>
          {hasActiveFilters && (
            <span className="bg-white text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
              {[
                filters.category,
                filters.subcategory,
                filters.difficulty !== 'all' && filters.difficulty,
              ].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Filter Tutorials</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category
              </label>
              <select
                value={filters.category || ''}
                onChange={(e) => updateFilter('category', e.target.value || undefined)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
              >
                <option value="">All Categories</option>
                {TUTORIAL_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Difficulty
              </label>
              <select
                value={filters.difficulty || 'all'}
                onChange={(e) =>
                  updateFilter('difficulty', e.target.value as SearchFilters['difficulty'])
                }
                className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
              >
                <option value="all">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            {/* Subcategory Filter (if category selected) */}
            {filters.category && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subcategory
                </label>
                <select
                  value={filters.subcategory || ''}
                  onChange={(e) => updateFilter('subcategory', e.target.value || undefined)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
                >
                  <option value="">All Subcategories</option>
                  {TUTORIAL_CATEGORIES.find((cat) => cat.id === filters.category)?.subcategories?.map(
                    (subcat) => (
                      <option key={subcat.id} value={subcat.id}>
                        {subcat.name}
                      </option>
                    )
                  )}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Results Dropdown */}
      {showResults && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-96 overflow-y-auto z-20">
          <div className="p-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-2">
              {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} found
            </div>
            {searchResults.slice(0, 10).map((tutorial) => (
              <button
                key={tutorial.id}
                onClick={() => {
                  onSearch(tutorial.id, filters)
                  setShowResults(false)
                }}
                className="w-full text-left px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">
                      {tutorial.title}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {tutorial.description}
                    </p>
                    <div className="flex items-center space-x-3 mt-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {TUTORIAL_CATEGORIES.find((cat) => cat.id === tutorial.category)?.name}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {tutorial.difficulty}
                      </span>
                      {tutorial.estimatedTime && (
                        <>
                          <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {tutorial.estimatedTime}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {searchResults.length > 10 && (
              <div className="text-center py-2 text-sm text-gray-500 dark:text-gray-400">
                + {searchResults.length - 10} more results
              </div>
            )}
          </div>
        </div>
      )}

      {/* No Results */}
      {showResults && query && searchResults.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-6 text-center z-20">
          <p className="text-gray-600 dark:text-gray-400">
            No tutorials found for &quot;{query}&quot;
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Try different keywords or adjust your filters
          </p>
        </div>
      )}
    </div>
  )
}
