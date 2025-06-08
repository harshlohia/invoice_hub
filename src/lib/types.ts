
import type { Timestamp } from "firebase/firestore";

export interface LineItem {
  id: string; // Can be a locally generated UUID for new items
  productName: string;
  quantity: number;
  rate: number;
  discountPercentage: number; // 0-100
  taxRate: number; // GST Rate e.g. 5, 12, 18, 28
  amount: number; // (quantity * rate) * (1 - discountPercentage/100)
  cgst: number;
  sgst: number;
  igst: number;
  totalAmount: number; // amount + cgst + sgst + igst
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

