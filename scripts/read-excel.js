const XLSX = require('xlsx');
const workbook = XLSX.readFile('c:/Users/Warenski/Downloads/NewPrices1208.xlsx');

// Check BatchPriceUpdate sheet
const sheet2 = workbook.Sheets['BatchPriceUpdate'];
if (sheet2) {
  const data2 = XLSX.utils.sheet_to_json(sheet2);
  console.log('BatchPriceUpdate Sheet:');
  console.log('Total Rows:', data2.length);
  console.log('Headers:', Object.keys(data2[0] || {}));
  console.log('First 3 rows:', JSON.stringify(data2.slice(0, 3), null, 2));
}

// Show all data from first sheet
const sheet1 = workbook.Sheets['Purchase Items Report'];
const data1 = XLSX.utils.sheet_to_json(sheet1);

// Products with price changes
const withChanges = data1.filter(r => r.diff !== 0);
console.log('\n\nProducts WITH price changes (diff !== 0):', withChanges.length);
console.log('Sample:', JSON.stringify(withChanges.slice(0, 5), null, 2));

// All unique SKUs
console.log('\n\nAll SKUs and New SRP:');
data1.forEach(r => {
  console.log(`SKU: ${r.SKU}, Product: ${r.Product}, New SRP: ${r['New SRP']}`);
});
