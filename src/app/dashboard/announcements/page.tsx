"use client"

import { useState, useEffect } from "react"
import { usePermissions } from "@/hooks/usePermissions"
import { PERMISSIONS } from "@/lib/rbac"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  SpeakerWaveIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"

interface Announcement {
  id: number
  title: string
  message: string
  type: string
  priority: string
  startDate: string | null
  endDate: string | null
  targetRoles: string | null
  targetLocations: string | null
  isActive: boolean
  displayOrder: number
  icon: string | null
  createdAt: string
  createdBy: {
    username: string
    firstName: string
    surname: string
  }
}

export default function AnnouncementsPage() {
  const { can, user } = usePermissions()
  const router = useRouter()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    type: "system",
    priority: "info",
    startDate: "",
    endDate: "",
    targetRoles: [] as string[],
    targetLocations: [] as string[],
    isActive: true,
    displayOrder: 0,
    icon: "",
  })

  // Check permissions
  if (!can(PERMISSIONS.ANNOUNCEMENT_VIEW)) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">
          You don't have permission to view announcements.
        </p>
      </div>
    )
  }

  const canCreate = can(PERMISSIONS.ANNOUNCEMENT_CREATE)
  const canUpdate = can(PERMISSIONS.ANNOUNCEMENT_UPDATE)
  const canDelete = can(PERMISSIONS.ANNOUNCEMENT_DELETE)

  useEffect(() => {
    fetchAnnouncements()
  }, [])

  async function fetchAnnouncements() {
    try {
      setLoading(true)
      const response = await fetch('/api/announcements')
      if (response.ok) {
        const data = await response.json()
        setAnnouncements(data.announcements || [])
      } else {
        toast.error('Failed to fetch announcements')
      }
    } catch (error) {
      console.error('Error fetching announcements:', error)
      toast.error('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const url = editingId
        ? `/api/announcements/${editingId}`
        : '/api/announcements'

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(
          editingId ? 'Announcement updated!' : 'Announcement created!'
        )
        setShowForm(false)
        setEditingId(null)
        resetForm()
        fetchAnnouncements()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Operation failed')
      }
    } catch (error) {
      console.error('Error saving announcement:', error)
      toast.error('An error occurred')
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Are you sure you want to delete this announcement?')) return

    try {
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Announcement deleted!')
        fetchAnnouncements()
      } else {
        toast.error('Failed to delete announcement')
      }
    } catch (error) {
      console.error('Error deleting announcement:', error)
      toast.error('An error occurred')
    }
  }

  function handleEdit(announcement: Announcement) {
    setEditingId(announcement.id)
    setFormData({
      title: announcement.title,
      message: announcement.message,
      type: announcement.type,
      priority: announcement.priority,
      startDate: announcement.startDate
        ? new Date(announcement.startDate).toISOString().slice(0, 16)
        : "",
      endDate: announcement.endDate
        ? new Date(announcement.endDate).toISOString().slice(0, 16)
        : "",
      targetRoles: announcement.targetRoles
        ? announcement.targetRoles.split(",")
        : [],
      targetLocations: announcement.targetLocations
        ? announcement.targetLocations.split(",")
        : [],
      isActive: announcement.isActive,
      displayOrder: announcement.displayOrder,
      icon: announcement.icon || "",
    })
    setShowForm(true)
  }

  function resetForm() {
    setFormData({
      title: "",
      message: "",
      type: "system",
      priority: "info",
      startDate: "",
      endDate: "",
      targetRoles: [],
      targetLocations: [],
      isActive: true,
      displayOrder: 0,
      icon: "",
    })
  }

  function getPriorityBadge(priority: string) {
    const colors = {
      urgent: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
      warning: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
      success: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
      info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    }
    return colors[priority as keyof typeof colors] || colors.info
  }

  function getTypeBadge(type: string) {
    const colors = {
      system: 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300',
      business_reminder: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
      promotional: 'bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300',
      location_specific: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    }
    return colors[type as keyof typeof colors] || colors.system
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <SpeakerWaveIcon className="h-8 w-8 text-blue-600" />
            Announcements & Reminders
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage messages displayed in the header ticker
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => {
              resetForm()
              setEditingId(null)
              setShowForm(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Create Announcement
          </button>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingId ? 'Edit Announcement' : 'Create Announcement'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditingId(null)
                  resetForm()
                }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Short announcement title"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Message *
                </label>
                <textarea
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Full announcement message"
                />
              </div>

              {/* Type and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="system">System</option>
                    <option value="business_reminder">Business Reminder</option>
                    <option value="promotional">Promotional</option>
                    <option value="location_specific">Location Specific</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="info">Info (Blue)</option>
                    <option value="success">Success (Green)</option>
                    <option value="warning">Warning (Orange)</option>
                    <option value="urgent">Urgent (Red)</option>
                  </select>
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Start Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    End Date (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Icon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Icon (Emoji - Optional)
                </label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="📢 🎉 ⚠️ ℹ️"
                  maxLength={4}
                />
              </div>

              {/* Display Order & Active Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Lower numbers appear first
                  </p>
                </div>

                <div className="flex items-center pt-7">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Active (show in ticker)
                    </span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingId(null)
                    resetForm()
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Announcements List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Loading announcements...
          </div>
        ) : announcements.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No announcements yet. Create your first one!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Announcement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created By
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {announcements.map((announcement) => (
                  <tr key={announcement.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {announcement.isActive ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" title="Active" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-gray-400" title="Inactive" />
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2">
                        {announcement.icon && (
                          <span className="text-xl">{announcement.icon}</span>
                        )}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {announcement.title}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                            {announcement.message}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeBadge(announcement.type)}`}>
                        {announcement.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityBadge(announcement.priority)}`}>
                        {announcement.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {announcement.createdBy.surname} {announcement.createdBy.firstName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {canUpdate && (
                          <button
                            onClick={() => handleEdit(announcement)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Edit"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(announcement.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="Delete"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
