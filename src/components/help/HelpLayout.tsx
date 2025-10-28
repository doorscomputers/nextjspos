'use client'

import { useState } from 'react'
import {
  TUTORIAL_CATEGORIES,
  Tutorial,
  getTutorialsByCategory,
} from '@/lib/help-content'
import {
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Home,
  BookOpen,
  Award,
  Clock,
} from 'lucide-react'

interface HelpLayoutProps {
  children: React.ReactNode
  currentTutorialId?: string
  onTutorialSelect?: (tutorialId: string) => void
  allTutorials: Tutorial[]
}

export function HelpLayout({
  children,
  currentTutorialId,
  onTutorialSelect,
  allTutorials,
}: HelpLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [expandedCategories, setExpandedCategories] = useState<string[]>([
    TUTORIAL_CATEGORIES[0]?.id || '',
  ])

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) =>
      prev.includes(categoryId)
        ? prev.filter((id) => id !== categoryId)
        : [...prev, categoryId]
    )
  }

  const getCategoryIcon = (iconName: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      rocket: '🚀',
      box: '📦',
      warehouse: '🏭',
      'shopping-cart': '🛒',
      'shopping-bag': '🛍️',
      'chart-bar': '📊',
      users: '👥',
      settings: '⚙️',
      star: '⭐',
      'help-circle': '❓',
    }
    return iconMap[iconName] || '📄'
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'text-green-600 dark:text-green-400'
      case 'intermediate':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'advanced':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-80' : 'w-0'
        } transition-all duration-300 overflow-hidden bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="font-bold text-lg text-gray-900 dark:text-gray-100">
              Help Center
            </h2>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded lg:hidden"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {/* Home / Overview */}
          <button
            onClick={() => onTutorialSelect?.('overview')}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
              currentTutorialId === 'overview'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Home className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">Overview</span>
          </button>

          {/* Categories */}
          {TUTORIAL_CATEGORIES.map((category) => {
            const isExpanded = expandedCategories.includes(category.id)
            const categoryTutorials = getTutorialsByCategory(category.id)
            const hasTutorials = categoryTutorials.length > 0

            return (
              <div key={category.id} className="space-y-1">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <span className="text-xl flex-shrink-0">
                      {getCategoryIcon(category.icon)}
                    </span>
                    <div className="text-left flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                        {category.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                        {category.description}
                      </div>
                    </div>
                  </div>
                  {hasTutorials && (
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">
                        {categoryTutorials.length}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      )}
                    </div>
                  )}
                </button>

                {/* Tutorials under category */}
                {isExpanded && hasTutorials && (
                  <div className="ml-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700 space-y-1">
                    {categoryTutorials.map((tutorial) => (
                      <button
                        key={tutorial.id}
                        onClick={() => onTutorialSelect?.(tutorial.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                          currentTutorialId === tutorial.id
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-l-2 border-blue-600 dark:border-blue-400'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                        }`}
                      >
                        <div className="text-sm font-medium mb-1">{tutorial.title}</div>
                        <div className="flex items-center space-x-2 text-xs">
                          <span className={getDifficultyColor(tutorial.difficulty)}>
                            <Award className="w-3 h-3 inline mr-1" />
                            {tutorial.difficulty}
                          </span>
                          {tutorial.estimatedTime && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="text-gray-500 dark:text-gray-500">
                                <Clock className="w-3 h-3 inline mr-1" />
                                {tutorial.estimatedTime}
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>Total Tutorials:</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {allTutorials.length}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Categories:</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {TUTORIAL_CATEGORIES.length}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>

          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Need more help?{' '}
              <a
                href="#"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                Contact Support
              </a>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto p-6">{children}</div>
        </div>
      </div>
    </div>
  )
}
