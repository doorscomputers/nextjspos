"use client"

import { useChat } from '@ai-sdk/react'
import { useSession } from 'next-auth/react'
import { PaperAirplaneIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useEffect, useRef } from 'react'

export default function AIAssistantPage() {
  const { data: session } = useSession()
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6 rounded-lg mb-4">
        <div className="flex items-center space-x-3">
          <SparklesIcon className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">AI Assistant</h1>
            <p className="text-indigo-100 text-sm">
              Your intelligent POS companion powered by GPT-4
            </p>
          </div>
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
        <div className="flex space-x-4">
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
  )
}
