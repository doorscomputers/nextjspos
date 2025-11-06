/**
 * Unit Tests for POS Calculation Functions
 * Tests all critical business logic calculations
 */

import {
  calculateSubtotal,
  calculateDiscountAmount,
  applyDiscount,
  calculateTax,
  calculateTotalWithTax,
  calculateChange,
  calculateMarkupPercent,
  calculateProfitMargin,
  calculateProfit,
  calculateFIFOCost,
  calculateWeightedAverageCost,
  calculateExpectedCashBalance,
  calculateCashVariance,
  calculateCashTotal,
  roundMoney,
  calculateInventoryTurnover,
  calculateDaysInventoryOutstanding,
  calculateGrossProfit,
  calculateGrossProfitMargin,
  CostLayer,
  CashMovement,
  CashDenominations
} from '../calculations'

describe('POS Calculation Functions', () => {

  describe('calculateSubtotal', () => {
    it('should calculate subtotal correctly for multiple items', () => {
      const items = [
        { price: 100, quantity: 2 },
        { price: 50, quantity: 3 },
        { price: 200, quantity: 1 }
      ]
      expect(calculateSubtotal(items)).toBe(550) // (100*2) + (50*3) + (200*1) = 550
    })

    it('should return 0 for empty array', () => {
      expect(calculateSubtotal([])).toBe(0)
    })

    it('should handle decimal prices', () => {
      const items = [
        { price: 99.99, quantity: 2 },
        { price: 49.50, quantity: 1 }
      ]
      expect(calculateSubtotal(items)).toBeCloseTo(249.48, 2)
    })
  })

  describe('calculateDiscountAmount', () => {
    it('should calculate 10% discount correctly', () => {
      expect(calculateDiscountAmount(1000, 10)).toBe(100)
    })

    it('should calculate 25% discount correctly', () => {
      expect(calculateDiscountAmount(500, 25)).toBe(125)
    })

    it('should return 0 for 0% discount', () => {
      expect(calculateDiscountAmount(1000, 0)).toBe(0)
    })

    it('should throw error for negative discount', () => {
      expect(() => calculateDiscountAmount(1000, -5)).toThrow('Discount percent must be between 0 and 100')
    })

    it('should throw error for discount over 100%', () => {
      expect(() => calculateDiscountAmount(1000, 150)).toThrow('Discount percent must be between 0 and 100')
    })
  })

  describe('applyDiscount', () => {
    it('should apply 10% discount correctly', () => {
      expect(applyDiscount(1000, 10)).toBe(900)
    })

    it('should apply 50% discount correctly', () => {
      expect(applyDiscount(200, 50)).toBe(100)
    })

    it('should return original amount for 0% discount', () => {
      expect(applyDiscount(1000, 0)).toBe(1000)
    })
  })

  describe('calculateTax', () => {
    it('should calculate 12% VAT correctly', () => {
      expect(calculateTax(1000, 12)).toBe(120)
    })

    it('should calculate 8% tax correctly', () => {
      expect(calculateTax(500, 8)).toBe(40)
    })

    it('should return 0 for 0% tax', () => {
      expect(calculateTax(1000, 0)).toBe(0)
    })

    it('should throw error for negative tax', () => {
      expect(() => calculateTax(1000, -5)).toThrow('Tax percent cannot be negative')
    })
  })

  describe('calculateTotalWithTax', () => {
    it('should add 12% VAT to subtotal', () => {
      expect(calculateTotalWithTax(1000, 12)).toBe(1120)
    })

    it('should handle decimal amounts', () => {
      expect(calculateTotalWithTax(99.99, 12)).toBeCloseTo(111.99, 2)
    })
  })

  describe('calculateChange', () => {
    it('should calculate correct change', () => {
      expect(calculateChange(850, 1000)).toBe(150)
    })

    it('should return 0 for exact payment', () => {
      expect(calculateChange(100, 100)).toBe(0)
    })

    it('should throw error for insufficient payment', () => {
      expect(() => calculateChange(1000, 900)).toThrow('Insufficient payment')
    })
  })

  describe('calculateMarkupPercent', () => {
    it('should calculate 100% markup correctly', () => {
      expect(calculateMarkupPercent(100, 200)).toBe(100)
    })

    it('should calculate 50% markup correctly', () => {
      expect(calculateMarkupPercent(200, 300)).toBe(50)
    })

    it('should calculate 25% markup correctly', () => {
      expect(calculateMarkupPercent(100, 125)).toBe(25)
    })

    it('should throw error for zero cost', () => {
      expect(() => calculateMarkupPercent(0, 100)).toThrow('Cost must be greater than zero')
    })

    it('should throw error for negative cost', () => {
      expect(() => calculateMarkupPercent(-100, 200)).toThrow('Cost must be greater than zero')
    })
  })

  describe('calculateProfitMargin', () => {
    it('should calculate 50% profit margin correctly', () => {
      // Cost: 50, Selling: 100 => Profit: 50, Margin: 50/100 = 50%
      expect(calculateProfitMargin(50, 100)).toBe(50)
    })

    it('should calculate 33.33% profit margin correctly', () => {
      // Cost: 100, Selling: 150 => Profit: 50, Margin: 50/150 = 33.33%
      expect(calculateProfitMargin(100, 150)).toBeCloseTo(33.33, 2)
    })

    it('should throw error for zero selling price', () => {
      expect(() => calculateProfitMargin(100, 0)).toThrow('Selling price must be greater than zero')
    })
  })

  describe('calculateProfit', () => {
    it('should calculate profit for single item', () => {
      expect(calculateProfit(100, 150)).toBe(50)
    })

    it('should calculate profit for multiple items', () => {
      expect(calculateProfit(100, 150, 5)).toBe(250) // (150-100) * 5
    })

    it('should return 0 for break-even pricing', () => {
      expect(calculateProfit(100, 100, 10)).toBe(0)
    })

    it('should return negative for loss', () => {
      expect(calculateProfit(150, 100, 5)).toBe(-250)
    })
  })

  describe('calculateFIFOCost', () => {
    it('should calculate FIFO correctly with partial consumption', () => {
      const purchases: CostLayer[] = [
        { date: new Date('2024-01-01'), quantity: 10, unitCost: 100 },
        { date: new Date('2024-01-02'), quantity: 10, unitCost: 110 },
        { date: new Date('2024-01-03'), quantity: 10, unitCost: 120 }
      ]

      const result = calculateFIFOCost(purchases, 15) // Sell 15 units

      // Should consume all 10 from first batch, 5 from second batch
      expect(result.totalQuantity).toBe(15) // 5 + 10 remaining
      expect(result.remainingLayers).toHaveLength(2) // Second and third batches remain
      expect(result.remainingLayers[0].quantity).toBe(5) // 5 remaining from second batch
      expect(result.remainingLayers[1].quantity).toBe(10) // All 10 from third batch
      expect(result.totalCost).toBe(1750) // (5*110) + (10*120) = 550 + 1200
      expect(result.averageCost).toBeCloseTo(116.67, 2)
    })

    it('should handle exact consumption of all layers', () => {
      const purchases: CostLayer[] = [
        { date: new Date('2024-01-01'), quantity: 10, unitCost: 100 },
        { date: new Date('2024-01-02'), quantity: 10, unitCost: 110 }
      ]

      const result = calculateFIFOCost(purchases, 20)

      expect(result.totalQuantity).toBe(0)
      expect(result.remainingLayers).toHaveLength(0)
      expect(result.totalCost).toBe(0)
      expect(result.averageCost).toBe(0)
    })

    it('should handle no sales', () => {
      const purchases: CostLayer[] = [
        { date: new Date('2024-01-01'), quantity: 10, unitCost: 100 }
      ]

      const result = calculateFIFOCost(purchases, 0)

      expect(result.totalQuantity).toBe(10)
      expect(result.remainingLayers).toHaveLength(1)
      expect(result.totalCost).toBe(1000)
    })

    it('should throw error for negative sold quantity', () => {
      const purchases: CostLayer[] = [
        { date: new Date('2024-01-01'), quantity: 10, unitCost: 100 }
      ]

      expect(() => calculateFIFOCost(purchases, -5)).toThrow('Sold quantity cannot be negative')
    })
  })

  describe('calculateWeightedAverageCost', () => {
    it('should calculate weighted average correctly', () => {
      const purchases: CostLayer[] = [
        { date: new Date('2024-01-01'), quantity: 10, unitCost: 100 },
        { date: new Date('2024-01-02'), quantity: 20, unitCost: 110 },
        { date: new Date('2024-01-03'), quantity: 30, unitCost: 120 }
      ]

      // Total: (10*100) + (20*110) + (30*120) = 1000 + 2200 + 3600 = 6800
      // Quantity: 10 + 20 + 30 = 60
      // Average: 6800 / 60 = 113.33
      expect(calculateWeightedAverageCost(purchases)).toBeCloseTo(113.33, 2)
    })

    it('should return 0 for empty purchases', () => {
      expect(calculateWeightedAverageCost([])).toBe(0)
    })
  })

  describe('calculateExpectedCashBalance', () => {
    it('should calculate expected cash correctly', () => {
      const movements: CashMovement = {
        beginningCash: 5000,
        cashSales: 10000,
        cashIn: 2000,
        cashOut: 1500
      }

      expect(calculateExpectedCashBalance(movements)).toBe(15500)
      // 5000 + 10000 + 2000 - 1500 = 15500
    })

    it('should handle zero values', () => {
      const movements: CashMovement = {
        beginningCash: 5000,
        cashSales: 0,
        cashIn: 0,
        cashOut: 0
      }

      expect(calculateExpectedCashBalance(movements)).toBe(5000)
    })
  })

  describe('calculateCashVariance', () => {
    it('should calculate overage correctly', () => {
      expect(calculateCashVariance(10000, 10500)).toBe(500) // +500 overage
    })

    it('should calculate shortage correctly', () => {
      expect(calculateCashVariance(10000, 9800)).toBe(-200) // -200 shortage
    })

    it('should return 0 for perfect match', () => {
      expect(calculateCashVariance(10000, 10000)).toBe(0)
    })
  })

  describe('calculateCashTotal', () => {
    it('should calculate total from denominations correctly', () => {
      const denominations: CashDenominations = {
        bills1000: 10,  // 10,000
        bills500: 5,    // 2,500
        bills200: 10,   // 2,000
        bills100: 20,   // 2,000
        bills50: 10,    // 500
        bills20: 15,    // 300
        coins10: 10,    // 100
        coins5: 20,     // 100
        coins1: 50,     // 50
        coins025: 8     // 2
      }

      expect(calculateCashTotal(denominations)).toBe(17552)
    })

    it('should handle all zeros', () => {
      const denominations: CashDenominations = {
        bills1000: 0,
        bills500: 0,
        bills200: 0,
        bills100: 0,
        bills50: 0,
        bills20: 0,
        coins10: 0,
        coins5: 0,
        coins1: 0,
        coins025: 0
      }

      expect(calculateCashTotal(denominations)).toBe(0)
    })

    it('should handle fractional coins correctly', () => {
      const denominations: CashDenominations = {
        bills1000: 0,
        bills500: 0,
        bills200: 0,
        bills100: 1,    // 100
        bills50: 0,
        bills20: 0,
        coins10: 0,
        coins5: 1,      // 5
        coins1: 2,      // 2
        coins025: 4     // 1 (4 * 0.25)
      }

      expect(calculateCashTotal(denominations)).toBe(108)
    })
  })

  describe('roundMoney', () => {
    it('should round to 2 decimal places', () => {
      expect(roundMoney(99.999)).toBe(100)
      expect(roundMoney(99.994)).toBe(99.99)
      expect(roundMoney(99.995)).toBe(100)
    })

    it('should handle integers', () => {
      expect(roundMoney(100)).toBe(100)
    })
  })

  describe('calculateInventoryTurnover', () => {
    it('should calculate turnover ratio correctly', () => {
      // COGS: 120,000, Avg Inventory: 20,000
      // Turnover: 120,000 / 20,000 = 6
      expect(calculateInventoryTurnover(120000, 20000)).toBe(6)
    })

    it('should handle decimal values', () => {
      expect(calculateInventoryTurnover(100000, 30000)).toBeCloseTo(3.33, 2)
    })

    it('should throw error for zero inventory', () => {
      expect(() => calculateInventoryTurnover(100000, 0)).toThrow('Average inventory value must be greater than zero')
    })
  })

  describe('calculateDaysInventoryOutstanding', () => {
    it('should calculate DIO correctly', () => {
      // Avg Inventory: 20,000, COGS: 120,000
      // DIO: (20,000 / 120,000) * 365 = 60.83 days
      expect(calculateDaysInventoryOutstanding(20000, 120000)).toBeCloseTo(60.83, 2)
    })

    it('should throw error for zero COGS', () => {
      expect(() => calculateDaysInventoryOutstanding(20000, 0)).toThrow('Cost of goods sold must be greater than zero')
    })
  })

  describe('calculateGrossProfit', () => {
    it('should calculate gross profit correctly', () => {
      expect(calculateGrossProfit(100000, 60000)).toBe(40000)
    })

    it('should handle negative profit (loss)', () => {
      expect(calculateGrossProfit(50000, 80000)).toBe(-30000)
    })
  })

  describe('calculateGrossProfitMargin', () => {
    it('should calculate 40% margin correctly', () => {
      // Revenue: 100,000, COGS: 60,000
      // Gross Profit: 40,000
      // Margin: 40,000 / 100,000 = 40%
      expect(calculateGrossProfitMargin(100000, 60000)).toBe(40)
    })

    it('should calculate 25% margin correctly', () => {
      expect(calculateGrossProfitMargin(1000, 750)).toBe(25)
    })

    it('should throw error for zero revenue', () => {
      expect(() => calculateGrossProfitMargin(0, 100)).toThrow('Revenue must be greater than zero')
    })
  })
})
