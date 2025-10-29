'use client'

import { useState } from 'react'

interface Location {
  id: number
  name: string
}

interface LocationSelectorProps {
  locations: Location[]
  selectedLocations: number[]
  onLocationChange: (locationIds: number[]) => void
  canManageAllLocations: boolean
}

export default function LocationSelector({
  locations,
  selectedLocations,
  onLocationChange,
  canManageAllLocations
}: LocationSelectorProps) {
  const [selectAll, setSelectAll] = useState(false)

  const handleLocationToggle = (locationId: number) => {
    if (selectedLocations.includes(locationId)) {
      // Remove location
      onLocationChange(selectedLocations.filter(id => id !== locationId))
    } else {
      // Add location
      onLocationChange([...selectedLocations, locationId])
    }
  }

  const handleSelectAllToggle = () => {
    const newSelectAll = !selectAll
    setSelectAll(newSelectAll)

    if (newSelectAll) {
      // Select all locations
      onLocationChange(locations.map(loc => loc.id))
    } else {
      // Deselect all locations
      onLocationChange([])
    }
  }

  const getLocationName = (locationId: number) => {
    const location = locations.find(loc => loc.id === locationId)
    return location?.name || `Location #${locationId}`
  }

  const isAllSelected = selectedLocations.length === locations.length && locations.length > 0
  const isPartiallySelected = selectedLocations.length > 0 && selectedLocations.length < locations.length

  return (
    <div className="space-y-4">
      {/* Selection Header */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Select Locations to Update
          </label>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedLocations.length > 0
              ? `${selectedLocations.length} location${selectedLocations.length !== 1 ? 's' : ''} selected`
              : 'No locations selected'
            }
          </p>
        </div>

        {locations.length > 1 && (
          <button
            onClick={handleSelectAllToggle}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isAllSelected
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {isAllSelected ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>

      {/* Location Access Info */}
      <div className={`rounded-lg p-3 text-sm ${
        canManageAllLocations
          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800'
          : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
      }`}>
        {canManageAllLocations ? (
          <div className="flex items-center gap-2">
            <span className="text-lg">👑</span>
            <span>
              As an admin, you can update prices across all {locations.length} locations.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <span>
              You can only update prices for your assigned location.
            </span>
          </div>
        )}
      </div>

      {/* Location List */}
      <div className="space-y-2">
        {locations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-2">📍</div>
            <p>No locations available</p>
            <p className="text-sm">
              Please contact your administrator if you need access to locations.
            </p>
          </div>
        ) : (
          <div className={`border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden ${
            isPartiallySelected ? 'ring-2 ring-blue-500' : ''
          }`}>
            {locations.map((location) => {
              const isSelected = selectedLocations.includes(location.id)

              return (
                <div
                  key={location.id}
                  onClick={() => handleLocationToggle(location.id)}
                  className={`p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by parent div click
                      className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {location.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Location ID: {location.id}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="text-blue-600 dark:text-blue-400">
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected Locations Summary */}
      {selectedLocations.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
            ✅ Selected Locations ({selectedLocations.length})
          </h4>
          <div className="space-y-1">
            {selectedLocations.map(locationId => (
              <div key={locationId} className="text-sm text-green-700 dark:text-green-300">
                • {getLocationName(locationId)}
              </div>
            ))}
          </div>
          <p className="text-xs text-green-600 dark:text-green-400 mt-2">
            Prices will be updated in these locations when you confirm the new price.
          </p>
        </div>
      )}

      {/* Help Text */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p>
          💡 <strong>Tip:</strong> Click on a location to select/deselect it, or use the checkbox.
        </p>
        {canManageAllLocations && (
          <p className="mt-1">
            🔄 <strong>Bulk Update:</strong> Select multiple locations to update the same price across all of them.
          </p>
        )}
      </div>
    </div>
  )
}