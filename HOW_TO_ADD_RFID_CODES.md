# How to Add RFID Codes to Business Locations

## ✅ Setup Complete

All the necessary code changes have been made. Your locations are safe in the database!

## 📍 How to Edit Locations and Add RFID Codes

### Step 1: Access the Locations Page
1. Login to your dashboard
2. Navigate to: **`http://localhost:3000/dashboard/locations`** (or 3003 if port 3000 is in use)
3. You should now see all your locations displayed

### Step 2: Edit a Location
1. Find the location you want to add an RFID code to
2. Click the **pencil/edit icon** (✏️) button in the Actions column
3. The Edit Location dialog will open

### Step 3: Add the RFID Location Code
1. Scroll down in the edit dialog
2. Find the field: **"🏷️ Location RFID Code (10-15 characters)"**
3. Enter your RFID card code (example: `ABC1234567890`)
   - Must be 10-15 alphanumeric characters
   - Will be automatically converted to UPPERCASE
   - Must be unique across all locations
4. Click **"Update Location"** to save

### Step 4: Verify the Code
The system will automatically:
- ✅ Validate the format (10-15 alphanumeric characters)
- ✅ Check for uniqueness (no duplicates allowed)
- ✅ Convert to uppercase for consistency
- ✅ Save to the database

## 🔐 Using RFID Codes for Login

### For Cashiers/Managers:
1. Go to login page
2. Enter username and password
3. **Scan the RFID card** in the "Scan Location RFID Card" field
4. Press Enter (or scanner will auto-submit)
5. System verifies the code
6. Green checkmark appears if valid
7. Click "LOGIN"

### For Admins (Super Admin, System Administrator, All Branch Admin):
1. Go to login page
2. Enter username and password only
3. **Skip the RFID scanning** (admins are exempt)
4. Click "LOGIN"

## 🔒 Using RFID Codes for Shift Closing

When closing a shift, you now have **TWO OPTIONS**:

### Option 1: Manager Password (Traditional)
- Enter the manager's password
- Click "Confirm & Close Shift"

### Option 2: Location RFID Card (New)
1. Click the "Location RFID" tab
2. Scan the location's RFID card
3. Press Enter to verify
4. Green checkmark appears
5. Click "Confirm & Close Shift"

## 📝 Example RFID Codes

Here are some example codes you can use:

- **Main Store**: `MAIN001STORE`
- **Main Warehouse**: `MAIN002WAREH`
- **Bambang Branch**: `BMBG003BRNCH`
- **Tuguegarao Branch**: `TUGG004BRNCH`
- **Santiago Branch**: `SANT005BRNCH`
- **Baguio Branch**: `BAGU006BRNCH`

## ⚠️ Important Notes

1. **RFID Cards Stay at Location**: Each RFID card should physically remain at its respective location
2. **Unique Codes**: Each location must have a unique code
3. **Format**: 10-15 characters, alphanumeric only (A-Z, 0-9)
4. **Case Insensitive**: System converts all codes to uppercase automatically
5. **Admin Exemption**: Super Admins don't need to scan RFID cards

## 🎯 What Changed

✅ Database schema updated (added `locationCode` field)
✅ Location edit form includes RFID code field
✅ API validates and saves RFID codes
✅ Login page uses RFID for location verification
✅ Shift closing accepts RFID as alternative to password
✅ Admin users exempt from RFID scanning

## 🚀 Ready to Use!

Your system is now fully configured for RFID-based location verification.

**Next Steps:**
1. Edit each location and add RFID codes
2. Test login with a cashier account
3. Test shift closing with RFID

Need help? Contact support or check the implementation files.
