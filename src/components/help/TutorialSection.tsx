'use client'

import { useState } from 'react'
import { Tutorial } from '@/lib/help-content'
import { StepByStep } from './StepByStep'
import {
  Clock,
  BookOpen,
  Award,
  Video,
  Printer,
  Download,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  Star
} from 'lucide-react'

interface TutorialSectionProps {
  tutorial: Tutorial
  completedSteps?: number[]
  onStepComplete?: (stepNumber: number) => void
  onFeedback?: (tutorialId: string, helpful: boolean) => void
}

export function TutorialSection({
  tutorial,
  completedSteps = [],
  onStepComplete,
  onFeedback,
}: TutorialSectionProps) {
  const [feedbackGiven, setFeedbackGiven] = useState(false)

  const handleFeedback = (helpful: boolean) => {
    onFeedback?.(tutorial.id, helpful)
    setFeedbackGiven(true)
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'advanced':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden">
      {/* Tutorial Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-2">{tutorial.title}</h1>
            <p className="text-blue-100 dark:text-blue-200 mb-4">{tutorial.description}</p>

            {/* Meta Information */}
            <div className="flex flex-wrap gap-4">
              {tutorial.estimatedTime && (
                <div className="flex items-center space-x-2 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>{tutorial.estimatedTime}</span>
                </div>
              )}

              <div className="flex items-center space-x-2 text-sm">
                <BookOpen className="w-4 h-4" />
                <span>{tutorial.steps.length} Steps</span>
              </div>

              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(
                  tutorial.difficulty
                )}`}
              >
                <div className="flex items-center space-x-1">
                  <Award className="w-3 h-3" />
                  <span className="capitalize">{tutorial.difficulty}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={() => window.print()}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title="Print Tutorial"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              title="Export to PDF"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Video Tutorial (if available) */}
      {tutorial.videoUrl && (
        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2 mb-3">
            <Video className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Video Tutorial Available
            </h3>
          </div>
          <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
            <p className="text-gray-400">Video player would be embedded here</p>
            {/* In actual implementation, embed video player:
            <iframe src={tutorial.videoUrl} className="w-full h-full rounded-lg" /> */}
          </div>
        </div>
      )}

      {/* Tutorial Steps */}
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6 flex items-center space-x-2">
          <span>Step-by-Step Guide</span>
          {completedSteps.length > 0 && (
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
              ({completedSteps.length} of {tutorial.steps.length} completed)
            </span>
          )}
        </h2>

        <StepByStep
          steps={tutorial.steps}
          completedSteps={completedSteps}
          onStepComplete={onStepComplete}
        />
      </div>

      {/* Related Tutorials */}
      {tutorial.relatedTutorials && tutorial.relatedTutorials.length > 0 && (
        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
            <Star className="w-5 h-5 text-yellow-500" />
            <span>Related Tutorials</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {tutorial.relatedTutorials.map((relatedId) => (
              <button
                key={relatedId}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left group"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {relatedId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Section */}
      <div className="p-6 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <p className="text-gray-700 dark:text-gray-300 mb-4">Was this tutorial helpful?</p>
          {!feedbackGiven ? (
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={() => handleFeedback(true)}
                className="flex items-center space-x-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <ThumbsUp className="w-4 h-4" />
                <span>Yes, helpful</span>
              </button>
              <button
                onClick={() => handleFeedback(false)}
                className="flex items-center space-x-2 px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <ThumbsDown className="w-4 h-4" />
                <span>No, not helpful</span>
              </button>
            </div>
          ) : (
            <div className="text-green-600 dark:text-green-400 font-medium">
              Thank you for your feedback!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
