import { useState, useEffect } from 'react'

interface Business {
  id: number
  name: string
  currencyId: number
  currency: {
    id: number
    name: string
    code: string
    symbol: string
  }
  startDate: string | null
  taxNumber1: string
  taxLabel1: string
  taxNumber2: string | null
  taxLabel2: string | null
  defaultProfitPercent: number
  timeZone: string
  fyStartMonth: number
  accountingMethod: string
  defaultSalesDiscount: number | null
  sellPriceTax: string
  logo: string | null
  skuPrefix: string | null
  skuFormat: string
  enableTooltip: boolean
}

export function useBusiness() {
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBusiness()
  }, [])

  const fetchBusiness = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/business/settings')
      if (res.ok) {
        const data = await res.json()
        setBusiness(data.business)
      } else {
        const errorData = await res.json()
        setError(errorData.error || 'Failed to fetch business settings')
      }
    } catch (err) {
      console.error('Error fetching business:', err)
      setError('Failed to fetch business settings')
    } finally {
      setLoading(false)
    }
  }

  return {
    business,
    loading,
    error,
    companyName: business?.name || 'UltimatePOS', // Fallback to UltimatePOS if not loaded
    refetch: fetchBusiness
  }
}
