# Mobile Physical Count — API contract (server ⇄ Android app)

Base URL: the web app URL (e.g. `https://<app>.vercel.app`), configurable in the app.
All bodies are JSON. Errors: HTTP 4xx/5xx with `{ "error": "message" }`.
Every route except `/api/mobile/auth` needs `Authorization: Bearer <token>`.
`401` = token missing/expired/revoked → app asks for the password again (keeps its queue).

## POST /api/mobile/auth
Request: `{ "username": "juan", "password": "…", "locationCode": "ABC1234567" }`
Response 200:
```json
{ "token": "…", "expiresAt": "2026-11-28T08:00:00.000Z",
  "user": { "id": 7, "name": "Juan Dela Cruz" },
  "location": { "id": 2, "name": "Main Warehouse" },
  "businessName": "Igoro Tech" }
```
401 wrong username/password · 403 no `physical_count.mobile` permission, or card not one of the user's branches · 404 card not found.

## GET /api/mobile/count/products[?since=ISO]
Blind: **no quantities, no prices**.
```json
{ "serverTime": "ISO", "products": [
  { "variationId": 11, "productId": 5, "name": "Mouse Logitech M90",
    "variationName": "DUMMY", "sku": "100234", "subSku": null } ] }
```
`since` returns only products changed after that time (for refresh). Without it, the full list.

## GET /api/mobile/count/sessions/current
The active session (open / submitted / sent_back) at the token's branch, or `null`.
```json
{ "session": {
  "id": 12, "status": "open", "sendBackNote": null,
  "startedByName": "Ana R.", "startedAt": "ISO", "lineCount": 318,
  "counters": [ { "userId": 7, "name": "Juan D.", "done": false } ],
  "joined": true, "myDone": false } }
```

## POST /api/mobile/count/sessions
Starts a session at the token's branch and joins the caller. 200 `{ "session": {…same shape…} }`.
409 `{ "error": "…", "sessionId": 12 }` if the branch already has an active session.

## POST /api/mobile/count/sessions/:id/join → `{ "session": {…} }`
Allowed when status is `open` or `sent_back` (joining a sent-back session reopens it as `open`).

## POST /api/mobile/count/sessions/:id/done → `{ "session": {…} }`
Caller marks their part finished. The app calls this only after its upload queue is empty.
Any later sync from that user clears `done` again.

## POST /api/mobile/count/sessions/:id/submit → `{ "session": {…} }`
Needs every joined counter `done`. 409 otherwise, with the names still counting.

## GET /api/mobile/count/sessions/:id/lines
All non-deleted lines and unknown items of the session (all counters), for running totals and recovery. Blind (no system qty).
```json
{ "lines": [ { "id": "uuid", "variationId": 11, "qty": 5, "spot": "Shelf A",
               "countedByName": "Juan D.", "countedAt": "ISO" } ],
  "unknownItems": [ { "id": "uuid", "scannedCode": "4800…", "description": "Black USB hub",
                      "qty": 3, "countedByName": "Juan D.", "countedAt": "ISO" } ] }
```

## POST /api/mobile/count/sync
Uploads the phone queue. Idempotent: lines/unknown items are keyed by the phone UUID.
Re-sending the same id with a new qty = edit. `deleted: true` = delete.
```json
{ "sessionId": 12, "deviceNow": "ISO (phone clock at send time)",
  "lines": [ { "id": "uuid", "variationId": 11, "qty": 12, "spot": "Stockroom",
               "countedAt": "ISO (phone clock)", "deleted": false } ],
  "unknownItems": [ { "id": "uuid", "scannedCode": null, "description": "…", "qty": 3,
                      "countedAt": "ISO", "deleted": false } ] }
```
Response 200: `{ "accepted": ["uuid", …], "rejected": [ { "id": "uuid", "error": "…" } ] }`
409 if the session is not `open` or the caller has not joined it (whole batch rejected; app keeps the queue).
Limits: max 500 lines + 500 unknown items per request; qty 0–1,000,000, up to 4 decimals.
