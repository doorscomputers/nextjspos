# PCINET Inventory Count App — Android app

A phone app for **physical stock counting** (blind count). Staff log in, scan the
branch **location card**, then scan items and type the quantity. Counts save on the
phone first and upload by themselves when there is signal. An approver checks the
count on the web (Inventory → Physical Count Sessions) and posts the differences.

The phone never changes stock and never shows system quantities.

---

## 1. Install (one time, on your PC)

1. Install **Node.js 20 or newer** (https://nodejs.org). Check in a terminal: `node -v`
2. Open a terminal in this folder:
   ```
   cd C:\xampp\htdocs\ultimatepos-modern\mobile
   npm install
   ```

## 2. Set the server address

The app talks to the same web app you already use (for example
`https://your-app.vercel.app`).

- **Easy way (no rebuild):** on the phone's login screen tap **▸ Server settings**
  and type the address. It is saved on the phone.
- **Default for every new phone:** open `mobile/app.json`, find
  `"apiBaseUrl": "https://CHANGE-ME.vercel.app"` and replace it with your real
  address, then build the APK again (step 4).

Use `https://`. (A plain `http://` address only works in Expo Go testing.)

## 3. Test on a phone with Expo Go (no build needed)

1. On the Android phone install **Expo Go** from the Play Store.
2. Phone and PC on the **same Wi-Fi**.
3. On the PC: `npx expo start`
4. A QR code appears in the terminal. In Expo Go tap **Scan QR code** and scan it.
5. The app opens. The camera barcode scanner works inside Expo Go.

If the phone cannot connect, try `npx expo start --tunnel`.

## 4. Build the installable APK

You need a free Expo account (https://expo.dev/signup).

```
npx eas-cli login
npx eas-cli build -p android --profile preview
```

- The first time it asks to create a project and an Android signing key: answer **Yes**.
- The build runs on Expo's servers (about 10–20 minutes). At the end it prints a
  **link / QR code** to download the `.apk`.
- The `production` profile also makes an APK (we do not use the Play Store).

## 5. Install the APK on the phone

1. Open the download link on the phone (or copy the `.apk` to the phone).
2. Tap the file. Android asks to **allow installing unknown apps** for your browser /
   file manager → **Settings → Allow from this source** → go back → **Install**.
3. Open **PCINET Inventory Count App**. Allow the camera when asked (optional — typing and
   hardware scanners work without it).

To update later: build again and install the new APK over the old one. Counts saved
on the phone are kept.

## 6. Hardware barcode scanners

The scan boxes in the app work like a keyboard: the scanner "types" the code and
presses **Enter**. The on-screen keyboard stays hidden so it does not cover the
screen; tap **⌨** to show it when you want to type a code by hand.

### Bluetooth pocket scanner
1. Put the scanner in **HID / Keyboard mode** (scan the "HID" barcode in its manual).
2. Phone: **Settings → Bluetooth → Pair new device** → pick the scanner.
3. Set the scanner **suffix to Enter / CR** (scan the "Add CR suffix" or "Enter"
   barcode in the manual).
4. Test: open Notes on the phone, scan — the code should appear and jump to a new line.

### Zebra devices (DataWedge)
1. Open **DataWedge** → the profile for this app (or **Profile0 (default)**).
2. **Keystroke output: ON**. **Intent output: OFF**.
3. Keystroke output → **Basic data formatting → Send ENTER key: ON**.

### Honeywell devices
1. **Settings → Scan Settings → Internal Scanner → Default profile**.
2. **Data Processing Settings → Wedge Method: Keyboard (Standard)**.
3. **Suffix: `\n`** (or "Enter").

---

## How counting works (for staff)

1. **Log in**: username, password, then scan the **branch location card**.
2. **Start new count** (or **Join** if a teammate already started one).
3. Scan an item → type the quantity (and the spot, e.g. "Shelf A") → **Next**.
4. Check the **big number** on the Confirm pop-up → **Confirm** (scanner Enter = Confirm).
   The same item can be counted in several spots: the app adds them up
   ("Total now 17 (5 + 12)").
5. Barcode not found? Search by name / SKU, or **Log as unknown item**.
6. Tap an item in the list to see, edit or delete its lines.
7. When finished and the badge shows **✓ All uploaded**, tap **I'm done**.
8. When every counter is done, anyone can tap **Submit for Approval**.

No signal? Keep counting. The badge shows **⏳ N waiting to upload**; they upload
by themselves when the signal returns. Login expired? The app asks only for the
password; nothing is lost.

## For developers

- Expo SDK 58, TypeScript. Type-check: `npm run typecheck` · Health check: `npx expo-doctor`
- Server API contract: `docs/superpowers/specs/2026-11-27-mobile-count-api.md`
- Code: `App.tsx` (screen switcher + upload loop lifecycle), `src/api.ts`,
  `src/db.ts` (SQLite queue), `src/sync.ts` (upload loop), `src/screens/*`.
