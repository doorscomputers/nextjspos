"use client"

import { useState, useEffect } from "react"
import { SpeakerWaveIcon, XMarkIcon } from "@heroicons/react/24/outline"

interface Announcement {
  id: number
  title: string
  message: string
  type: string
  priority: string
  icon: string | null
}

export default function AnnouncementTicker() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [isVisible, setIsVisible] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnnouncements()
    // Refresh announcements every 5 minutes
    const interval = setInterval(fetchAnnouncements, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  async function fetchAnnouncements() {
    try {
      const response = await fetch('/api/announcements?forTicker=true')
      if (response.ok) {
        const data = await response.json()
        setAnnouncements(data.announcements || [])
      }
    } catch (error) {
      console.error('Error fetching announcements:', error)
    } finally {
      setLoading(false)
    }
  }

  function getPriorityColors(priority: string) {
    switch (priority) {
      case 'urgent':
        return 'bg-red-600 dark:bg-red-700 text-white'
      case 'warning':
        return 'bg-orange-500 dark:bg-orange-600 text-white'
      case 'success':
        return 'bg-green-600 dark:bg-green-700 text-white'
      default: // info
        return 'bg-blue-600 dark:bg-blue-700 text-white'
    }
  }

  function getTypeIcon(type: string, icon: string | null) {
    if (icon) return icon

    switch (type) {
      case 'system':
        return '⚙️'
      case 'business_reminder':
        return '📋'
      case 'promotional':
        return '🎉'
      case 'location_specific':
        return '📍'
      default:
        return '📢'
    }
  }

  if (loading || !isVisible || announcements.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      {/* Speaker Icon */}
      <div className="flex-shrink-0">
        <SpeakerWaveIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
      </div>

      {/* Scrolling Ticker */}
      <div className="flex-1 overflow-hidden relative">
        <div className="ticker-wrapper">
          <div className="ticker-content">
            {announcements.map((announcement, index) => (
              <span
                key={`${announcement.id}-${index}`}
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mr-6 ${getPriorityColors(announcement.priority)}`}
              >
                <span className="mr-2">{getTypeIcon(announcement.type, announcement.icon)}</span>
                <span className="font-semibold">{announcement.title}:</span>
                <span className="ml-2">{announcement.message}</span>
              </span>
            ))}
            {/* Duplicate for seamless loop */}
            {announcements.map((announcement, index) => (
              <span
                key={`${announcement.id}-duplicate-${index}`}
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mr-6 ${getPriorityColors(announcement.priority)}`}
              >
                <span className="mr-2">{getTypeIcon(announcement.type, announcement.icon)}</span>
                <span className="font-semibold">{announcement.title}:</span>
                <span className="ml-2">{announcement.message}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Close Button */}
      <button
        onClick={() => setIsVisible(false)}
        className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        title="Hide announcements"
      >
        <XMarkIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
      </button>

      <style jsx>{`
        .ticker-wrapper {
          overflow: hidden;
          white-space: nowrap;
        }

        .ticker-content {
          display: inline-block;
          animation: scroll 30s linear infinite;
          will-change: transform;
        }

        .ticker-content:hover {
          animation-play-state: paused;
        }

        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  )
}
