'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { KeyIcon, UserIcon, PencilIcon } from '@heroicons/react/24/outline'

export default function ProfilePage() {
  const { data: session, update } = useSession()
  const [loading, setLoading] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)

  // Profile form
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [surname, setSurname] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')

  // Password change form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (session?.user) {
      setFirstName(session.user.firstName || '')
      setLastName(session.user.lastName || '')
      setSurname(session.user.surname || '')
      setUsername(session.user.username || '')
      setEmail(session.user.email || '')
    }
  }, [session])

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!firstName || !surname || !username) {
      toast.error('First Name, Surname, and Username are required')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/user/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          surname,
          username,
          email,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Profile updated successfully')
        setEditingProfile(false)
        // Update session with new data
        await update()
      } else {
        toast.error(data.error || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast.success('Password changed successfully')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        console.error('Password change failed:', data)
        toast.error(data.error || 'Failed to change password')
      }
    } catch (error) {
      console.error('Error changing password:', error)
      toast.error('Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  if (!session?.user) {
    return (
      <div className="p-8">
        <p className="text-gray-900 dark:text-gray-100">Loading user information...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Profile</h1>
        <p className="text-base text-gray-700 dark:text-gray-300 mt-2">
          Manage your account settings and change your password
        </p>
      </div>

      {/* User Information */}
      <Card className="border-gray-200 dark:border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              <CardTitle className="text-gray-900 dark:text-white">Account Information</CardTitle>
            </div>
            {!editingProfile && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingProfile(true)}
                className="text-blue-600 dark:text-blue-400 border-gray-300 dark:border-gray-600"
              >
                <PencilIcon className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            {editingProfile ? 'Update your account details' : 'Your basic account details'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {editingProfile ? (
            <form onSubmit={handleProfileUpdate} className="space-y-4" autoComplete="off">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="text-gray-900 dark:text-gray-200 font-medium">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    name="profile-first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoComplete="off"
                    className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    placeholder="Enter your first name"
                  />
                </div>

                <div>
                  <Label htmlFor="surname" className="text-gray-900 dark:text-gray-200 font-medium">
                    Surname <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="surname"
                    name="profile-surname"
                    type="text"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                    required
                    autoComplete="off"
                    className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    placeholder="Enter your surname"
                  />
                </div>

                <div>
                  <Label htmlFor="lastName" className="text-gray-900 dark:text-gray-200 font-medium">
                    Middle Name / Last Name
                  </Label>
                  <Input
                    id="lastName"
                    name="profile-last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    autoComplete="off"
                    className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    placeholder="Enter your middle/last name (optional)"
                  />
                </div>

                <div>
                  <Label htmlFor="username" className="text-gray-900 dark:text-gray-200 font-medium">
                    Username <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="username"
                    name="profile-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="off"
                    className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    placeholder="Enter your username"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="email" className="text-gray-900 dark:text-gray-200 font-medium">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    name="profile-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="off"
                    className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                    placeholder="Enter your email address (optional)"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingProfile(false)
                    // Reset to original values
                    if (session?.user) {
                      setFirstName(session.user.firstName || '')
                      setLastName(session.user.lastName || '')
                      setSurname(session.user.surname || '')
                      setUsername(session.user.username || '')
                      setEmail(session.user.email || '')
                    }
                  }}
                  className="text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  First Name
                </Label>
                <p className="mt-1 text-base font-medium text-gray-900 dark:text-white">
                  {session.user.firstName || 'N/A'}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Surname
                </Label>
                <p className="mt-1 text-base font-medium text-gray-900 dark:text-white">
                  {session.user.surname || 'N/A'}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Middle/Last Name
                </Label>
                <p className="mt-1 text-base font-medium text-gray-900 dark:text-white">
                  {session.user.lastName || 'N/A'}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Username
                </Label>
                <p className="mt-1 text-base font-medium text-gray-900 dark:text-white">
                  {session.user.username}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Email
                </Label>
                <p className="mt-1 text-base font-medium text-gray-900 dark:text-white">
                  {session.user.email || 'Not set'}
                </p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Role
                </Label>
                <p className="mt-1 text-base font-medium text-gray-900 dark:text-white">
                  {session.user.roles?.join(', ') || 'N/A'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password Change */}
      <Card className="border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
            <KeyIcon className="w-5 h-5" />
            Change Password
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400 text-base">
            Update your password to keep your account secure. Make sure to use a strong password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4" autoComplete="off">
            <div>
              <Label htmlFor="currentPassword" className="text-gray-900 dark:text-gray-200 font-medium">
                Current Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="currentPassword"
                name="current-password-field"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-base"
                placeholder="Enter your current password"
              />
            </div>

            <div>
              <Label htmlFor="newPassword" className="text-gray-900 dark:text-gray-200 font-medium">
                New Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="newPassword"
                name="new-password-field"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-base"
                placeholder="Enter your new password (min 6 characters)"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-gray-900 dark:text-gray-200 font-medium">
                Confirm New Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="confirmPassword"
                name="confirm-password-field"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-base"
                placeholder="Re-enter your new password"
              />
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {loading ? 'Changing Password...' : 'Change Password'}
              </Button>
              {(currentPassword || newPassword || confirmPassword) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCurrentPassword('')
                    setNewPassword('')
                    setConfirmPassword('')
                  }}
                  className="text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Security Notice */}
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-blue-600 dark:text-blue-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200">
                Security Best Practices
              </h4>
              <ul className="mt-2 text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <li>• Use a unique password that you don't use anywhere else</li>
                <li>• Make your password at least 8 characters long</li>
                <li>• Include a mix of uppercase, lowercase, numbers, and symbols</li>
                <li>• Change your password regularly for better security</li>
                <li>• Never share your password with anyone</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
