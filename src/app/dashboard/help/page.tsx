'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { HelpLayout } from '@/components/help/HelpLayout'
import { SearchBar, SearchFilters } from '@/components/help/SearchBar'
import { TutorialSection } from '@/components/help/TutorialSection'
import {
  TUTORIALS,
  TUTORIAL_CATEGORIES,
  getTutorialsForRole,
  getTutorialsByCategory,
  searchTutorials,
  Tutorial,
} from '@/lib/help-content'
import {
  BookOpen,
  Award,
  Clock,
  TrendingUp,
  Star,
  HelpCircle,
  ChevronRight,
  Sparkles,
} from 'lucide-react'

export default function HelpPage() {
  const { data: session } = useSession()
  const [currentView, setCurrentView] = useState<'overview' | 'tutorial'>('overview')
  const [currentTutorial, setCurrentTutorial] = useState<Tutorial | null>(null)
  const [filteredTutorials, setFilteredTutorials] = useState<Tutorial[]>([])
  const [completedSteps, setCompletedSteps] = useState<Record<string, number[]>>({})

  // Filter tutorials based on user role and permissions
  useEffect(() => {
    if (session?.user) {
      const userRoles = session.user.roles || []
      const userPermissions = session.user.permissions || []
      const accessibleTutorials = getTutorialsForRole(userRoles, userPermissions)
      setFilteredTutorials(accessibleTutorials)
    } else {
      setFilteredTutorials(TUTORIALS)
    }
  }, [session])

  const handleTutorialSelect = (tutorialId: string) => {
    if (tutorialId === 'overview') {
      setCurrentView('overview')
      setCurrentTutorial(null)
    } else {
      const tutorial = TUTORIALS.find((t) => t.id === tutorialId)
      if (tutorial) {
        setCurrentTutorial(tutorial)
        setCurrentView('tutorial')
      }
    }
  }

  const handleSearch = (query: string, filters: SearchFilters) => {
    let results: Tutorial[] = []

    if (query.trim()) {
      // Direct tutorial ID search (from dropdown selection)
      const directMatch = TUTORIALS.find((t) => t.id === query)
      if (directMatch) {
        handleTutorialSelect(query)
        return
      }

      // Text search
      results = searchTutorials(query)
    } else {
      results = filteredTutorials
    }

    // Apply filters
    if (filters.category) {
      results = results.filter((t) => t.category === filters.category)
    }
    if (filters.difficulty && filters.difficulty !== 'all') {
      results = results.filter((t) => t.difficulty === filters.difficulty)
    }
    if (filters.subcategory) {
      results = results.filter((t) => t.subcategory === filters.subcategory)
    }

    setFilteredTutorials(results)
  }

  const handleStepComplete = (tutorialId: string, stepNumber: number) => {
    setCompletedSteps((prev) => {
      const tutorialSteps = prev[tutorialId] || []
      if (!tutorialSteps.includes(stepNumber)) {
        return {
          ...prev,
          [tutorialId]: [...tutorialSteps, stepNumber].sort((a, b) => a - b),
        }
      }
      return prev
    })
  }

  const handleFeedback = (tutorialId: string, helpful: boolean) => {
    // In a real implementation, this would send feedback to the server
    console.log(`Tutorial ${tutorialId} marked as ${helpful ? 'helpful' : 'not helpful'}`)
    // Could store in localStorage or send to API
  }

  // Calculate progress stats
  const totalTutorials = filteredTutorials.length
  const completedTutorials = Object.keys(completedSteps).filter(
    (tutorialId) => {
      const tutorial = TUTORIALS.find((t) => t.id === tutorialId)
      return (
        tutorial && completedSteps[tutorialId].length === tutorial.steps.length
      )
    }
  ).length

  const beginnerTutorials = filteredTutorials.filter((t) => t.difficulty === 'beginner').length
  const intermediateTutorials = filteredTutorials.filter(
    (t) => t.difficulty === 'intermediate'
  ).length
  const advancedTutorials = filteredTutorials.filter((t) => t.difficulty === 'advanced').length

  // Get popular/recommended tutorials
  const recommendedTutorials = filteredTutorials.slice(0, 6)

  return (
    <HelpLayout
      currentTutorialId={currentTutorial?.id || (currentView === 'overview' ? 'overview' : undefined)}
      onTutorialSelect={handleTutorialSelect}
      allTutorials={filteredTutorials}
    >
      {currentView === 'overview' ? (
        <div className="space-y-8">
          {/* Welcome Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white rounded-lg p-8">
            <div className="flex items-center space-x-3 mb-4">
              <Sparkles className="w-8 h-8" />
              <h1 className="text-3xl font-bold">Welcome to the Help Center</h1>
            </div>
            <p className="text-blue-100 dark:text-blue-200 text-lg mb-6">
              Your comprehensive guide to mastering the Igoro Tech(IT) Inventory Management System.
              Learn everything from basic operations to advanced features.
            </p>
            {session?.user && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <p className="text-sm text-blue-100">
                  Welcome, <span className="font-semibold">{session.user.username}</span>! Tutorials
                  are customized based on your role:{' '}
                  <span className="font-semibold">{session.user.roles?.join(', ')}</span>
                </p>
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Search Tutorials
            </h2>
            <SearchBar onSearch={handleSearch} tutorials={filteredTutorials} />
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Tutorials</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {totalTutorials}
                  </p>
                </div>
                <BookOpen className="w-12 h-12 text-blue-600 dark:text-blue-400 opacity-20" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                    {completedTutorials}
                  </p>
                </div>
                <TrendingUp className="w-12 h-12 text-green-600 dark:text-green-400 opacity-20" />
              </div>
              {totalTutorials > 0 && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-600 dark:bg-green-400 h-2 rounded-full transition-all"
                      style={{
                        width: `${(completedTutorials / totalTutorials) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {Math.round((completedTutorials / totalTutorials) * 100)}% complete
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Categories</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {TUTORIAL_CATEGORIES.length}
                  </p>
                </div>
                <Star className="w-12 h-12 text-yellow-600 dark:text-yellow-400 opacity-20" />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Difficulty Levels</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                      {beginnerTutorials}
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                      {intermediateTutorials}
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                      {advancedTutorials}
                    </span>
                  </div>
                </div>
                <Award className="w-12 h-12 text-purple-600 dark:text-purple-400 opacity-20" />
              </div>
            </div>
          </div>

          {/* Recommended/Popular Tutorials */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Star className="w-6 h-6 text-yellow-500" />
              <span>Recommended Tutorials</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recommendedTutorials.map((tutorial) => (
                <button
                  key={tutorial.id}
                  onClick={() => handleTutorialSelect(tutorial.id)}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all text-left group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-1">
                      {tutorial.title}
                    </h3>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-shrink-0" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {tutorial.description}
                  </p>
                  <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                    <span
                      className={`flex items-center space-x-1 ${
                        tutorial.difficulty === 'beginner'
                          ? 'text-green-600 dark:text-green-400'
                          : tutorial.difficulty === 'intermediate'
                          ? 'text-yellow-600 dark:text-yellow-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      <Award className="w-3 h-3" />
                      <span className="capitalize">{tutorial.difficulty}</span>
                    </span>
                    {tutorial.estimatedTime && (
                      <>
                        <span>•</span>
                        <span className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{tutorial.estimatedTime}</span>
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span>{tutorial.steps.length} steps</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Browse by Category */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span>Browse by Category</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TUTORIAL_CATEGORIES.map((category) => {
                const categoryTutorials = getTutorialsByCategory(category.id).filter((t) =>
                  filteredTutorials.includes(t)
                )
                if (categoryTutorials.length === 0) return null

                return (
                  <div
                    key={category.id}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="text-3xl flex-shrink-0">{category.icon === 'rocket' ? '🚀' : category.icon === 'box' ? '📦' : category.icon === 'warehouse' ? '🏭' : category.icon === 'shopping-cart' ? '🛒' : category.icon === 'shopping-bag' ? '🛍️' : category.icon === 'chart-bar' ? '📊' : category.icon === 'users' ? '👥' : category.icon === 'settings' ? '⚙️' : category.icon === 'star' ? '⭐' : '❓'}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                          {category.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {category.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {categoryTutorials.length}{' '}
                            {categoryTutorials.length === 1 ? 'tutorial' : 'tutorials'}
                          </span>
                          <button
                            onClick={() => {
                              const firstTutorial = categoryTutorials[0]
                              if (firstTutorial) {
                                handleTutorialSelect(firstTutorial.id)
                              }
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium flex items-center space-x-1"
                          >
                            <span>Explore</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Need Help? */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <div className="flex items-start space-x-4">
              <HelpCircle className="w-8 h-8 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Still Need Help?
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                  If you cannot find what you are looking for in these tutorials, our support team is
                  here to assist you.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium">
                    Contact Support
                  </button>
                  <button
                    onClick={() => handleTutorialSelect('ai-assistant-usage')}
                    className="px-4 py-2 bg-white dark:bg-gray-800 border border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    Try AI Assistant
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : currentTutorial ? (
        <TutorialSection
          tutorial={currentTutorial}
          completedSteps={completedSteps[currentTutorial.id] || []}
          onStepComplete={(stepNumber) => handleStepComplete(currentTutorial.id, stepNumber)}
          onFeedback={handleFeedback}
        />
      ) : null}
    </HelpLayout>
  )
}
