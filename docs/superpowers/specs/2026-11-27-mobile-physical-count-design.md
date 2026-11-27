# Mobile Physical Count (Android app) — Design

Date: 2026-11-27
Status: Approved in brainstorming, awaiting spec review

## 1. Goal

Let branch staff count stock with an Android phone (camera now; Bluetooth
scanner or rugged scanner device later), and let an approver review each count
on the web and post only the real differences to every item's stock ledger.

## 2. Decisions (agreed)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Location identity | User logs in with username/password, then **must scan the branch location card**. The card must be one of the user's assigned branches. Required for every role (admins too) because it defines the branch being counted. |
| 2 | Same item in several spots | **Running total**. Each confirmed entry is its own line; item total = sum of lines. |
| 3 | Approval unit | **Count Session**, submitted at the end, then approved on the web. |
| 4 | Sales during the count | **Snapshot system qty at count time**; on approval post `counted − systemAtCount`, so later sales/transfers stay correct. |
| 5 | Confirmation | **Confirm pop-up** after entering qty: product name, big qty, running total, Edit / Confirm. Hardware scanner Enter = Confirm. |
| 6 | System qty visibility | **Blind count**. Counter never sees system qty. |
| 7 | Connectivity | **Works through signal drops**. Lines save on the phone first and upload automatically. |
| 8 | Items not scanned | **Only counted items change**. Review page lists "Not counted" items for information. |
| 9 | Barcode not found | **Contains-search on name + SKU**, then **Unknown item** note if still not found. |
| 10 | Build approach | **Expo (React Native) app in `mobile/`** + new `/api/mobile/*` routes on the existing Next.js server. |
| 11 | Counters per session | **Several counters can join** the same branch session. |

## 3. Architecture

```
Android app (mobile/, Expo)          Next.js server (existing)                 Web (approver)
- login + card scan          --->    /api/mobile/auth                          Physical Count Sessions page
- product list -> SQLite     --->    /api/mobile/count/products                - review tabs
- scan, qty, confirm                 /api/mobile/count/sessions                - approve / send back
- upload queue (retry-safe)  --->    /api/mobile/count/lines   (upsert by id)        |
- I'm done / submit          --->    /api/mobile/count/sessions/:id/done|submit      v
                                     Tables: CountSession, CountLine,       InventoryCorrection +
                                     CountLineEdit, CountUnknownItem        updateStock() (existing)
```

The phone never changes stock. Only web approval does, through the existing
`updateStock()` path.

### 3.1 Verified platform facts

- `expo-camera` `CameraView` has built-in barcode scanning (`onBarcodeScanned`,
  `barcodeScannerSettings.barcodeTypes`: ean13, ean8, upc_a, upc_e, code128,
  code39, code93, itf14, codabar, qr, …). No extra scanner library.
- `expo-sqlite` gives a persistent on-device database (`openDatabaseAsync`,
  `runAsync` with bound parameters).
- EAS Build with `"distribution": "internal"` / `"android": {"buildType": "apk"}`
  produces an installable APK (sideload; no Play Store).
- `next-auth` v4 is installed; `next-auth/jwt` `encode`/`decode` with
  `NEXTAUTH_SECRET` signs the mobile token, so no new auth dependency.
- `StockTransaction` stores `balanceQty` and `createdAt`, so "stock as of time T"
  is the latest ledger row for (variation, location) with `createdAt <= T`
  (0 if none).
- Barcodes are product / variation SKUs (same field the POS scanner matches).

## 4. Data model (new Prisma models)

All rows carry `businessId` for tenant isolation.

**CountSession**
- `id`, `businessId`, `locationId`
- `status`: `open` | `submitted` | `approved` | `sent_back`
- `startedBy`, `startedAt`, `submittedBy?`, `submittedAt?`
- `approvedBy?`, `approvedAt?`, `sendBackNote?`
- `activeLocationId Int? @unique`: set to `locationId` while the status is
  `open`, `submitted` or `sent_back`; set to `null` on `approved`.
- Rule: at most **one active session per location**, enforced by the database
  through that unique column (Postgres allows many NULLs in a unique column).
  This works with the project's `prisma db push` workflow; a partial index would
  not be managed by Prisma.

**CountSessionCounter** (who joined)
- `sessionId`, `userId`, `joinedAt`, `doneAt?` (set by "I'm done")
- Submit is allowed only when every joined counter has `doneAt` set.
  "Sent back" clears `doneAt` for all counters.

**CountLine** (one confirmed entry)
- `id` = UUID generated on the phone (primary key; upload is an upsert, so retries never duplicate)
- `sessionId`, `productId`, `productVariationId`, `qty` (Decimal, base unit), `spot?` (text)
- `countedBy`, `countedAt` (server-corrected, see 6.3)
- `systemQtyAtCount` (Decimal, computed by the server, never returned to the phone)
- `deletedAt?` (soft delete), `updatedAt`

**CountLineEdit** (edit history)
- `lineId`, `oldQty`, `newQty` (null when deleted), `editedBy`, `editedAt`

**CountUnknownItem**
- `id` = phone UUID, `sessionId`, `scannedCode?`, `description`, `qty`, `countedBy`, `countedAt`
- Notes only. Never posts stock.

**InventoryCorrection** (existing) gets one nullable column `countSessionId`
linking the correction to its session. Reason value: `physical_count`.

## 5. Permissions (RBAC)

- New permission `physical_count.mobile` ("Count stock with the mobile app").
  Required for `/api/mobile/auth` and every `/api/mobile/count/*` route. Added to
  `PERMISSIONS`, permission descriptions and seed. Not added to any role by
  default; the owner assigns it in Roles.
- New permission `physical_count.view` for viewing the sessions page (given to
  the same roles that have `inventory_correction.view`).
- Approve / send back reuse `inventory_correction.approve`.
- Self-approval block: the approver must not be any counter in the session.
- Location access: the session's location must be in the approver's
  accessible locations (`getUserAccessibleLocationIds`).

## 6. Server behavior

### 6.1 Mobile login — `POST /api/mobile/auth`
1. Same username/password check as web login (bcrypt, active user).
2. User must have `physical_count.mobile`.
3. Body includes the scanned `locationCode`. It must match an active
   `BusinessLocation` in the user's business **and** be one of the user's
   `UserLocation` rows. Mismatch → 403 "This card is not one of your branches."
4. Returns a signed token (12 h) holding `userId`, `businessId`, `locationId`
   and scope `count`. A helper `getMobileUser(request)` verifies it; mobile
   routes reject any token without scope `count`, and the token is not accepted
   by any other API route.
5. Failed and successful attempts are written to the audit log. (Web login has
   no rate limiting today; adding it for both web and mobile is a separate task.)

### 6.2 Product list — `GET /api/mobile/count/products`
Returns active variations for the business: `productId`, `variationId`,
product name, variation name, SKU / sub-SKU. **No quantities, no prices.**
Supports `?since=` for incremental refresh.

### 6.3 Lines — `POST /api/mobile/count/lines`
- Batch upsert of lines, edits, deletes and unknown items from the phone queue.
- Body includes `deviceNow`. Server computes `offset = serverNow − deviceNow`
  and stores `countedAt = deviceCountedAt + offset`; clamped to not be in the
  future or before the session started.
- On insert, or when `countedAt` changes, the server computes
  `systemQtyAtCount` from the ledger as of `countedAt`.
- Rejected (409) unless the session is `open` and the user has joined it.
- Edits and deletes write a `CountLineEdit` row.

### 6.4 Session actions
- `POST /sessions` start (fails with the existing session id if the branch already has one active), `POST /sessions/:id/join`
- `POST /sessions/:id/done` (counter finished; phone sends it only after its queue is empty)
- `POST /sessions/:id/submit` (all counters done) → `submitted`
- `GET /sessions/current` (for the app to show join / status / sent-back note)

### 6.5 Approval — web `POST /api/count-sessions/:id/approve`
Body: list of `productVariationId`s to post (all, or the ticked ones).
In **one transaction**:
1. Atomic claim: `updateMany where status = 'submitted'` → `approved`, `activeLocationId = null`; 0 rows → 409 (stops double-click / retry double posting).
2. For each variation in the session: `counted = sum(qty of non-deleted lines)`;
   `system = systemQtyAtCount of its latest line`; `difference = counted − system`.
3. Ticked and `difference ≠ 0` → create `InventoryCorrection`
   (status approved, reason `physical_count`, `countSessionId`) and call
   `updateStock({ quantity: difference, type: ADJUSTMENT, referenceType: 'inventory_correction', allowNegative: true })`.
   `difference = 0` → recorded as matched, nothing posted. Unticked → recorded as skipped.
4. The shared steps of the current approve route (create correction → `updateStock` → link transaction)
   move into one function in `src/lib/` used by both the existing approve route and this one. The
   existing route keeps its current behavior (`physicalCount − currentQty`).
After the transaction: audit log, and one Telegram/SMS summary for the session
(not one per item).

`POST /api/count-sessions/:id/send-back` with a note → `sent_back`; counters can
edit again and resubmit.

## 7. Mobile app (mobile/)

Expo + TypeScript, `expo-camera`, `expo-sqlite`, `expo-secure-store` (token).
Large text (16px+), big tap targets, high contrast, teal brand colour matching
the web app.

Screens:
1. **Login + card**: username, password, then scan the location card (scanner input or camera).
2. **Start / join**: shows the branch's active session (join) or Start new count; downloads the product list.
3. **Counting**: always-focused scan box (keyboard-wedge scanners type into it and send Enter); optional camera; list of items with running totals; "⏳ N waiting to upload" badge; **I'm done**.
4. **Not found**: red message with the code → contains-search on name + SKU (local SQLite) → **Log as unknown item**.
5. **Item detail**: all lines for the item (spot, who, time); edit or delete with the Confirm pop-up; only while the session is open.

Qty entry → **Confirm pop-up** (product name, SKU, big qty, running total; Edit / Confirm).
Nothing is saved until Confirm. Hardware Enter = Confirm.

Error handling:
- No signal: lines stay queued in SQLite; retry with backoff when online.
- Token expired: re-enter password; the queue is kept.
- Session submitted / sent back / approved elsewhere: clear message, counting screen locks, queued lines are kept and shown (never silently dropped).
- Camera permission denied: scanner / typing still works.
- App restart or crash: state restored from SQLite.

## 8. Web review page — Physical Count Sessions

Menu: Inventory → Physical Count Sessions (Sidebar entry gated by `physical_count.view`).
- **Session list**: status badges (amber Submitted, green Approved, red Sent back, grey Open), branch, counters, dates, item count, ₱ impact.
- **Session detail**, with folder tabs:
  - **Counted**: product, SKU, system at count, counted, difference (green +, red −), ₱ value (difference × the same unit cost `updateStock()` records for an adjustment), ⚠ "stock moved after count".
  - **Not counted**: variations with non-zero current stock at the location and no line.
  - **Unknown items**
  - **Edit history**
- Grids: DevExtreme DataGrid + shared `DataGridPagerBar` (Rows per page 10/25/50/100, default 25; "Showing X–Y of Z"; Previous / Next; Page N of M). Totals cover all rows. A **shared top scrollbar** component synced with the grid's bottom scroll (hidden when nothing overflows) is added once in `src/components/` and used here.
- Actions: **Send back (note)**, **Approve selected**, **Approve all with differences**, each with a confirm dialog showing the ₱ impact. Print, PDF and Excel export.
- Dark mode supported; button styles per CLAUDE.md.

## 9. Out of scope

- Counting individual serial numbers (serial items are counted by qty).
- "Set uncounted items to zero" (wall-to-wall) action.
- iOS build.
- Play Store publishing.

## 10. Testing and rollout

1. Server first: schema + routes + approval, without changing the Excel import or the existing approve behavior.
2. Tests: retry/double-click does not double post; difference uses system-at-count; one active session per branch (DB constraint); self-approval blocked; card must match the user's branches; phone clock offset correction; blind (no qty in mobile responses).
3. Extend the TLA+ stock model with the count-session approval path.
4. `npx prisma generate`, type-check and `npm run build` before each commit.
5. Pilot: one phone, one branch, a small partial count; approve; check item ledgers; then roll out.
6. Rugged device later: confirm its scanner is set to send Enter after each scan (Zebra DataWedge / Honeywell settings). No code change expected.

## 11. Implementation notes (what was built, where it differs from above)

- **Approval posts each item in its own small transaction** (like the existing bulk-approve),
  not one big transaction, so large counts don't hit the 60 s transaction limit. Safety comes from
  a unique index on `inventory_corrections(count_session_id, product_variation_id)`: an item can
  never be posted twice, even on double-click, retry or resume. Session status goes
  `submitted → approving → approved`. If any item fails, the session stays `approving` and
  pressing Approve again posts only the remaining items.
- **The existing approve / bulk-approve routes were NOT changed** (section 6.5 step 4 dropped).
  The mobile approval creates its own `InventoryCorrection` (reason `physical_count`,
  `countSessionId` set) and calls `updateStock()` directly. Excel import behavior is unchanged.
- **Value (₱)** = difference × `ProductVariation.purchasePrice`.
- **Alerts:** one Telegram summary per approved session (`sendTelegramPhysicalCountApprovedAlert`).
  No SMS (avoids per-message cost for hundreds of items).
- **Database changes are additive only** and live in `prisma/sql/2026-11-27-mobile-count.sql`.
  Do NOT use `npm run db:push` on production: Prisma would DROP the three
  `inventory_repair_backup_*_2026_06_24` tables that are not in the schema.
- **Permissions setup:** `prisma/add-physical-count-permissions.ts` (idempotent). The existing
  "Inventory Counter" role gets `physical_count.mobile`; roles with `inventory_correction.approve`
  get `physical_count.view` and the menu.
- **Not done yet:** TLA+ model extension (section 10.3); real-device end-to-end test; app icons.
- Files: `src/lib/mobileCount.ts`, `src/lib/mobileCountRules.ts` (+ tests),
  `src/lib/countSessionReview.ts`, `src/lib/countSessionAuth.ts`, `src/app/api/mobile/**`,
  `src/app/api/count-sessions/**`, `src/app/dashboard/physical-count-sessions/**`,
  `src/components/physical-count/*`, `src/components/DataGridTopScrollbar.tsx`, `mobile/`.
