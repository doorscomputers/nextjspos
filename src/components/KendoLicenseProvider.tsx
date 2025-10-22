'use client';

import { useEffect } from 'react';
import { initializeKendoLicenseClient } from '@/lib/kendo-license';

/**
 * Client-side component to initialize Kendo UI license
 * This should be included in the root layout
 */
export function KendoLicenseProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initializeKendoLicenseClient();
  }, []);

  return <>{children}</>;
}
