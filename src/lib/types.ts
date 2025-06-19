import type { Timestamp } from "firebase/firestore";

export interface LineItem {
  id: string; // Can be a locally generated UUID for new items
  productName: string;
  amount: number; // Direct amount instead of rate calculation
  date?: Date; // New field for date column
  // Calculated fields for tax breakdown
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number; // amount + cgst + sgst + igst
  // Hidden fields for compatibility
  quantity: number; // Always 1
  rate: number; // Same as amount
  discountPercentage: number; // Always 0
  taxRate: number; // From client configuration
}

export interface Client {
  id: string; // Firestore document ID
  userId?: string; // UID of the user who owns this client
  name: string;
  gstin?: string;
  email?: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string; // Default to India
  defaultTaxRate: number; // Default GST rate for this client (5, 12, 18, 28)
  // createdAt?: Timestamp; 
  // updatedAt?: Timestamp; 
}

export interface BillerInfo {
  businessName: string;
  gstin: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string; // Default to India
  phone?: string;
  email?: string; // This is business email
  logoUrl?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
}

export interface Invoice {
  id?: string; // Firestore document ID, optional before save
  userId: string; // ID of the user who created the invoice
  invoiceNumber: string;
  invoiceDate: Date | Timestamp; 
  dueDate: Date | Timestamp; 
  billerInfo: BillerInfo; // Snapshot of biller info at time of creation
  client: Client; // Snapshot of client info or just client ID to refetch - for simplicity, let's start with a snapshot
  shippingAddress?: Partial<Client>; 
  lineItems: LineItem[];
  notes?: string;
  termsAndConditions?: string;
  subTotal: number; 
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  grandTotal: number; 
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  isInterState: boolean; 
  currency?: string; // Added currency field
  templateId?: string; // Reference to template used
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// State-based tax configuration
export interface StateTaxConfig {
  state: string;
  stateCode: string;
  taxType: 'CGST_SGST' | 'IGST';
  description: string;
}

export const STATE_TAX_CONFIG: StateTaxConfig[] = [
  // States with CGST + SGST (Intra-state)
  { state: "Andhra Pradesh", stateCode: "AP", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Arunachal Pradesh", stateCode: "AR", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Assam", stateCode: "AS", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Bihar", stateCode: "BR", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Chhattisgarh", stateCode: "CG", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Goa", stateCode: "GA", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Gujarat", stateCode: "GJ", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Haryana", stateCode: "HR", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Himachal Pradesh", stateCode: "HP", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Jharkhand", stateCode: "JH", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Karnataka", stateCode: "KA", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Kerala", stateCode: "KL", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Madhya Pradesh", stateCode: "MP", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Maharashtra", stateCode: "MH", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Manipur", stateCode: "MN", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Meghalaya", stateCode: "ML", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Mizoram", stateCode: "MZ", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Nagaland", stateCode: "NL", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Odisha", stateCode: "OR", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Punjab", stateCode: "PB", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Rajasthan", stateCode: "RJ", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Sikkim", stateCode: "SK", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Tamil Nadu", stateCode: "TN", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Telangana", stateCode: "TS", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Tripura", stateCode: "TR", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Uttar Pradesh", stateCode: "UP", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Uttarakhand", stateCode: "UK", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "West Bengal", stateCode: "WB", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Delhi", stateCode: "DL", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  
  // Union Territories
  { state: "Andaman and Nicobar Islands", stateCode: "AN", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Chandigarh", stateCode: "CH", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Dadra and Nagar Haveli and Daman and Diu", stateCode: "DN", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Jammu and Kashmir", stateCode: "JK", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Ladakh", stateCode: "LA", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Lakshadweep", stateCode: "LD", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
  { state: "Puducherry", stateCode: "PY", taxType: "CGST_SGST", description: "CGST + SGST for intra-state, IGST for inter-state" },
];

// Helper function to get tax configuration for a state
export function getStateTaxConfig(state: string): StateTaxConfig | null {
  return STATE_TAX_CONFIG.find(config => config.state === state) || null;
}

// Helper function to determine if transaction is inter-state
export function isInterStateTax(billerState: string, clientState: string): boolean {
  return billerState !== clientState;
}

// Template System Types
export interface TemplateColumn {
  id: string;
  label: string;
  field: string; // Maps to invoice data field
  width: number; // Percentage or fixed width
  align: 'left' | 'center' | 'right';
  visible: boolean;
  format?: 'text' | 'number' | 'currency' | 'percentage' | 'date';
}

export interface TemplateSection {
  id: string;
  type: 'header' | 'billerInfo' | 'clientInfo' | 'lineItems' | 'totals' | 'notes' | 'terms' | 'payment' | 'footer';
  title?: string;
  visible: boolean;
  position: number; // Order of sections
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  padding?: number;
  margin?: number;
  columns?: TemplateColumn[]; // For line items table
  fields?: string[]; // Which fields to show in this section
}

export interface TemplateStyle {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  logoPosition: 'left' | 'center' | 'right';
  logoSize: 'small' | 'medium' | 'large';
  borderStyle: 'none' | 'minimal' | 'full';
  spacing: 'compact' | 'normal' | 'spacious';
}

export interface InvoiceTemplate {
  id?: string; // Firestore document ID
  userId?: string; // null for public templates
  name: string;
  description?: string;
  isPublic: boolean; // Public templates can be used by anyone
  isDefault?: boolean; // User's default template
  sections: TemplateSection[];
  style: TemplateStyle;
  previewImageUrl?: string;
  usageCount?: number; // Track how many times it's been used
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Default template configurations - Updated to match the simplified design
export const DEFAULT_TEMPLATE_COLUMNS: TemplateColumn[] = [
  { id: 'sno', label: '#', field: 'index', width: 8, align: 'left', visible: true, format: 'text' },
  { id: 'date', label: 'Date', field: 'date', width: 15, align: 'left', visible: true, format: 'date' },
  { id: 'item', label: 'Item/Service', field: 'productName', width: 62, align: 'left', visible: true, format: 'text' },
  { id: 'amount', label: 'Amount (Rs.)', field: 'amount', width: 15, align: 'right', visible: true, format: 'currency' },
];

export const DEFAULT_TEMPLATE_SECTIONS: TemplateSection[] = [
  {
    id: 'header',
    type: 'header',
    title: 'Invoice Header',
    visible: true,
    position: 1,
    backgroundColor: 'transparent',
    textColor: '#212529',
    fontSize: 16,
    fontWeight: 'bold',
    padding: 0,
    margin: 0,
    fields: ['invoiceNumber', 'invoiceDate', 'dueDate', 'status']
  },
  {
    id: 'billerInfo',
    type: 'billerInfo',
    title: 'Biller Information',
    visible: true,
    position: 2,
    backgroundColor: 'transparent',
    textColor: '#3F51B5',
    fontSize: 14,
    fontWeight: 'bold',
    padding: 0,
    margin: 20,
    fields: ['businessName', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'gstin']
  },
  {
    id: 'clientInfo',
    type: 'clientInfo',
    title: 'Bill To',
    visible: true,
    position: 3,
    backgroundColor: 'transparent',
    textColor: '#3F51B5',
    fontSize: 12,
    fontWeight: 'bold',
    padding: 0,
    margin: 20,
    fields: ['name', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'gstin']
  },
  {
    id: 'lineItems',
    type: 'lineItems',
    title: 'Items',
    visible: true,
    position: 4,
    backgroundColor: 'transparent',
    textColor: '#212529',
    fontSize: 10,
    fontWeight: 'normal',
    padding: 0,
    margin: 20,
    columns: DEFAULT_TEMPLATE_COLUMNS
  },
  {
    id: 'totals',
    type: 'totals',
    title: 'Totals',
    visible: true,
    position: 5,
    backgroundColor: 'transparent',
    textColor: '#212529',
    fontSize: 11,
    fontWeight: 'normal',
    padding: 0,
    margin: 20,
    fields: ['subTotal', 'totalCGST', 'totalSGST', 'totalIGST', 'grandTotal']
  },
  {
    id: 'terms',
    type: 'terms',
    title: 'Terms & Conditions',
    visible: true,
    position: 6,
    backgroundColor: 'transparent',
    textColor: '#212529',
    fontSize: 10,
    fontWeight: 'normal',
    padding: 0,
    margin: 20,
    fields: ['termsAndConditions']
  },
  {
    id: 'payment',
    type: 'payment',
    title: 'Payment Information',
    visible: true,
    position: 7,
    backgroundColor: 'transparent',
    textColor: '#212529',
    fontSize: 10,
    fontWeight: 'normal',
    padding: 0,
    margin: 20,
    fields: ['bankName', 'accountNumber', 'ifscCode', 'upiId']
  }
];

export const DEFAULT_TEMPLATE_STYLE: TemplateStyle = {
  primaryColor: '#3F51B5',
  secondaryColor: '#f8f9fa',
  backgroundColor: '#ffffff',
  textColor: '#212529',
  fontFamily: 'Helvetica',
  fontSize: 10,
  logoPosition: 'left',
  logoSize: 'medium',
  borderStyle: 'none',
  spacing: 'normal'
};

// Quotation Types
export interface QuotationItem {
  id: string;
  type: 'text' | 'image' | 'number' | 'date' | 'amount' | 'tax';
  label: string;
  value: string | number | Date;
  width: number; // Column width percentage
  order: number; // Display order
}

export interface QuotationRow {
  id: string;
  items: QuotationItem[];
  order: number;
}

export interface Quotation {
  id?: string;
  userId: string;
  quotationNumber: string;
  quotationDate: Date | Timestamp;
  validUntil: Date | Timestamp;
  billerInfo: BillerInfo;
  client: Client;
  title: string;
  description?: string;
  rows: QuotationRow[];
  notes?: string;
  termsAndConditions?: string;
  subTotal: number;
  totalTax: number;
  grandTotal: number;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
  currency?: string;
  templateId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// Mock data for Biller (used as a fallback if settings not found, or for structure reference)
// Ideally, InvoiceForm should always fetch this from user settings.
export const mockBiller: BillerInfo = {
  businessName: "Default Business Name",
  gstin: "00AAAAA0000A0Z0",
  addressLine1: "Default Address Line 1",
  city: "Default City",
  state: "Default State",
  postalCode: "000000",
  country: "India",
  phone: "000-000-0000",
  email: "default@example.com",
  bankName: "Default Bank",
  accountNumber: "000000000000",
  ifscCode: "DEFB0000000",
  upiId: "default@upi"
};

// tempMockClients removed as clients are fetched from Firestore.
// mockInvoices removed as invoices will be fetched from Firestore.