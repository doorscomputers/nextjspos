"use client"

import { useChat } from '@ai-sdk/react'
import { useSession } from 'next-auth/react'
import { PaperAirplaneIcon, SparklesIcon, BookmarkIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid'
import { useEffect, useRef, useState } from 'react'

interface SavedQuestion {
  id: number
  question: string
  category?: string
  usageCount: number
  lastUsedAt?: string
  createdAt: string
}

export default function AIAssistantPage() {
  const { data: session } = useSession()
  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Saved questions state
  const [savedQuestions, setSavedQuestions] = useState<SavedQuestion[]>([])
  const [showSavedQuestions, setShowSavedQuestions] = useState(false)
  const [isSavingQuestion, setIsSavingQuestion] = useState(false)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Fetch saved questions on mount
  useEffect(() => {
    fetchSavedQuestions()
  }, [])

  const fetchSavedQuestions = async () => {
    try {
      const response = await fetch('/api/saved-questions')
      if (response.ok) {
        const data = await response.json()
        setSavedQuestions(data.savedQuestions || [])
      }
    } catch (error) {
      console.error('Error fetching saved questions:', error)
    }
  }

  const saveCurrentQuestion = async () => {
    if (!input || !input.trim()) return

    setIsSavingQuestion(true)
    try {
      const response = await fetch('/api/saved-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input.trim() }),
      })

      if (response.ok) {
        await fetchSavedQuestions()
        alert('Question saved successfully!')
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to save question')
      }
    } catch (error) {
      console.error('Error saving question:', error)
      alert('Failed to save question')
    } finally {
      setIsSavingQuestion(false)
    }
  }

  const useSavedQuestion = async (question: SavedQuestion) => {
    setInput(question.question)
    setShowSavedQuestions(false)

    // Increment usage count
    try {
      await fetch(`/api/saved-questions/${question.id}`, {
        method: 'PATCH',
      })
      fetchSavedQuestions() // Refresh to update usage count
    } catch (error) {
      console.error('Error updating question usage:', error)
    }
  }

  const deleteSavedQuestion = async (id: number) => {
    if (!confirm('Are you sure you want to delete this question?')) return

    try {
      const response = await fetch(`/api/saved-questions/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchSavedQuestions()
      } else {
        alert('Failed to delete question')
      }
    } catch (error) {
      console.error('Error deleting question:', error)
      alert('Failed to delete question')
    }
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Saved Questions Sidebar */}
      {showSavedQuestions && (
        <div className="w-80 bg-white rounded-lg shadow-sm p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Saved Questions</h3>
            <button
              onClick={() => setShowSavedQuestions(false)}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {savedQuestions.length === 0 ? (
            <div className="text-center py-8">
              <BookmarkIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No saved questions yet</p>
              <p className="text-gray-400 text-xs mt-1">
                Click the bookmark icon to save questions
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {savedQuestions.map((q) => (
                <div
                  key={q.id}
                  className="group border border-gray-200 rounded-lg p-3 hover:border-indigo-300 hover:bg-indigo-50 transition-all cursor-pointer relative"
                >
                  <div
                    onClick={() => useSavedQuestion(q)}
                    className="pr-8"
                  >
                    <p className="text-sm text-gray-900 line-clamp-2">{q.question}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">
                        Used {q.usageCount} times
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSavedQuestion(q.id)
                    }}
                    className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 rounded transition-all"
                  >
                    <TrashIcon className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-lg mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <SparklesIcon className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-bold">AI Assistant</h1>
                <p className="text-indigo-100 text-sm">
                  Your intelligent POS companion powered by GPT-4
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSavedQuestions(!showSavedQuestions)}
              className="p-2 hover:bg-indigo-500 rounded-lg transition-colors relative"
            >
              <BookmarkIcon className="h-6 w-6" />
              {savedQuestions.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {savedQuestions.length}
                </span>
              )}
            </button>
          </div>
        </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto bg-white rounded-lg shadow-sm p-6 mb-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <SparklesIcon className="h-16 w-16 text-indigo-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Welcome to AI Assistant!
            </h3>
            <p className="text-gray-600 mb-6 max-w-md">
              Ask me anything about your POS system, sales analytics, inventory management, or business insights.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
              <button
                onClick={() => {
                  const event = new Event('submit', { bubbles: true, cancelable: true })
                  const form = document.querySelector('form')
                  if (form) {
                    ;(document.getElementById('chat-input') as HTMLInputElement).value = "Show me today's sales summary"
                    form.dispatchEvent(event)
                  }
                }}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
              >
                <p className="font-medium text-gray-900">📊 Sales Summary</p>
                <p className="text-sm text-gray-500">Show me today's sales</p>
              </button>
              <button
                onClick={() => {
                  const event = new Event('submit', { bubbles: true, cancelable: true })
                  const form = document.querySelector('form')
                  if (form) {
                    ;(document.getElementById('chat-input') as HTMLInputElement).value = "What are my top selling products?"
                    form.dispatchEvent(event)
                  }
                }}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
              >
                <p className="font-medium text-gray-900">🏆 Top Products</p>
                <p className="text-sm text-gray-500">Analyze best sellers</p>
              </button>
              <button
                onClick={() => {
                  const event = new Event('submit', { bubbles: true, cancelable: true })
                  const form = document.querySelector('form')
                  if (form) {
                    ;(document.getElementById('chat-input') as HTMLInputElement).value = "Help me understand inventory management"
                    form.dispatchEvent(event)
                  }
                }}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
              >
                <p className="font-medium text-gray-900">📦 Inventory Help</p>
                <p className="text-sm text-gray-500">Learn about stock</p>
              </button>
              <button
                onClick={() => {
                  const event = new Event('submit', { bubbles: true, cancelable: true })
                  const form = document.querySelector('form')
                  if (form) {
                    ;(document.getElementById('chat-input') as HTMLInputElement).value = "Give me business insights and recommendations"
                    form.dispatchEvent(event)
                  }
                }}
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
              >
                <p className="font-medium text-gray-900">💡 Insights</p>
                <p className="text-sm text-gray-500">Get recommendations</p>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center space-x-2 mb-2">
                      <SparklesIcon className="h-5 w-5 text-indigo-600" />
                      <span className="text-sm font-semibold text-indigo-600">AI Assistant</span>
                    </div>
                  )}
                  <div className="prose prose-sm max-w-none">
                    {message.content}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-gray-500">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex space-x-2">
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask me anything about your POS system..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={saveCurrentQuestion}
            disabled={!input.trim() || isSavingQuestion}
            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            title="Save this question"
          >
            <BookmarkIcon className="h-5 w-5" />
          </button>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center space-x-2"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Powered by GPT-4 • User: {session?.user?.name} • Role: {(session?.user as any)?.roles?.[0]}
        </p>
      </form>
      </div>
    </div>
  )
}
