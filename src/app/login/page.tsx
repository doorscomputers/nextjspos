"use client"

import { signIn } from "next-auth/react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, MapPin } from "lucide-react"
import AnimatedLogo from "@/components/AnimatedLogo"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [locationId, setLocationId] = useState("")
  const [locationName, setLocationName] = useState("")
  const [rfidCode, setRfidCode] = useState("")
  const [rfidCodeActual, setRfidCodeActual] = useState("") // Store actual code for verification
  const [rfidVerified, setRfidVerified] = useState(false)
  const [verifyingRfid, setVerifyingRfid] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  // Handle RFID card scan (triggered on Enter key)
  const handleRfidScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && rfidCode.trim()) {
      e.preventDefault()
      setVerifyingRfid(true)
      setError("")

      const scannedCode = rfidCode.trim()

      try {
        const response = await fetch(`/api/locations/verify-code?code=${scannedCode}`)
        const data = await response.json()

        if (data.valid) {
          setLocationId(data.locationId.toString())
          setLocationName(data.locationName)
          setRfidCodeActual(scannedCode) // Store actual code
          setRfidVerified(true)
          console.log(`[Login] ✓ RFID verified: ${data.locationName}`)
        } else {
          setError(data.error || "Invalid RFID code. Please scan the correct card for this location.")
          setRfidCode("")
          setRfidCodeActual("")
          setRfidVerified(false)
        }
      } catch (err: any) {
        setError("Failed to verify RFID code. Please try again.")
        setRfidCode("")
        setRfidCodeActual("")
        setRfidVerified(false)
      } finally {
        setVerifyingRfid(false)
      }
    }
  }

  const clearRfidScan = () => {
    setRfidCode("")
    setRfidCodeActual("")
    setLocationId("")
    setLocationName("")
    setRfidVerified(false)
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Location is now optional - auth.ts will enforce it only for non-admin roles
    // Admins can skip RFID scanning entirely

    setLoading(true)

    try {
      const result = await signIn("credentials", {
        username,
        password,
        locationId,  // Pass location ID to auth
        redirect: false,
      })

      console.log("Login result:", result) // Debug log

      if (result?.error) {
        setError(`Login failed: ${result.error}`)
      } else if (result?.ok) {
        // Success - redirect to dashboard
        window.location.href = "/dashboard"
      } else {
        setError("Login failed - please try again")
      }
    } catch (error) {
      console.error("Login error:", error)
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-400 via-orange-400 to-yellow-500 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Centered Login Card */}
      <div className="max-w-md w-full bg-black/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 relative z-10 border border-purple-500/20">
        {/* Animated Logo */}
        <AnimatedLogo className="mb-8" />

        {/* Login Header */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white">Login</h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Email/Username Field */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2 sr-only">
              User Name
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="appearance-none block w-full px-4 py-3 bg-transparent border-2 border-blue-500 rounded-lg placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
              placeholder="User Name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2 sr-only">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                className="appearance-none block w-full px-4 py-3 pr-12 bg-transparent border-2 border-blue-500 rounded-lg placeholder-gray-400 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* RFID Location Scanner */}
          <div>
            <label htmlFor="rfid" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Scan Location RFID Card (Cashiers/Managers only)
            </label>

            {!rfidVerified ? (
              <>
                <input
                  id="rfid"
                  name="rfid"
                  type="password"
                  className="appearance-none block w-full px-4 py-3 bg-black/50 border-2 border-blue-500 rounded-lg text-white font-mono text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all placeholder-gray-500"
                  placeholder="Scan RFID card here..."
                  value={rfidCode}
                  onChange={(e) => setRfidCode(e.target.value)}
                  onKeyDown={handleRfidScan}
                  disabled={verifyingRfid}
                  autoFocus
                />
                <p className="mt-1 text-xs text-gray-400">
                  📱 Scan the RFID card at your location, then press Enter
                </p>
                <p className="mt-1 text-xs text-yellow-400">
                  ⚠️ Admins can skip this field - location scan not required for admin roles
                </p>
              </>
            ) : (
              <div className="bg-green-900/30 border-2 border-green-500 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-green-500 rounded-full">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Verified Location:</p>
                      <p className="text-lg font-bold text-white">{locationName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={clearRfidScan}
                    className="px-3 py-1 bg-red-600/80 hover:bg-red-600 text-white text-sm rounded-md transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-gradient-to-r from-blue-600 via-blue-700 to-blue-600 hover:from-blue-700 hover:via-blue-800 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg uppercase tracking-wider"
          >
            {loading ? "Signing in..." : "LOGIN"}
          </button>
        </form>
      </div>
    </div>
  )
}
