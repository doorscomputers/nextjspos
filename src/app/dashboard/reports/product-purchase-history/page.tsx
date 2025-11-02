// Temporarily disabled - purchases-items page has syntax errors
// Redirect to purchases report instead
import { redirect } from 'next/navigation'

export default function ProductPurchaseHistoryRedirectPage() {
  redirect('/dashboard/reports/purchases')
}
