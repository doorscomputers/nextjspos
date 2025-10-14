'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface BotInfo {
  id: number
  name: string
  username: string
}

interface TestResult {
  success?: boolean
  error?: string
  message?: string
  botInfo?: BotInfo
  configured?: boolean
}

interface ConfigStatus {
  configured: boolean
  botInfo?: BotInfo
  error?: string
  message?: string
}

export default function TestTelegramPage() {
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null)
  const [result, setResult] = useState<TestResult | null>(null)

  // Check configuration status on mount
  useEffect(() => {
    checkConfiguration()
  }, [])

  const checkConfiguration = async () => {
    setChecking(true)
    try {
      const response = await fetch('/api/telegram/test')
      const data = await response.json()
      setConfigStatus(data)
    } catch (error) {
      setConfigStatus({
        configured: false,
        message: 'Failed to check configuration',
      })
    } finally {
      setChecking(false)
    }
  }

  const sendTestMessage = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      setResult(data)

      // Refresh configuration status
      if (data.success) {
        await checkConfiguration()
      }
    } catch (error) {
      setResult({
        error: 'Failed to send test message',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>📱 Test Telegram Configuration</CardTitle>
          <CardDescription>
            Send a test message to verify your Telegram bot is working correctly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration Status */}
          {checking ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <span className="ml-3 text-gray-600">Checking configuration...</span>
            </div>
          ) : (
            <>
              {configStatus && (
                <Alert className={configStatus.configured ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}>
                  <AlertDescription>
                    {configStatus.configured ? (
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <span className="text-green-600 font-semibold">✓ Telegram Bot Configured</span>
                        </div>
                        {configStatus.botInfo && (
                          <div className="mt-2 text-sm text-gray-700">
                            <p><strong>Bot Name:</strong> {configStatus.botInfo.name}</p>
                            <p><strong>Bot Username:</strong> @{configStatus.botInfo.username}</p>
                            <p><strong>Bot ID:</strong> {configStatus.botInfo.id}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="text-yellow-800 font-semibold">⚠️ Telegram Not Configured</p>
                        <p className="text-sm text-yellow-700 mt-1">
                          Please configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_IDS in your .env file
                        </p>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Test Button */}
              <Button
                onClick={sendTestMessage}
                disabled={loading || !configStatus?.configured}
                className="w-full"
                size="lg"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Sending Test Message...
                  </>
                ) : (
                  '📤 Send Test Message to Telegram'
                )}
              </Button>

              {/* Test Result */}
              {result && (
                <div
                  className={`p-4 rounded-lg border ${
                    result.success
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <h3
                    className={`font-semibold mb-2 ${
                      result.success ? 'text-green-800' : 'text-red-800'
                    }`}
                  >
                    {result.success ? '✅ Success!' : '❌ Error'}
                  </h3>
                  <p
                    className={`text-sm ${
                      result.success ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {result.message || result.error}
                  </p>

                  {result.success && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm text-blue-800">
                        <strong>Next Steps:</strong>
                        <br />
                        1. Open your Telegram app
                        <br />
                        2. Check for a message from your bot
                        <br />
                        3. If you received the message, your configuration is working! 🎉
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Setup Instructions */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-sm mb-3 text-gray-900">📋 Setup Instructions:</h4>
            <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
              <li>
                <strong>Create a bot:</strong> Open Telegram and search for <code className="bg-gray-200 px-1 py-0.5 rounded">@BotFather</code>
              </li>
              <li>
                <strong>Get bot token:</strong> Send <code className="bg-gray-200 px-1 py-0.5 rounded">/newbot</code> and follow the instructions
              </li>
              <li>
                <strong>Start your bot:</strong> Click the link from BotFather and send <code className="bg-gray-200 px-1 py-0.5 rounded">/start</code>
              </li>
              <li>
                <strong>Get Chat ID:</strong> Visit:
                <br />
                <code className="bg-gray-200 px-2 py-1 rounded text-xs block mt-1 overflow-x-auto">
                  https://api.telegram.org/bot&lt;YOUR_BOT_TOKEN&gt;/getUpdates
                </code>
              </li>
              <li>
                <strong>Copy Chat ID:</strong> Look for the <code className="bg-gray-200 px-1 py-0.5 rounded">"id"</code> field in the JSON response
              </li>
              <li>
                <strong>Update .env:</strong> Add your bot token and chat ID to the .env file
              </li>
              <li>
                <strong>Restart server:</strong> Restart your development server to load new environment variables
              </li>
            </ol>
          </div>

          {/* Environment Variables Reference */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-sm text-blue-800 mb-2">
              🔧 Environment Variables (.env):
            </h4>
            <div className="text-xs font-mono bg-white p-3 rounded border border-blue-300 overflow-x-auto">
              <pre className="text-gray-800">
{`TELEGRAM_NOTIFICATIONS_ENABLED="true"
TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
TELEGRAM_CHAT_IDS="123456789,987654321"

# Alert Thresholds
TELEGRAM_ALERT_DISCOUNT_THRESHOLD="1000"
TELEGRAM_ALERT_VOID_ENABLED="true"
TELEGRAM_ALERT_REFUND_ENABLED="true"
TELEGRAM_ALERT_CREDIT_ENABLED="true"
TELEGRAM_ALERT_CASH_OUT_THRESHOLD="5000"
TELEGRAM_ALERT_LOW_STOCK_ENABLED="true"`}
              </pre>
            </div>
          </div>

          {/* Troubleshooting */}
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-semibold text-sm text-yellow-800 mb-2">
              ⚠️ Troubleshooting Tips:
            </h4>
            <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
              <li>Make sure you sent /start to your bot before testing</li>
              <li>Check that TELEGRAM_NOTIFICATIONS_ENABLED is set to "true"</li>
              <li>Verify bot token is correct (no extra spaces)</li>
              <li>Confirm chat ID is from the correct user</li>
              <li>For multiple admins, separate chat IDs with commas (no spaces)</li>
              <li>Restart the development server after updating .env</li>
              <li>Check server logs in terminal for error details</li>
            </ul>
          </div>

          {/* Benefits */}
          <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
            <h4 className="font-semibold text-sm text-purple-800 mb-2">
              🎉 Benefits of Telegram Notifications:
            </h4>
            <ul className="text-sm text-purple-700 space-y-1 list-disc list-inside">
              <li><strong>100% FREE</strong> - No per-message costs, unlimited notifications</li>
              <li><strong>Instant delivery</strong> - Receive alerts in real-time</li>
              <li><strong>Mobile & Desktop</strong> - Works on all devices</li>
              <li><strong>Rich formatting</strong> - Emojis, bold, italic text</li>
              <li><strong>Multiple admins</strong> - Send to multiple recipients</li>
              <li><strong>No phone number needed</strong> - Uses Telegram user ID</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
