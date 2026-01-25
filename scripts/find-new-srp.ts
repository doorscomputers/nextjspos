import * as XLSX from 'xlsx'

const EXCEL_FILE = 'C:/Users/Warenski/Downloads/price-comparison-report-for-price-update.xlsx'

const workbook = XLSX.readFile(EXCEL_FILE)
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const data: any[] = XLSX.utils.sheet_to_json(sheet)

const toUpdate = data.filter(r => r['New SRP'] !== undefined && r['New SRP'] !== null && r['New SRP'] !== '')

console.log('Products with New SRP:', toUpdate.length)
console.log('')
toUpdate.forEach(r => {
  console.log(`Product: ${r.Product}`)
  console.log(`  SKU: ${r.SKU}`)
  console.log(`  Old Price: ${r['OLD BEST Price'] || 'N/A'}`)
  console.log(`  New SRP: ${r['New SRP']}`)
  console.log('')
})
