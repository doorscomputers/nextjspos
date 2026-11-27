// One place for every colour and size used by the app.
// The app uses a fixed LIGHT theme (app.json "userInterfaceStyle": "light") so
// contrast is always the same on every phone, also in bright warehouses.
export const colors = {
  brand: '#0f766e', // teal header bars
  brandDark: '#115e59',
  brandSoft: '#ccfbf1',
  page: '#f0fdfa', // soft tinted page background
  card: '#ffffff',
  border: '#cbd5e1',
  text: '#0f172a',
  textMuted: '#475569',
  onBrand: '#ffffff',
  primary: '#16a34a', // green primary buttons
  primaryDark: '#15803d',
  secondary: '#2563eb', // blue outline buttons
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  dangerText: '#991b1b',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  warningText: '#78350f',
  successSoft: '#dcfce7',
  successText: '#14532d',
  infoSoft: '#dbeafe',
  infoText: '#1e3a8a',
  disabled: '#94a3b8',
};

export const font = {
  small: 15,
  body: 17,
  large: 20,
  title: 22,
  huge: 64,
};

export const radius = 12;
export const tap = 52; // minimum tap target height (>= 48dp)
