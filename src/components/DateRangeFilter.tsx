'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar, X } from 'lucide-react'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays, subWeeks, subMonths, subQuarters, subYears } from 'date-fns'

export interface DateRange {
  from: Date | null
  to: Date | null
}

interface DateRangeFilterProps {
  value: DateRange
  onChange: (range: DateRange) => void
  placeholder?: string
}

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this_week' },
  { label: 'Last Week', value: 'last_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Last Month', value: 'last_month' },
  { label: 'This Quarter', value: 'this_quarter' },
  { label: 'Last Quarter', value: 'last_quarter' },
  { label: 'This Year', value: 'this_year' },
  { label: 'Last Year', value: 'last_year' },
]

export function getDateRangeFromPreset(preset: string): DateRange {
  const now = new Date()

  switch (preset) {
    case 'today':
      return {
        from: startOfDay(now),
        to: endOfDay(now)
      }
    case 'yesterday':
      const yesterday = subDays(now, 1)
      return {
        from: startOfDay(yesterday),
        to: endOfDay(yesterday)
      }
    case 'this_week':
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }), // Monday
        to: endOfWeek(now, { weekStartsOn: 1 })
      }
    case 'last_week':
      const lastWeek = subWeeks(now, 1)
      return {
        from: startOfWeek(lastWeek, { weekStartsOn: 1 }),
        to: endOfWeek(lastWeek, { weekStartsOn: 1 })
      }
    case 'this_month':
      return {
        from: startOfMonth(now),
        to: endOfMonth(now)
      }
    case 'last_month':
      const lastMonth = subMonths(now, 1)
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth)
      }
    case 'this_quarter':
      return {
        from: startOfQuarter(now),
        to: endOfQuarter(now)
      }
    case 'last_quarter':
      const lastQuarter = subQuarters(now, 1)
      return {
        from: startOfQuarter(lastQuarter),
        to: endOfQuarter(lastQuarter)
      }
    case 'this_year':
      return {
        from: startOfYear(now),
        to: endOfYear(now)
      }
    case 'last_year':
      const lastYear = subYears(now, 1)
      return {
        from: startOfYear(lastYear),
        to: endOfYear(lastYear)
      }
    default:
      return { from: null, to: null }
  }
}

export function DateRangeFilter({ value, onChange, placeholder = 'Filter by date...' }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const [fromDate, setFromDate] = useState(value.from ? format(value.from, 'yyyy-MM-dd') : '')
  const [toDate, setToDate] = useState(value.to ? format(value.to, 'yyyy-MM-dd') : '')

  useEffect(() => {
    setFromDate(value.from ? format(value.from, 'yyyy-MM-dd') : '')
    setToDate(value.to ? format(value.to, 'yyyy-MM-dd') : '')
  }, [value])

  const handlePresetClick = (preset: string) => {
    const range = getDateRangeFromPreset(preset)
    onChange(range)
    setOpen(false)
  }

  const handleCustomApply = () => {
    if (fromDate || toDate) {
      onChange({
        from: fromDate ? startOfDay(new Date(fromDate)) : null,
        to: toDate ? endOfDay(new Date(toDate)) : null
      })
      setOpen(false)
    }
  }

  const handleClear = () => {
    onChange({ from: null, to: null })
    setFromDate('')
    setToDate('')
  }

  const hasValue = value.from || value.to
  const displayText = hasValue
    ? `${value.from ? format(value.from, 'MMM dd, yyyy') : '...'} - ${value.to ? format(value.to, 'MMM dd, yyyy') : '...'}`
    : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`justify-start text-left font-normal w-full ${hasValue ? 'border-blue-500' : ''}`}
        >
          <Calendar className="mr-2 h-4 w-4" />
          <span className="flex-1 truncate">{displayText}</span>
          {hasValue && (
            <X
              className="h-4 w-4 ml-2 hover:bg-gray-200 rounded"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Presets */}
          <div className="border-r">
            <div className="p-3 font-semibold text-sm bg-gray-50 border-b">Quick Select</div>
            <div className="p-2">
              {DATE_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  variant="ghost"
                  className="w-full justify-start text-sm mb-1"
                  onClick={() => handlePresetClick(preset.value)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          <div className="p-4 min-w-[280px]">
            <div className="font-semibold text-sm mb-3">Custom Range</div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  From Date
                </label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  To Date
                </label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setFromDate('')
                    setToDate('')
                  }}
                >
                  Clear
                </Button>
                <Button
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={handleCustomApply}
                  disabled={!fromDate && !toDate}
                >
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
