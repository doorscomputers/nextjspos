"use client"

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ReportFilterPanel from '@/components/reports/ReportFilterPanel'

interface Location {
  id: number
  name: string
}

export function FilterPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get initial values from URL or defaults
  const defaultStartDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30)
    return date.toISOString().split('T')[0]
  }, [])

  const defaultEndDate = useMemo(() => new Date().toISOString().split('T')[0], [])

  const [startDate, setStartDate] = useState(searchParams.get('startDate') || defaultStartDate)
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || defaultEndDate)
  const [locationId, setLocationId] = useState<string>(searchParams.get('locationId') || 'all')
  const [locations, setLocations] = useState<Location[]>([])
  const [showFilters, setShowFilters] = useState(true)
  const [loading, setLoading] = useState(false)

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch('/api/locations')
        if (res.ok) {
          const response = await res.json()
          const locData = Array.isArray(response?.data)
            ? response.data
            : Array.isArray(response?.locations)
            ? response.locations
            : Array.isArray(response)
            ? response
            : []

          // Filter out Main Warehouse
          const filteredLocations = locData.filter(
            (loc: Location) => loc.name?.toLowerCase() !== 'main warehouse'
          )
          setLocations(filteredLocations)
        } else {
          setLocations([])
        }
      } catch (error) {
        console.error('Error fetching locations:', error)
        setLocations([])
      }
    }
    fetchLocations()
  }, [])

  const handleResetFilters = () => {
    setStartDate(defaultStartDate)
    setEndDate(defaultEndDate)
    setLocationId('all')

    // Navigate to default filters
    const params = new URLSearchParams()
    params.set('startDate', defaultStartDate)
    params.set('endDate', defaultEndDate)
    router.push(`/dashboard/reports/profit-loss?${params.toString()}`)
  }

  const handleGenerateReport = () => {
    setLoading(true)

    // Build URL params
    const params = new URLSearchParams()
    params.set('startDate', startDate)
    params.set('endDate', endDate)
    if (locationId !== 'all') {
      params.set('locationId', locationId)
    }

    // Navigate to new URL with params
    router.push(`/dashboard/reports/profit-loss?${params.toString()}`)

    // Reset loading after a brief delay
    setTimeout(() => setLoading(false), 500)
  }

  const activeFilterCount = useMemo(() => {
    return [
      startDate !== defaultStartDate || endDate !== defaultEndDate,
      locationId !== 'all',
    ].filter(Boolean).length
  }, [startDate, endDate, defaultStartDate, defaultEndDate, locationId])

  return (
    <div className="print:hidden mb-6">
      <ReportFilterPanel
        isOpen={showFilters}
        onToggle={() => setShowFilters(!showFilters)}
        activeCount={activeFilterCount}
        onClearAll={handleResetFilters}
        clearLabel="Reset Filters"
        description="Select date range and location to filter profit/loss data."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="startDate" className="mb-2 block">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-gray-300 dark:border-gray-600"
            />
          </div>

          <div>
            <Label htmlFor="endDate" className="mb-2 block">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border-gray-300 dark:border-gray-600"
            />
          </div>

          <div>
            <Label htmlFor="location" className="mb-2 block">Location</Label>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger id="location">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id.toString()}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleGenerateReport}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md hover:shadow-lg transition-all"
            >
              {loading ? 'Loading...' : 'Generate Report'}
            </Button>
          </div>
        </div>
      </ReportFilterPanel>
    </div>
  )
}
