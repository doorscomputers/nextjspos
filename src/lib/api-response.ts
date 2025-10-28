/**
 * Standardized API Response Utilities
 *
 * This file ensures consistent API response formats across the entire application.
 * All API endpoints should use these utilities to maintain consistency.
 */

import { NextResponse } from 'next/server'

/**
 * Standard Success Response Format
 * All successful API responses should follow this structure
 */
export interface ApiSuccessResponse<T = any> {
  success: true
  data: T
  message?: string
}

/**
 * Standard Error Response Format
 * All error API responses should follow this structure
 */
export interface ApiErrorResponse {
  success: false
  error: string
  details?: any
}

/**
 * Creates a standardized success response
 *
 * @param data - The data to return
 * @param message - Optional success message
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with standardized format
 *
 * @example
 * return apiSuccess(users, 'Users fetched successfully')
 * // Returns: { success: true, data: users, message: 'Users fetched successfully' }
 */
export function apiSuccess<T>(
  data: T,
  message?: string,
  status: number = 200
): NextResponse {
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message })
  }
  return NextResponse.json(response, { status })
}

/**
 * Creates a standardized error response
 *
 * @param error - Error message
 * @param status - HTTP status code (default: 500)
 * @param details - Optional error details
 * @returns NextResponse with standardized format
 *
 * @example
 * return apiError('User not found', 404)
 * // Returns: { success: false, error: 'User not found' }
 */
export function apiError(
  error: string,
  status: number = 500,
  details?: any
): NextResponse {
  const response: ApiErrorResponse = {
    success: false,
    error,
    ...(details && { details })
  }
  return NextResponse.json(response, { status })
}

/**
 * Helper function to safely extract data from API responses
 * Handles both new standardized format and legacy formats
 *
 * @param response - The API response object
 * @param fallbackKey - Legacy key to check if 'data' doesn't exist
 * @returns The data array or object
 *
 * @example
 * const users = extractApiData(response, 'users')
 * // Works with: { success: true, data: [...] } or { users: [...] }
 */
export function extractApiData<T = any>(
  response: any,
  fallbackKey?: string
): T {
  // New standardized format
  if (response && typeof response === 'object' && 'data' in response) {
    return response.data as T
  }

  // Legacy format with specific key
  if (fallbackKey && response && typeof response === 'object' && fallbackKey in response) {
    return response[fallbackKey] as T
  }

  // Assume response itself is the data
  return response as T
}

/**
 * Type guard to check if response is an error
 */
export function isApiError(response: any): response is ApiErrorResponse {
  return response && typeof response === 'object' && response.success === false
}

/**
 * Type guard to check if response is successful
 */
export function isApiSuccess<T>(response: any): response is ApiSuccessResponse<T> {
  return response && typeof response === 'object' && response.success === true
}
