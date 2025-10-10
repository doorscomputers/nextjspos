/**
 * SKU Generation Utility
 * Auto-generates SKUs for products based on business settings
 */

export interface SKUGeneratorOptions {
  prefix?: string
  format: 'hyphen' | 'no_hyphen'
  productId: number
  paddingLength?: number
}

export interface VariationSKUOptions {
  productSku: string
  variationType: 'with_out_variation' | 'with_variation'
  counter?: number
  variationValue?: string
}

/**
 * Generate product SKU based on business settings
 *
 * @param options - SKU generation options
 * @returns Generated SKU string
 *
 * @example
 * generateProductSKU({ prefix: 'PROD', format: 'hyphen', productId: 5 })
 * // Returns: "PROD-0005"
 *
 * @example
 * generateProductSKU({ prefix: 'PROD', format: 'no_hyphen', productId: 5 })
 * // Returns: "PROD0005"
 */
export function generateProductSKU(options: SKUGeneratorOptions): string {
  const {
    prefix = 'PROD',
    format,
    productId,
    paddingLength = 4
  } = options

  // Pad the product ID with leading zeros
  const paddedId = String(productId).padStart(paddingLength, '0')

  // Generate SKU based on format
  if (format === 'hyphen') {
    return `${prefix}-${paddedId}`
  } else {
    return `${prefix}${paddedId}`
  }
}

/**
 * Generate variation SKU based on product SKU and variation settings
 *
 * @param options - Variation SKU options
 * @returns Generated variation SKU
 *
 * @example
 * generateVariationSKU({
 *   productSku: 'PROD-0001',
 *   variationType: 'with_out_variation',
 *   counter: 1
 * })
 * // Returns: "PROD-0001-1"
 *
 * @example
 * generateVariationSKU({
 *   productSku: 'PROD-0001',
 *   variationType: 'with_variation',
 *   variationValue: 'Small'
 * })
 * // Returns: "PROD-0001Small"
 */
export function generateVariationSKU(options: VariationSKUOptions): string {
  const {
    productSku,
    variationType,
    counter,
    variationValue
  } = options

  if (variationType === 'with_out_variation') {
    // Format: SKU-Number (e.g., PROD-0001-1, PROD-0001-2)
    if (counter === undefined) {
      throw new Error('Counter is required for with_out_variation type')
    }

    // If product SKU already has hyphen, add counter with hyphen
    // Otherwise, append counter directly
    if (productSku.includes('-')) {
      return `${productSku}-${counter}`
    } else {
      return `${productSku}${counter}`
    }
  } else {
    // Format: SKUVariation (e.g., PROD-0001Small, PROD-0001Medium)
    if (!variationValue) {
      throw new Error('Variation value is required for with_variation type')
    }

    // Sanitize variation value - remove all non-alphanumeric characters
    const sanitizedValue = variationValue.replace(/[^a-zA-Z0-9]/g, '')

    return `${productSku}${sanitizedValue}`
  }
}

/**
 * Check if a SKU string is empty or whitespace
 * Used to determine if auto-generation should occur
 */
export function isSkuEmpty(sku: string | null | undefined): boolean {
  return !sku || sku.trim() === ''
}

/**
 * Validate SKU format
 * Ensures SKU meets basic requirements
 */
export function validateSKU(sku: string): { valid: boolean; error?: string } {
  if (!sku || sku.trim() === '') {
    return { valid: false, error: 'SKU cannot be empty' }
  }

  // SKU should be alphanumeric with optional hyphens/underscores
  const skuPattern = /^[a-zA-Z0-9\-_]+$/

  if (!skuPattern.test(sku)) {
    return {
      valid: false,
      error: 'SKU can only contain letters, numbers, hyphens, and underscores'
    }
  }

  if (sku.length > 50) {
    return { valid: false, error: 'SKU cannot exceed 50 characters' }
  }

  return { valid: true }
}
