import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'

interface UserLocation {
  locationId: number
  locationName: string
}

interface UseUserLocationsResult {
  hasLocations: boolean
  locations: UserLocation[]
  loading: boolean
  isLocationUser: boolean // Has at least one location assigned
  primaryLocationId: number | null
}

/**
 * Hook to check if user has assigned locations
 * Users without locations (Super Admin, Admin) should not create inventory transactions
 */
export function useUserLocations(): UseUserLocationsResult {
  const { data: session } = useSession()
  const [locations, setLocations] = useState<UserLocation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUserLocations() {
      if (!session?.user) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch('/api/user/locations')
        if (res.ok) {
          const data = await res.json()
          setLocations(data.locations || [])
        }
      } catch (error) {
        console.error('Failed to fetch user locations:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserLocations()
  }, [session])

  return {
    hasLocations: locations.length > 0,
    locations,
    loading,
    isLocationUser: locations.length > 0,
    primaryLocationId: locations.length > 0 ? locations[0].locationId : null,
  }
}
