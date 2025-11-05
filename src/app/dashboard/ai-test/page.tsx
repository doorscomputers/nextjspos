"use client"

import { useChat } from '@ai-sdk/react'

export default function AITestPage() {
  console.log('🧪 Testing useChat hook...')

  const result = useChat({
    api: '/api/chat',
  })

  console.log('🧪 useChat returned:', result)
  console.log('🧪 handleSubmit exists:', !!result.handleSubmit)
  console.log('🧪 handleSubmit type:', typeof result.handleSubmit)

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">AI Chat Test</h1>

      <div className="bg-gray-100 p-4 rounded-lg space-y-2">
        <p><strong>handleSubmit exists:</strong> {result.handleSubmit ? 'YES ✅' : 'NO ❌'}</p>
        <p><strong>input exists:</strong> {result.input !== undefined ? 'YES ✅' : 'NO ❌'}</p>
        <p><strong>messages count:</strong> {result.messages.length}</p>
        <p><strong>isLoading:</strong> {result.isLoading ? 'true' : 'false'}</p>
      </div>

      <div className="mt-4">
        <p className="text-sm text-gray-600">Check the browser console for detailed logs</p>
      </div>

      {result.handleSubmit && (
        <form onSubmit={result.handleSubmit} className="mt-4">
          <input
            value={result.input}
            onChange={result.handleInputChange}
            className="border p-2 rounded"
            placeholder="Type a message..."
          />
          <button type="submit" className="ml-2 bg-blue-500 text-white px-4 py-2 rounded">
            Send
          </button>
        </form>
      )}
    </div>
  )
}
