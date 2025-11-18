/**
 * ============================================================================
 * LOGIN PAGE (src/app/login/page.tsx)
 * ============================================================================
 *
 * PURPOSE: Entry point for user authentication into the application
 *
 * THIS IS WHERE THE USER JOURNEY BEGINS:
 * 1. User arrives at /login
 * 2. Enters username and password
 * 3. Scans RFID card (cashiers/managers only)
 * 4. Clicks "LOGIN" button
 * 5. NextAuth validates credentials via src/lib/auth.ts
 * 6. If successful, redirects to /dashboard
 *
 * KEY FEATURES:
 * - Username/password authentication
 * - RFID location scanning for non-admin users
 * - Real-time RFID verification via API
 * - Error handling and display
 * - Loading states
 * - Show/hide password toggle
 * - Animated background and logo
 *
 * SECURITY FEATURES:
 * - RFID card required for cashiers/managers (prevents remote login)
 * - Admin users exempt from RFID scanning
 * - Password field masked by default
 * - CSRF protection via NextAuth
 * - HTTP-only cookies for session storage
 *
 * FLOW AFTER LOGIN:
 * Login Success → middleware.ts checks JWT → redirects to /dashboard →
 * Dashboard layout loads → Sidebar renders with permissions → User sees home page
 *
 * RELATED FILES:
 * - src/lib/auth.ts - Authentication logic (STEP 1: validates credentials)
 * - middleware.ts - Route protection (STEP 2: checks if authenticated)
 * - src/app/dashboard/layout.tsx - Dashboard wrapper (STEP 3: loads UI)
 * - src/components/Sidebar.tsx - Navigation menu (STEP 4: shows menu based on permissions)
 */

// ============================================================================
// CLIENT COMPONENT DECLARATION
// ============================================================================
// This must be a Client Component (not Server Component) because it:
// 1. Uses React hooks (useState, useEffect)
// 2. Handles user interactions (form submission, button clicks)
// 3. Manages local state (username, password, RFID)
// 4. Calls NextAuth's signIn() function (client-side only)
"use client"

// ============================================================================
// IMPORTS
// ============================================================================
import { signIn } from "next-auth/react" // NextAuth client function for authentication
import { useState, useEffect } from "react" // React hooks for state management
import { useRouter } from "next/navigation" // Next.js router for navigation
import { Eye, EyeOff, MapPin } from "lucide-react" // Icon components
import AnimatedLogo from "@/components/AnimatedLogo" // Custom animated logo component

/**
 * ============================================================================
 * LOGIN PAGE COMPONENT
 * ============================================================================
 *
 * This is the main login form component that handles user authentication.
 */
export default function LoginPage() {
  // ===========================================================================
  // ROUTER - For navigation after login
  // ===========================================================================
  const router = useRouter()

  // ===========================================================================
  // STATE MANAGEMENT - All form fields and UI states
  // ===========================================================================

  // Authentication Credentials
  const [username, setUsername] = useState("") // Username input value
  const [password, setPassword] = useState("") // Password input value

  // RFID Location Scanning (for non-admin users)
  const [locationId, setLocationId] = useState("") // Selected location ID (sent to auth.ts)
  const [locationName, setLocationName] = useState("") // Human-readable location name for display
  const [rfidCode, setRfidCode] = useState("") // RFID card code being typed/scanned
  const [rfidCodeActual, setRfidCodeActual] = useState("") // Store actual verified code
  const [rfidVerified, setRfidVerified] = useState(false) // Has RFID been successfully scanned?
  const [verifyingRfid, setVerifyingRfid] = useState(false) // Is RFID verification in progress?

  // UI State
  const [error, setError] = useState("") // Error message to display (if login fails)
  const [loading, setLoading] = useState(false) // Is login request in progress?
  const [showPassword, setShowPassword] = useState(false) // Should password be visible?
  const [rememberMe, setRememberMe] = useState(false) // Remember me checkbox (currently not used)

  // ===========================================================================
  // RFID SCANNING HANDLER
  // ===========================================================================
  /**
   * Handles RFID card scanning and verification
   *
   * HOW IT WORKS:
   * 1. User focuses on RFID input field
   * 2. User scans RFID card with barcode scanner (or types manually)
   * 3. Scanner automatically presses Enter after reading code
   * 4. This function triggers on Enter key press
   * 5. Calls API to verify RFID code matches a location
   * 6. If valid, stores location ID and name
   * 7. Shows green checkmark with location name
   *
   * WHY THIS EXISTS:
   * - Security: Ensures user is physically at the location
   * - Prevents remote login by cashiers/managers
   * - Each location has unique RFID card
   * - Required for non-admin users only
   *
   * API ENDPOINT: GET /api/locations/verify-code?code={scannedCode}
   * RESPONSE: { valid: true, locationId: 1, locationName: "Main Store" }
   */
  const handleRfidScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Only proceed if Enter key pressed and code is not empty
    if (e.key === "Enter" && rfidCode.trim()) {
      e.preventDefault() // Prevent form submission
      setVerifyingRfid(true) // Show loading state
      setError("") // Clear any previous errors

      const scannedCode = rfidCode.trim() // Remove whitespace

      try {
        // Call API to verify RFID code
        const response = await fetch(`/api/locations/verify-code?code=${scannedCode}`)
        const data = await response.json()

        if (data.valid) {
          // ✅ RFID code is valid
          setLocationId(data.locationId.toString()) // Store location ID (will be sent to auth.ts)
          setLocationName(data.locationName) // Store location name for display
          setRfidCodeActual(scannedCode) // Store actual scanned code
          setRfidVerified(true) // Mark as verified (shows green checkmark)
          console.log(`[Login] ✓ RFID verified: ${data.locationName}`)
        } else {
          // ❌ RFID code is invalid
          setError(data.error || "Invalid RFID code. Please scan the correct card for this location.")
          setRfidCode("") // Clear input
          setRfidCodeActual("") // Clear stored code
          setRfidVerified(false) // Mark as not verified
        }
      } catch (err: any) {
        // ❌ Network error or API error
        setError("Failed to verify RFID code. Please try again.")
        setRfidCode("")
        setRfidCodeActual("")
        setRfidVerified(false)
      } finally {
        setVerifyingRfid(false) // Hide loading state
      }
    }
  }

  // ===========================================================================
  // CLEAR RFID SCAN
  // ===========================================================================
  /**
   * Resets RFID scanning state
   *
   * Called when user clicks "Clear" button in verified location display
   * Allows user to scan a different RFID card
   */
  const clearRfidScan = () => {
    setRfidCode("") // Clear input field
    setRfidCodeActual("") // Clear stored code
    setLocationId("") // Clear location ID
    setLocationName("") // Clear location name
    setRfidVerified(false) // Hide green checkmark
    setError("") // Clear any errors
  }

  // ===========================================================================
  // FORM SUBMISSION - Main Login Handler
  // ===========================================================================
  /**
   * Handles login form submission
   *
   * AUTHENTICATION FLOW:
   * 1. Form submitted → This function runs
   * 2. Calls NextAuth signIn("credentials") with username/password/locationId
   * 3. NextAuth calls authorize() function in src/lib/auth.ts
   * 4. auth.ts validates credentials and performs security checks:
   *    - Verifies username exists
   *    - Checks password with bcrypt
   *    - Validates RFID location (non-admins only)
   *    - Checks for shift conflicts
   *    - Verifies schedule-based login restrictions
   * 5. If valid, auth.ts returns user object
   * 6. NextAuth creates JWT token with user data
   * 7. JWT stored in HTTP-only cookie
   * 8. This function redirects to /dashboard
   * 9. middleware.ts checks JWT on /dashboard request
   * 10. If valid, dashboard loads with user session
   *
   * WHAT GETS SENT TO AUTH.TS:
   * - username: "john_doe"
   * - password: "securepassword123"
   * - locationId: "5" (from RFID scan, or empty for admins)
   *
   * WHAT HAPPENS ON SUCCESS:
   * - JWT token created and stored in cookie
   * - Redirect to /dashboard
   * - User session available via getServerSession()
   * - Sidebar menu renders with permissions
   *
   * WHAT HAPPENS ON FAILURE:
   * - Error message displayed (from auth.ts)
   * - User stays on login page
   * - Can try again
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault() // Prevent default form submission (page reload)
    setError("") // Clear any previous error messages

    // IMPORTANT NOTE:
    // Location is optional here because auth.ts will enforce it based on user role
    // - Admins: Can skip RFID scanning entirely
    // - Cashiers/Managers: MUST have locationId or login will be blocked

    setLoading(true) // Show loading state on button

    try {
      // =====================================================================
      // CALL NEXTAUTH SIGNIN
      // =====================================================================
      // This calls the authorize() function in src/lib/auth.ts
      // NextAuth handles the entire authentication flow
      const result = await signIn("credentials", {
        username, // Username from form input
        password, // Password from form input
        locationId, // Location ID from RFID scan (may be empty for admins)
        redirect: false, // Don't auto-redirect, we'll handle it manually
      })

      console.log("Login result:", result) // Debug log for development

      // =====================================================================
      // HANDLE AUTHENTICATION RESULT
      // =====================================================================
      if (result?.error) {
        // ❌ Authentication failed
        // Error could be:
        // - "Invalid credentials" (wrong username/password)
        // - "Location verification required" (RFID not scanned)
        // - "Location already has an active shift" (shift conflict)
        // - "Login denied: You are not scheduled to work today" (schedule restriction)
        setError(`Login failed: ${result.error}`)
      } else if (result?.ok) {
        // ✅ Authentication successful!
        // JWT token has been created and stored in cookie
        // Now redirect to dashboard
        // Using window.location.href instead of router.push to ensure:
        // 1. Full page reload (clears any client state)
        // 2. Middleware runs to validate JWT
        // 3. Server components can access session
        window.location.href = "/dashboard"
      } else {
        // ⚠️ Unexpected result (shouldn't happen)
        setError("Login failed - please try again")
      }
    } catch (error) {
      // ❌ Network error or unexpected error
      console.error("Login error:", error)
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false) // Hide loading state
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b1a3f] via-[#173a89] to-[#2a62d4] py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-52 -right-32 w-96 h-96 bg-[#1b48c4] rounded-full mix-blend-screen filter blur-3xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-48 -left-32 w-96 h-96 bg-[#06133a] rounded-full mix-blend-screen filter blur-3xl opacity-60 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] bg-[#2f6cff] rounded-full mix-blend-screen filter blur-[120px] opacity-40 animate-blob animation-delay-4000"></div>
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/10 via-white/0 to-transparent opacity-50"></div>
      </div>

      {/* Centered Login Card */}
      <div className="max-w-md w-full bg-gradient-to-br from-[#13244d]/95 via-[#0c1833]/95 to-[#1a2f63]/95 backdrop-blur-2xl rounded-3xl shadow-[0_25px_55px_rgba(6,16,45,0.65)] p-8 relative z-10 border border-white/15">
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
              className="appearance-none block w-full px-4 py-3 bg-white/5 border border-[#2d66ff]/60 rounded-lg placeholder-gray-300 text-white focus:outline-none focus:ring-2 focus:ring-[#5e8cff] focus:border-[#5e8cff] transition-all"
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
                className="appearance-none block w-full px-4 py-3 pr-12 bg-white/5 border border-[#2d66ff]/60 rounded-lg placeholder-gray-300 text-white focus:outline-none focus:ring-2 focus:ring-[#5e8cff] focus:border-[#5e8cff] transition-all"
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
                  className="appearance-none block w-full px-4 py-3 bg-white/5 border border-[#2d66ff]/60 rounded-lg text-white font-mono text-lg focus:outline-none focus:ring-2 focus:ring-[#5e8cff] focus:border-[#5e8cff] transition-all placeholder-gray-400"
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
              <div className="bg-green-900/30 border border-green-500/70 rounded-lg p-4">
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
            className="w-full flex justify-center py-3 px-4 border border-white/10 text-sm font-bold rounded-lg text-white bg-gradient-to-r from-[#2d66ff] via-[#4f7dff] to-[#2d66ff] hover:from-[#3e74ff] hover:via-[#6d8dff] hover:to-[#3e74ff] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5e8cff] focus:ring-offset-[#040b1e] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_15px_35px_rgba(15,35,85,0.6)] uppercase tracking-wider"
          >
            {loading ? "Signing in..." : "LOGIN"}
          </button>
        </form>
      </div>
    </div>
  )
}
