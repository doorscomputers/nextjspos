import { redirect } from 'next/navigation'

export default function ProductPurchaseHistoryRedirectPage() {
  redirect('/dashboard/reports/purchases-items')
}
