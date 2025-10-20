'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function TestEmailPage() {
  const [email, setEmail] = useState('rr3800@gmail.com')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null)

  const sendTestEmail = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/email/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        error: 'Failed to send test email',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>📧 Test Email Configuration</CardTitle>
          <CardDescription>
            Send a test email to verify your SMTP settings are working correctly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Test Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-sm text-gray-500">
              A test email will be sent to this address
            </p>
          </div>

          <Button
            onClick={sendTestEmail}
            disabled={loading || !email}
            className="w-full"
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
                Sending Test Email...
              </>
            ) : (
              '📨 Send Test Email'
            )}
          </Button>

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
                    1. Check your inbox at <strong>{email}</strong>
                    <br />
                    2. If not in inbox, check your spam/junk folder
                    <br />
                    3. If you received the email, your configuration is working! 🎉
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-sm mb-2">📋 Current Configuration:</h4>
            <div className="space-y-1 text-sm text-gray-600">
              <p>
                <strong>SMTP Host:</strong> {process.env.NEXT_PUBLIC_APP_NAME === 'Igoro Tech(IT) Inventory Management System' ? 'Gmail (smtp.gmail.com)' : 'Not configured'}
              </p>
              <p>
                <strong>Sender Email:</strong> Igoro Tech(IT) &lt;rr3800@gmail.com&gt;
              </p>
              <p>
                <strong>Admin Recipients:</strong> rr3800@gmail.com, doors_computers@yahoo.com
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <h4 className="font-semibold text-sm text-yellow-800 mb-2">
              ⚠️ Troubleshooting Tips:
            </h4>
            <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
              <li>Make sure you used the 16-character app password (not your regular Gmail password)</li>
              <li>Check that the app password has no spaces</li>
              <li>Verify you restarted the server after updating .env</li>
              <li>Check server logs in terminal for error details</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
