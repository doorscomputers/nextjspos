import { useState, useEffect } from 'react'

interface Currency {
  id: number
  code: string
  name: string
  symbol: string
}

interface Business {
  id: number
  name: string
  currency: Currency
}

export function useCurrency() {
  const [currencySymbol, setCurrencySymbol] = useState('₱') // Default to Philippine Peso
  const [currencyCode, setCurrencyCode] = useState('PHP')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBusinessSettings()
  }, [])

  const fetchBusinessSettings = async () => {
    try {
      const response = await fetch('/api/business/settings')
      if (response.ok) {
        const data = await response.json()
        const business: Business = data.business
        if (business?.currency) {
          setCurrencySymbol(business.currency.symbol)
          setCurrencyCode(business.currency.code)
        }
      }
    } catch (error) {
      console.error('Error fetching currency settings:', error)
      // Keep default Philippine Peso on error
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number | string): string => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    if (isNaN(numAmount)) return `${currencySymbol}0.00`
    return `${currencySymbol}${numAmount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  return {
    currencySymbol,
    currencyCode,
    loading,
    formatCurrency,
  }
}
