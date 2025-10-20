// Theme Factory Professional Presets
// 10 professionally designed themes from theme-factory skill

export interface ThemeFactoryColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  textSecondary: string;
}

export interface ThemeFactoryFonts {
  heading: string;
  body: string;
}

export interface ThemeFactoryPreset {
  name: string;
  slug: string;
  description: string;
  colors: ThemeFactoryColors;
  fonts: ThemeFactoryFonts;
  hsl?: {
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    muted: string;
    mutedForeground: string;
    border: string;
    input: string;
    ring: string;
  };
}

/**
 * Convert hex color to HSL format used by Tailwind
 * Returns format like "221 83% 53%"
 */
export function hexToHSL(hex: string): string {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  const lPercent = Math.round(l * 100);

  return `${h} ${s}% ${lPercent}%`;
}

export const themeFactoryPresets: Record<string, ThemeFactoryPreset> = {
  oceanDepths: {
    name: 'Ocean Depths',
    slug: 'ocean-depths',
    description: 'Professional and calming maritime theme',
    colors: {
      primary: '#1a2332',
      secondary: '#2d8b8b',
      accent: '#a8dadc',
      background: '#f1faee',
      text: '#1a2332',
      textSecondary: '#2d8b8b',
    },
    fonts: {
      heading: '"Inter", "Helvetica Neue", Arial, sans-serif',
      body: '"Inter", "Helvetica Neue", Arial, sans-serif',
    },
  },
  sunsetBoulevard: {
    name: 'Sunset Boulevard',
    slug: 'sunset-boulevard',
    description: 'Warm and vibrant sunset colors',
    colors: {
      primary: '#e76f51',
      secondary: '#f4a261',
      accent: '#e9c46a',
      background: '#ffffff',
      text: '#264653',
      textSecondary: '#e76f51',
    },
    fonts: {
      heading: '"Georgia", serif',
      body: '"Inter", "Helvetica Neue", Arial, sans-serif',
    },
  },
  forestCanopy: {
    name: 'Forest Canopy',
    slug: 'forest-canopy',
    description: 'Natural and grounded earth tones',
    colors: {
      primary: '#2d4a2b',
      secondary: '#7d8471',
      accent: '#a4ac86',
      background: '#faf9f6',
      text: '#2d4a2b',
      textSecondary: '#7d8471',
    },
    fonts: {
      heading: '"Georgia", serif',
      body: '"Inter", "Helvetica Neue", Arial, sans-serif',
    },
  },
  modernMinimalist: {
    name: 'Modern Minimalist',
    slug: 'modern-minimalist',
    description: 'Clean and contemporary grayscale',
    colors: {
      primary: '#36454f',
      secondary: '#708090',
      accent: '#d3d3d3',
      background: '#ffffff',
      text: '#36454f',
      textSecondary: '#708090',
    },
    fonts: {
      heading: '"Inter", "Helvetica Neue", Arial, sans-serif',
      body: '"Inter", "Helvetica Neue", Arial, sans-serif',
    },
  },
  goldenHour: {
    name: 'Golden Hour',
    slug: 'golden-hour',
    description: 'Rich and warm autumnal palette',
    colors: {
      primary: '#f4a900',
      secondary: '#c1666b',
      accent: '#d4b896',
      background: '#ffffff',
      text: '#4a403a',
      textSecondary: '#c1666b',
    },
    fonts: {
      heading: '"Inter", "Helvetica Neue", Arial, sans-serif',
      body: '"Inter", "Helvetica Neue", Arial, sans-serif',
    },
  },
  arcticFrost: {
    name: 'Arctic Frost',
    slug: 'arctic-frost',
    description: 'Cool and crisp winter-inspired theme',
    colors: {
      primary: '#4a6fa5',
      secondary: '#d4e4f7',
      accent: '#c0c0c0',
      background: '#fafafa',
      text: '#4a6fa5',
      textSecondary: '#4a6fa5',
    },
    fonts: {
      heading: '"Inter", "Helvetica Neue", Arial, sans-serif',
      body: '"Inter", "Helvetica Neue", Arial, sans-serif',
    },
  },
  desertRose: {
    name: 'Desert Rose',
    slug: 'desert-rose',
    description: 'Soft and sophisticated dusty tones',
    colors: {
      primary: '#d4a5a5',
      secondary: '#b87d6d',
      accent: '#e8d5c4',
      background: '#ffffff',
      text: '#5d2e46',
      textSecondary: '#b87d6d',
    },
    fonts: {
      heading: '"Inter", "Helvetica Neue", Arial, sans-serif',
      body: '"Inter", "Helvetica Neue", Arial, sans-serif',
    },
  },
  techInnovation: {
    name: 'Tech Innovation',
    slug: 'tech-innovation',
    description: 'Bold and modern tech aesthetic',
    colors: {
      primary: '#0066ff',
      secondary: '#00ffff',
      accent: '#1e1e1e',
      background: '#ffffff',
      text: '#1e1e1e',
      textSecondary: '#0066ff',
    },
    fonts: {
      heading: '"Inter", "Helvetica Neue", Arial, sans-serif',
      body: '"Inter", "Helvetica Neue", Arial, sans-serif',
    },
  },
  botanicalGarden: {
    name: 'Botanical Garden',
    slug: 'botanical-garden',
    description: 'Fresh and organic garden colors',
    colors: {
      primary: '#4a7c59',
      secondary: '#f9a620',
      accent: '#b7472a',
      background: '#f5f3ed',
      text: '#4a7c59',
      textSecondary: '#b7472a',
    },
    fonts: {
      heading: '"Georgia", serif',
      body: '"Inter", "Helvetica Neue", Arial, sans-serif',
    },
  },
  midnightGalaxy: {
    name: 'Midnight Galaxy',
    slug: 'midnight-galaxy',
    description: 'Dramatic and cosmic deep tones',
    colors: {
      primary: '#2b1e3e',
      secondary: '#4a4e8f',
      accent: '#a490c2',
      background: '#ffffff',
      text: '#2b1e3e',
      textSecondary: '#4a4e8f',
    },
    fonts: {
      heading: '"Inter", "Helvetica Neue", Arial, sans-serif',
      body: '"Inter", "Helvetica Neue", Arial, sans-serif',
    },
  },
};

export const themeFactoryList = Object.entries(themeFactoryPresets).map(([key, theme]) => ({
  ...theme,
  key // Add the object key for lookups
}));

// Helper to get theme by slug
export function getThemeBySlug(slug: string): ThemeFactoryPreset | undefined {
  return Object.values(themeFactoryPresets).find(theme => theme.slug === slug);
}

// Helper to get theme key by slug
export function getThemeKeyBySlug(slug: string): string | undefined {
  const entry = Object.entries(themeFactoryPresets).find(([_, theme]) => theme.slug === slug);
  return entry?.[0];
}
