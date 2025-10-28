'use client'

import { useState } from 'react'
import { TutorialStep } from '@/lib/help-content'
import {
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  Code,
  AlertTriangle,
  Lightbulb,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface StepByStepProps {
  steps: TutorialStep[]
  onStepComplete?: (stepNumber: number) => void
  completedSteps?: number[]
}

export function StepByStep({ steps, onStepComplete, completedSteps = [] }: StepByStepProps) {
  const [expandedSteps, setExpandedSteps] = useState<number[]>([1]) // First step expanded by default

  const toggleStep = (stepNumber: number) => {
    setExpandedSteps((prev) =>
      prev.includes(stepNumber)
        ? prev.filter((s) => s !== stepNumber)
        : [...prev, stepNumber]
    )
  }

  const markComplete = (stepNumber: number) => {
    onStepComplete?.(stepNumber)
  }

  return (
    <div className="space-y-4">
      {steps.map((step) => {
        const isExpanded = expandedSteps.includes(step.stepNumber)
        const isCompleted = completedSteps.includes(step.stepNumber)

        return (
          <div
            key={step.stepNumber}
            className="border rounded-lg overflow-hidden transition-all duration-200 hover:shadow-md"
          >
            {/* Step Header */}
            <div
              className={`flex items-center justify-between p-4 cursor-pointer ${
                isCompleted
                  ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-l-green-500'
                  : 'bg-gray-50 dark:bg-gray-800/50 border-l-4 border-l-blue-500'
              }`}
              onClick={() => toggleStep(step.stepNumber)}
            >
              <div className="flex items-center space-x-3 flex-1">
                {/* Step Number / Status Icon */}
                {isCompleted ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {step.stepNumber}
                  </div>
                )}

                {/* Step Title */}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {step.title}
                  </h3>
                </div>
              </div>

              {/* Expand/Collapse Icon */}
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              )}
            </div>

            {/* Step Content */}
            {isExpanded && (
              <div className="p-6 bg-white dark:bg-gray-900 space-y-4">
                {/* Description */}
                <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {step.description}
                </div>

                {/* Image Placeholder */}
                {step.imagePlaceholder && (
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 bg-gray-50 dark:bg-gray-800/50 flex flex-col items-center justify-center space-y-2">
                    <ImageIcon className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Image: {step.imagePlaceholder}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Screenshot placeholder - actual image can be added here
                    </p>
                  </div>
                )}

                {/* Code Snippet */}
                {step.codeSnippet && (
                  <div className="bg-gray-900 dark:bg-black rounded-lg overflow-hidden">
                    <div className="flex items-center space-x-2 px-4 py-2 bg-gray-800 dark:bg-gray-900">
                      <Code className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-400">Code Example</span>
                    </div>
                    <pre className="p-4 overflow-x-auto">
                      <code className="text-sm text-green-400 font-mono">
                        {step.codeSnippet}
                      </code>
                    </pre>
                  </div>
                )}

                {/* Notes */}
                {step.notes && step.notes.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start space-x-2">
                      <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                          Important Notes:
                        </h4>
                        <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                          {step.notes.map((note, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                              <span className="flex-1">{note}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tips */}
                {step.tips && step.tips.length > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex items-start space-x-2">
                      <Lightbulb className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                          Pro Tips:
                        </h4>
                        <ul className="space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
                          {step.tips.map((tip, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className="text-yellow-600 dark:text-yellow-400 mt-1">💡</span>
                              <span className="flex-1">{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {step.warnings && step.warnings.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">
                          Warnings:
                        </h4>
                        <ul className="space-y-1 text-sm text-red-800 dark:text-red-200">
                          {step.warnings.map((warning, index) => (
                            <li key={index} className="flex items-start space-x-2">
                              <span className="text-red-600 dark:text-red-400 mt-1">⚠️</span>
                              <span className="flex-1">{warning}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Mark as Complete Button */}
                {!isCompleted && onStepComplete && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => markComplete(step.stepNumber)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Mark as Complete</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
