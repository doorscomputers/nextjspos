import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * API endpoint to provide Kendo UI license to client-side
 * GET /api/kendo-license
 *
 * Supports two methods:
 * 1. Environment variable: KENDO_UI_LICENSE
 * 2. License file: kendo-license.txt in project root
 */
export async function GET() {
  try {
    // Try environment variable first
    const envLicense = process.env.KENDO_UI_LICENSE;
    if (envLicense && envLicense.trim()) {
      return NextResponse.json({ license: envLicense.trim() });
    }

    // Try file-based license
    const licensePath = path.join(process.cwd(), 'kendo-license.txt');
    if (fs.existsSync(licensePath)) {
      const licenseKey = fs.readFileSync(licensePath, 'utf-8').trim();

      if (licenseKey) {
        return NextResponse.json({ license: licenseKey });
      }
    }

    return NextResponse.json(
      { error: 'License not found. Add KENDO_UI_LICENSE to .env or create kendo-license.txt' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error reading Kendo license:', error);
    return NextResponse.json(
      { error: 'Failed to load license' },
      { status: 500 }
    );
  }
}
