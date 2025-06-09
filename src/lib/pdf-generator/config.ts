import type { PDFConfig, PDFColorScheme } from './types';

// Default color scheme matching your web design exactly
export const DEFAULT_COLORS: PDFColorScheme = {
  primary: [63, 81, 181],        // #3F51B5 - Your app's primary blue
  accent: [255, 152, 0],         // #FF9800 - Your app's accent orange
  text: [33, 33, 33],            // #212121 - Dark text
  mutedText: [107, 114, 126],    // #6B7280 - Muted text
  lightGray: [248, 250, 252],    // #F8FAFC - Very light background
  mediumGray: [158, 158, 158],   // #9E9E9E - Medium gray
  white: [255, 255, 255],        // #FFFFFF - White
  border: [229, 231, 235],       // #E5E7EB - Light border
  tableHeader: [248, 250, 252],  // #F8FAFC - Table header (light gray, NOT blue)
  tableAlt: [249, 250, 251],     // #F9FAFB - Alternating table rows
};

// Default PDF configuration
export const DEFAULT_PDF_CONFIG: PDFConfig = {
  pageSize: 'a4',
  orientation: 'portrait',
  margins: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  },
  fonts: {
    primary: 'helvetica',
    secondary: 'helvetica',
  },
  colors: DEFAULT_COLORS,
};

// Font sizes following design system
export const FONT_SIZES = {
  title: 24,
  heading: 16,
  subheading: 12,
  body: 10,
  small: 9,
  tiny: 8,
} as const;

// Spacing system (8px base)
export const SPACING = {
  xs: 2,   // 2mm
  sm: 4,   // 4mm
  md: 6,   // 6mm
  lg: 8,   // 8mm
  xl: 12,  // 12mm
  xxl: 16, // 16mm
} as const;

// Layout constants
export const LAYOUT = {
  headerHeight: 50,
  logoSize: { width: 35, height: 20 },
  sectionSpacing: SPACING.lg,
  lineHeight: 1.2,
} as const;