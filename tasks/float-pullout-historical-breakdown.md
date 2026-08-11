# Historical breakdown — how much "expense" was actually float movement

Read-only analysis. **No production data was changed.** Generated 2026-08-10.

## What this is

Every shift ends with a `cash_out` equal to that shift's `beginning_cash` — the cashier returning the
change fund. It is a legitimate drawer movement, but until now it was stored as `type = 'cash_out'`,
and the Profit, Profit & Loss, and Tax reports count every `cash_out` row as a business expense.

So historical reports overstate expenses (and understate profit) by the amounts below.

**Identification rule:** rows where `cash_in_out.amount` exactly equals that shift's
`beginning_cash`. This is a heuristic — a genuine expense that happened to equal the float exactly
would be misclassified here. It is used for reading past reports only; nothing was rewritten.

## Totals (all time)

| | Rows | Amount |
|---|---|---|
| Float movement (not an expense) | 731 | **₱3,433,500.00** |
| Genuine expenses | 1,096 | ₱1,891,881.75 |
| Reported as expense | 1,827 | ₱5,325,381.75 |

**64.5% of reported expenses were not expenses.** Profit is understated by ₱3.43M across the period.

## By month and location

Amounts in ₱. "Reported" is what the expense reports currently show; "Real expense" is what they
should have shown.

| Month | Location | Float movement | Real expense | Reported |
|---|---|---|---|---|
| 2026-08 | Bambang | 31,500 | 9,698 | 41,198 |
| 2026-08 | Main Store | 75,000 | 63,630 | 138,630 |
| 2026-08 | Tuguegarao | 30,000 | 2,299 | 32,299 |
| 2026-07 | Bambang | 105,000 | 25,136 | 130,136 |
| 2026-07 | Main Store | 225,000 | 142,102 | 367,102 |
| 2026-07 | Tuguegarao | 99,000 | 23,977 | 122,977 |
| 2026-06 | Bambang | 105,000 | 48,053.81 | 153,053.81 |
| 2026-06 | Main Store | 225,000 | 120,984 | 345,984 |
| 2026-06 | Tuguegarao | 87,000 | 47,181 | 134,181 |
| 2026-05 | Bambang | 105,000 | 57,536 | 162,536 |
| 2026-05 | Main Store | 225,000 | 168,944 | 393,944 |
| 2026-05 | Tuguegarao | 90,000 | 16,867 | 106,867 |
| 2026-04 | Bambang | 101,500 | 42,325 | 143,825 |
| 2026-04 | Main Store | 217,500 | 116,190 | 333,690 |
| 2026-04 | Tuguegarao | 75,000 | 29,526 | 104,526 |
| 2026-03 | Bambang | 108,500 | 48,266 | 156,766 |
| 2026-03 | Main Store | 232,500 | 214,646 | 447,146 |
| 2026-03 | Tuguegarao | 93,000 | 28,572 | 121,572 |
| 2026-02 | Bambang | 98,000 | 55,382.97 | 153,382.97 |
| 2026-02 | Main Store | 210,000 | 158,627 | 368,627 |
| 2026-02 | Tuguegarao | 84,000 | 11,488 | 95,488 |
| 2026-01 | Bambang | 105,000 | 45,250.97 | 150,250.97 |
| 2026-01 | Main Store | 225,000 | 140,731 | 365,731 |
| 2026-01 | Tuguegarao | 90,000 | 41,124 | 131,124 |
| 2025-12 | Bambang | 80,500 | 12,429 | 92,929 |
| 2025-12 | Main Store | 202,500 | 185,561 | 388,061 |
| 2025-12 | Tuguegarao | 78,000 | 13,174 | 91,174 |
| 2025-11 | Bambang | 0 | 210 | 210 |
| 2025-11 | Main Store | 30,000 | 21,971 | 51,971 |

Main Store carries the largest distortion — a ₱7,500 float pulled daily is ₱225,000/month of fake
expense, often more than its real spending.

## Going forward

Pullouts recorded through the new **Float Out** button are stored as `type = 'float_pullout'` and are
excluded from the expense reports automatically. Historical rows keep `type = 'cash_out'`, so expense
figures will show a step change from the date the button goes live — before that date, subtract the
float column above to read a period correctly.

## Query used

```sql
SELECT to_char(c.created_at,'YYYY-MM') AS month,
       l.name AS location,
       SUM(CASE WHEN c.amount = s.beginning_cash THEN c.amount ELSE 0 END) AS float_movement,
       SUM(CASE WHEN c.amount <> s.beginning_cash THEN c.amount ELSE 0 END) AS real_expense,
       SUM(c.amount) AS reported_as_expense
FROM cash_in_out c
JOIN cashier_shifts s ON s.id = c.shift_id
LEFT JOIN business_locations l ON l.id = c.location_id
WHERE c.type = 'cash_out'
GROUP BY 1,2 ORDER BY 1 DESC, 2;
```
