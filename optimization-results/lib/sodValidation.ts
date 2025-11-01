/**
 * Separation of Duties (SOD) Validation Utility
 *
 * This library provides configurable SOD validation for transfers, purchases, and returns.
 * Rules are loaded from business_sod_settings table and can be configured per business.
 */

import { prisma } from '@/lib/prisma'

export interface SODValidationParams {
  businessId: number
  userId: number
  action: 'check' | 'send' | 'receive' | 'complete' | 'approve'
  entity: {
    id: number
    createdBy?: number | null
    checkedBy?: number | null
    sentBy?: number | null
    receivedBy?: number | null
    approvedBy?: number | null
    requestedBy?: number | null // For amendments/returns
  }
  entityType: 'transfer' | 'purchase' | 'customer_return' | 'supplier_return' | 'amendment' | 'grn'
  userRoles?: string[] // Optional: roles of current user for exemption check
}

export interface SODValidationResult {
  allowed: boolean
  reason?: string
  code?: string
  configurable: boolean
  ruleField?: string
  suggestion?: string
}

/**
 * Main SOD validation function
 */
export async function validateSOD(
  params: SODValidationParams
): Promise<SODValidationResult> {
  const { businessId, userId, action, entity, entityType, userRoles } = params

  // Fetch SOD settings for this business (or use defaults)
  const settings = await prisma.businessSODSettings.findUnique({
    where: { businessId }
  })

  // If no settings exist, create defaults (strict mode)
  const sodSettings = settings || {
    // Transfer defaults (strict)
    enforceTransferSOD: { select: { id: true, name: true } },
    allowCreatorToCheck: false,
    allowCreatorToSend: false,
    allowCheckerToSend: false,
    allowSenderToCheck: false,
    allowCreatorToReceive: false,
    allowSenderToComplete: false,
    allowCreatorToComplete: false,
    allowReceiverToComplete: { select: { id: true, name: true } },

    // Purchase defaults (strict)
    enforcePurchaseSOD: { select: { id: true, name: true } },
    allowAmendmentCreatorToApprove: false,
    allowPOCreatorToApprove: false,
    allowGRNCreatorToApprove: false,

    // Return defaults (strict)
    enforceReturnSOD: { select: { id: true, name: true } },
    allowCustomerReturnCreatorToApprove: false,
    allowSupplierReturnCreatorToApprove: false,

    // Exempt roles
    exemptRoles: 'Super Admin,System Administrator',
  }

  // Check if user has exempt role
  if (userRoles && sodSettings.exemptRoles) {
    const exemptRolesList = sodSettings.exemptRoles.split(',').map(r => r.trim())
    const hasExemptRole = userRoles.some(role => exemptRolesList.includes(role))

    if (hasExemptRole) {
      return {
        allowed: { select: { id: true, name: true } },
        configurable: { select: { id: true, name: true } },
        suggestion: `User has exempt role (${userRoles.join(', ')}) - SOD checks bypassed`
      }
    }
  }

  // Route to appropriate validation function
  switch (entityType) {
    case 'transfer':
      return validateTransferSOD(sodSettings, userId, action, entity)

    case 'purchase':
      return validatePurchaseSOD(sodSettings, userId, action, entity)

    case 'amendment':
      return validateAmendmentSOD(sodSettings, userId, action, entity)

    case 'grn':
      return validateGRNSOD(sodSettings, userId, action, entity)

    case 'customer_return':
      return validateCustomerReturnSOD(sodSettings, userId, action, entity)

    case 'supplier_return':
      return validateSupplierReturnSOD(sodSettings, userId, action, entity)

    default:
      return {
        allowed: { select: { id: true, name: true } },
        configurable: false
      }
  }
}

/**
 * Validate Transfer SOD
 */
function validateTransferSOD(
  settings: any,
  userId: number,
  action: string,
  transfer: any
): SODValidationResult {
  // If SOD enforcement is disabled, allow everything
  if (!settings.enforceTransferSOD) {
    return {
      allowed: { select: { id: true, name: true } },
      configurable: { select: { id: true, name: true } },
      suggestion: 'Transfer SOD enforcement is disabled for this business'
    }
  }

  switch (action) {
    case 'check':
      // Creator trying to check their own transfer?
      if (transfer.createdBy === userId && !settings.allowCreatorToCheck) {
        return {
          allowed: false,
          reason: 'You cannot check a transfer you created. Business policy requires a different user to perform this action for proper control.',
          code: 'SOD_CREATOR_CANNOT_CHECK',
          configurable: { select: { id: true, name: true } },
          ruleField: 'allowCreatorToCheck',
          suggestion: 'Admin can enable "Allow Creator to Check" in Settings > Transfer Rules if your team is small'
        }
      }

      // Sender trying to check/approve a transfer they sent?
      // Note: This scenario is rare since checking happens before sending, but included for completeness
      if (transfer.sentBy === userId && !settings.allowSenderToCheck) {
        return {
          allowed: false,
          reason: 'You cannot check a transfer you sent. Business policy requires proper separation of duties.',
          code: 'SOD_SENDER_CANNOT_CHECK',
          configurable: { select: { id: true, name: true } },
          ruleField: 'allowSenderToCheck',
          suggestion: 'Admin can enable "Allow Sender to Approve" in Settings > Transfer Rules if your team is small'
        }
      }
      break

    case 'send':
      // Creator trying to send their own transfer?
      if (transfer.createdBy === userId && !settings.allowCreatorToSend) {
        return {
          allowed: false,
          reason: 'You cannot send a transfer you created. Business policy requires a different user to send for proper control.',
          code: 'SOD_CREATOR_CANNOT_SEND',
          configurable: { select: { id: true, name: true } },
          ruleField: 'allowCreatorToSend',
          suggestion: 'Admin can enable "Allow Creator to Send" in Settings > Transfer Rules'
        }
      }

      // Checker trying to send transfer they checked?
      if (transfer.checkedBy === userId && !settings.allowCheckerToSend) {
        return {
          allowed: false,
          reason: 'You cannot send a transfer you checked. Business policy requires a different user to send for proper control.',
          code: 'SOD_CHECKER_CANNOT_SEND',
          configurable: { select: { id: true, name: true } },
          ruleField: 'allowCheckerToSend',
          suggestion: 'Admin can enable "Allow Checker to Send" in Settings > Transfer Rules'
        }
      }
      break

    case 'receive':
      // Creator trying to receive their own transfer?
      if (transfer.createdBy === userId && !settings.allowCreatorToReceive) {
        return {
          allowed: false,
          reason: 'You cannot receive a transfer you created. Business policy requires a different user at the destination to receive it.',
          code: 'SOD_CREATOR_CANNOT_RECEIVE',
          configurable: { select: { id: true, name: true } },
          ruleField: 'allowCreatorToReceive',
          suggestion: 'Admin can enable "Allow Creator to Receive" in Settings > Transfer Rules'
        }
      }
      break

    case 'complete':
      // Creator trying to complete their own transfer?
      if (transfer.createdBy === userId && !settings.allowCreatorToComplete) {
        return {
          allowed: false,
          reason: 'You cannot complete a transfer you created. Business policy requires a supervisor or manager at the destination to complete it.',
          code: 'SOD_CREATOR_CANNOT_COMPLETE',
          configurable: { select: { id: true, name: true } },
          ruleField: 'allowCreatorToComplete',
          suggestion: 'Admin can enable "Allow Creator to Complete" in Settings > Transfer Rules'
        }
      }

      // Sender trying to complete transfer they sent?
      if (transfer.sentBy === userId && !settings.allowSenderToComplete) {
        return {
          allowed: false,
          reason: 'You cannot complete a transfer you sent. Business policy requires a different user to complete for proper control.',
          code: 'SOD_SENDER_CANNOT_COMPLETE',
          configurable: { select: { id: true, name: true } },
          ruleField: 'allowSenderToComplete',
          suggestion: 'Admin can enable "Allow Sender to Complete" in Settings > Transfer Rules'
        }
      }

      // Receiver trying to complete transfer they received?
      if (transfer.receivedBy === userId && !settings.allowReceiverToComplete) {
        return {
          allowed: false,
          reason: 'You cannot complete a transfer you received. Business policy requires a supervisor to verify and complete.',
          code: 'SOD_RECEIVER_CANNOT_COMPLETE',
          configurable: { select: { id: true, name: true } },
          ruleField: 'allowReceiverToComplete',
          suggestion: 'Admin can disable "Prevent Receiver from Completing" in Settings > Transfer Rules if staff is limited'
        }
      }
      break
  }

  return { allowed: { select: { id: true, name: true } }, configurable: { select: { id: true, name: true } } }
}

/**
 * Validate Purchase Amendment SOD
 */
function validateAmendmentSOD(
  settings: any,
  userId: number,
  action: string,
  amendment: any
): SODValidationResult {
  if (!settings.enforcePurchaseSOD) {
    return {
      allowed: { select: { id: true, name: true } },
      configurable: { select: { id: true, name: true } },
      suggestion: 'Purchase SOD enforcement is disabled'
    }
  }

  if (action === 'approve') {
    if (amendment.requestedBy === userId && !settings.allowAmendmentCreatorToApprove) {
      return {
        allowed: false,
        reason: 'You cannot approve an amendment you requested. Business policy requires a different user to approve.',
        code: 'SOD_AMENDMENT_CREATOR_CANNOT_APPROVE',
        configurable: { select: { id: true, name: true } },
        ruleField: 'allowAmendmentCreatorToApprove',
        suggestion: 'Admin can enable "Allow Amendment Creator to Approve" in Settings > Purchase Rules'
      }
    }
  }

  return { allowed: { select: { id: true, name: true } }, configurable: { select: { id: true, name: true } } }
}

/**
 * Validate Purchase Order SOD
 */
function validatePurchaseSOD(
  settings: any,
  userId: number,
  action: string,
  purchase: any
): SODValidationResult {
  if (!settings.enforcePurchaseSOD) {
    return {
      allowed: { select: { id: true, name: true } },
      configurable: { select: { id: true, name: true } }
    }
  }

  if (action === 'approve') {
    if (purchase.createdBy === userId && !settings.allowPOCreatorToApprove) {
      return {
        allowed: false,
        reason: 'You cannot approve a purchase order you created. Business policy requires a different user to approve.',
        code: 'SOD_PO_CREATOR_CANNOT_APPROVE',
        configurable: { select: { id: true, name: true } },
        ruleField: 'allowPOCreatorToApprove',
        suggestion: 'Admin can enable "Allow PO Creator to Approve" in Settings > Purchase Rules'
      }
    }
  }

  return { allowed: { select: { id: true, name: true } }, configurable: { select: { id: true, name: true } } }
}

/**
 * Validate GRN (Goods Receipt Note) SOD
 */
function validateGRNSOD(
  settings: any,
  userId: number,
  action: string,
  grn: any
): SODValidationResult {
  if (!settings.enforcePurchaseSOD) {
    return {
      allowed: { select: { id: true, name: true } },
      configurable: { select: { id: true, name: true } }
    }
  }

  if (action === 'approve') {
    if (grn.createdBy === userId && !settings.allowGRNCreatorToApprove) {
      return {
        allowed: false,
        reason: 'You cannot approve a goods receipt you created. Business policy requires a different user to approve.',
        code: 'SOD_GRN_CREATOR_CANNOT_APPROVE',
        configurable: { select: { id: true, name: true } },
        ruleField: 'allowGRNCreatorToApprove',
        suggestion: 'Admin can enable "Allow GRN Creator to Approve" in Settings > Purchase Rules'
      }
    }
  }

  return { allowed: { select: { id: true, name: true } }, configurable: { select: { id: true, name: true } } }
}

/**
 * Validate Customer Return SOD
 */
function validateCustomerReturnSOD(
  settings: any,
  userId: number,
  action: string,
  customerReturn: any
): SODValidationResult {
  if (!settings.enforceReturnSOD) {
    return {
      allowed: { select: { id: true, name: true } },
      configurable: { select: { id: true, name: true } }
    }
  }

  if (action === 'approve') {
    if (customerReturn.createdBy === userId && !settings.allowCustomerReturnCreatorToApprove) {
      return {
        allowed: false,
        reason: 'You cannot approve a customer return you created. Business policy requires a supervisor to approve.',
        code: 'SOD_CUSTOMER_RETURN_CREATOR_CANNOT_APPROVE',
        configurable: { select: { id: true, name: true } },
        ruleField: 'allowCustomerReturnCreatorToApprove',
        suggestion: 'Admin can enable "Allow Return Creator to Approve" in Settings > Return Rules'
      }
    }
  }

  return { allowed: { select: { id: true, name: true } }, configurable: { select: { id: true, name: true } } }
}

/**
 * Validate Supplier Return SOD
 */
function validateSupplierReturnSOD(
  settings: any,
  userId: number,
  action: string,
  supplierReturn: any
): SODValidationResult {
  if (!settings.enforceReturnSOD) {
    return {
      allowed: { select: { id: true, name: true } },
      configurable: { select: { id: true, name: true } }
    }
  }

  if (action === 'approve') {
    if (supplierReturn.createdBy === userId && !settings.allowSupplierReturnCreatorToApprove) {
      return {
        allowed: false,
        reason: 'You cannot approve a supplier return you created. Business policy requires a different user to approve.',
        code: 'SOD_SUPPLIER_RETURN_CREATOR_CANNOT_APPROVE',
        configurable: { select: { id: true, name: true } },
        ruleField: 'allowSupplierReturnCreatorToApprove',
        suggestion: 'Admin can enable "Allow Return Creator to Approve" in Settings > Return Rules'
      }
    }
  }

  return { allowed: { select: { id: true, name: true } }, configurable: { select: { id: true, name: true } } }
}

/**
 * Get user's roles for SOD exemption checking
 */
export async function getUserRoles(userId: number): Promise<string[]> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    select: {
      role: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } }
    }
  })

  return userRoles.map(ur => ur.role.name)
}

/**
 * Create default SOD settings for a business
 */
export async function createDefaultSODSettings(businessId: number) {
  const existing = await prisma.businessSODSettings.findUnique({
    where: { businessId }
  })

  if (existing) return existing

  return await prisma.businessSODSettings.create({
    data: {
      businessId,
      // All defaults are already set in the schema
    }
  })
}
