const { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } = require('date-fns')

function testDateFilters() {
  // Simulating today as October 12, 2025 (Saturday)
  const today = new Date('2025-10-12')

  console.log(`Testing Date Filters for: ${format(today, 'EEEE, MMMM dd, yyyy')}\n`)
  console.log('=' .repeat(60) + '\n')

  const filters = [
    {
      name: 'Today',
      start: format(today, 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd')
    },
    {
      name: 'Yesterday',
      start: format(subDays(today, 1), 'yyyy-MM-dd'),
      end: format(subDays(today, 1), 'yyyy-MM-dd')
    },
    {
      name: 'This Week (Mon-Sun)',
      start: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      end: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    },
    {
      name: 'Last Week',
      start: format(startOfWeek(subDays(today, 7), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      end: format(endOfWeek(subDays(today, 7), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    },
    {
      name: 'This Month',
      start: format(startOfMonth(today), 'yyyy-MM-dd'),
      end: format(endOfMonth(today), 'yyyy-MM-dd')
    },
    {
      name: 'Last Month',
      start: format(startOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1)), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date(today.getFullYear(), today.getMonth() - 1, 1)), 'yyyy-MM-dd')
    },
    {
      name: 'This Year',
      start: format(startOfYear(today), 'yyyy-MM-dd'),
      end: format(endOfYear(today), 'yyyy-MM-dd')
    },
    {
      name: 'Last 7 Days',
      start: format(subDays(today, 6), 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd')
    },
    {
      name: 'Last 30 Days',
      start: format(subDays(today, 29), 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd')
    },
    {
      name: 'Last 90 Days',
      start: format(subDays(today, 89), 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd')
    }
  ]

  filters.forEach((filter, index) => {
    console.log(`${index + 1}. ${filter.name}`)
    console.log(`   Start: ${filter.start}`)
    console.log(`   End:   ${filter.end}`)
    console.log('')
  })

  console.log('=' .repeat(60))
  console.log('\nNote: Week starts on Monday (weekStartsOn: 1)')
  console.log('October 12, 2025 is a Saturday')
  console.log('This Week: Mon Oct 6 - Sun Oct 12')
  console.log('Last Week: Mon Sep 29 - Sun Oct 5')
}

testDateFilters()
