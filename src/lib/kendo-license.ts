/**
 * Kendo UI License Management
 *
 * Two ways to activate license:
 * 1. Environment variable: Set KENDO_UI_LICENSE in .env file
 * 2. License file: Create kendo-license.txt in project root
 */

/**
 * Initialize Kendo UI license (server-side only)
 * Place your Kendo UI license key in .env as KENDO_UI_LICENSE
 * OR create a kendo-license.txt file in project root
 */
export function initializeKendoLicense() {
  if (typeof window !== 'undefined') return true;

  try {
    // Try environment variable first
    const envLicense = process.env.KENDO_UI_LICENSE;
    if (envLicense) {
      // License will be set via client-side component
      console.log('✓ Kendo UI license found in environment');
      return true;
    }

    // Try file-based license
    try {
      const fs = require('fs');
      const path = require('path');
      const licensePath = path.join(process.cwd(), 'kendo-license.txt');

      if (fs.existsSync(licensePath)) {
        const licenseKey = fs.readFileSync(licensePath, 'utf-8').trim();
        if (licenseKey) {
          console.log('✓ Kendo UI license found in kendo-license.txt');
          return true;
        }
      }
    } catch (fileError) {
      // File operations might fail in some environments
    }

    console.warn('⚠ No Kendo UI license found');
    console.warn('  Add KENDO_UI_LICENSE to .env OR create kendo-license.txt');
    return false;
  } catch (error) {
    console.error('✗ Error loading Kendo UI license:', error);
    return false;
  }
}

/**
 * Client-side license initialization
 * Fetches license from API endpoint
 */
export function initializeKendoLicenseClient() {
  if (typeof window === 'undefined') return;

  // Fetch license from API endpoint
  fetch('/api/kendo-license')
    .then(res => {
      if (!res.ok) throw new Error('License not found');
      return res.json();
    })
    .then(data => {
      if (data.license) {
        // Dynamically import and set license key
        import('@progress/kendo-licensing').then(({ setScriptKey }) => {
          setScriptKey(data.license);
          console.log('✓ Kendo UI license activated');
        });
      }
    })
    .catch(() => {
      console.warn('⚠ Kendo UI license not activated - components will show trial watermark');
      console.warn('  To activate: add license to .env or create kendo-license.txt');
    });
}
