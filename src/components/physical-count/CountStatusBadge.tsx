import { Badge } from '@/components/ui/badge'

export const COUNT_STATUS_LABEL: Record<string, string> = {
  open: 'Counting',
  submitted: 'Waiting for approval',
  approving: 'Approving…',
  sent_back: 'Sent back',
  approved: 'Approved',
}

const STYLE: Record<string, string> = {
  open: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600',
  submitted: 'bg-amber-50 text-amber-800 border-amber-400 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700',
  approving: 'bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700',
  sent_back: 'bg-red-50 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-700',
  approved: 'bg-green-50 text-green-800 border-green-400 dark:bg-green-950 dark:text-green-300 dark:border-green-700',
}

export function CountStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={STYLE[status] ?? ''}>
      {COUNT_STATUS_LABEL[status] ?? status}
    </Badge>
  )
}
