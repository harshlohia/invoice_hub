import type { Invoice } from '@/lib/types';

// PDF Configuration Types
export interface PDFConfig {
  pageSize: 'a4' | 'letter';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  fonts: {
    primary: string;
    secondary: string;
  };
  colors: PDFColorScheme;
}

export interface PDFColorScheme {
  primary: [number, number, number];
  accent: [number, number, number];
  text: [number, number, number];
  mutedText: [number, number, number];
  lightGray: [number, number, number];
  mediumGray: [number, number, number];
  white: [number, number, number];
  border: [number, number, number];
  tableHeader: [number, number, number];
  tableAlt: [number, number, number];
}

export interface PDFDimensions {
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  contentHeight: number;
}

export interface PDFPosition {
  x: number;
  y: number;
}

export interface PDFTextOptions {
  fontSize?: number;
  fontStyle?: 'normal' | 'bold' | 'italic';
  align?: 'left' | 'center' | 'right';
  color?: [number, number, number];
  maxWidth?: number;
  lineHeight?: number;
}

export interface PDFTableColumn {
  key: string;
  header: string;
  width: number;
  align: 'left' | 'center' | 'right';
}

export interface PDFSection {
  name: string;
  height: number;
  render: (generator: any, invoice: Invoice, position: PDFPosition) => PDFPosition;
}

// Template System Types
export interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  config: PDFConfig;
  sections: PDFSection[];
}

export interface TemplateRegistry {
  [templateId: string]: InvoiceTemplate;
}