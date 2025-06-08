
export interface LineItem {
  id: string;
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
  // createdAt?: any; // For Firestore Timestamp, handle during operations
  // updatedAt?: any; 
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
  email?: string;
  logoUrl?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date; // Will be Firestore Timestamp
  dueDate: Date; // Will be Firestore Timestamp
  billerInfo: BillerInfo;
  client: Client; // Store client snapshot or just ID
  shippingAddress?: Client; 
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
  // userId?: string; // For multi-user apps
  // createdAt?: any;
  // updatedAt?: any;
}

// Mock data for Biller (will be moved to settings later)
export const mockBiller: BillerInfo = {
  businessName: "My Awesome Company Pvt Ltd",
  gstin: "29ABCDE1234F1Z5",
  addressLine1: "789 Main Road, Koramangala",
  city: "Bengaluru",
  state: "Karnataka",
  postalCode: "560034",
  country: "India",
  phone: "080-12345678",
  email: "accounts@myawesomecompany.com",
  bankName: "Awesome Bank",
  accountNumber: "123456789012",
  ifscCode: "AWSM0001234",
  upiId: "myawesomecompany@upi"
};


// Mock data for Invoices (will be replaced by Firestore later)
const tempMockClients: Client[] = [
   {
    id: 'client-1',
    name: 'Acme Corp (Sample)',
    gstin: '29AAAAA0000A1Z5',
    email: 'contact@acme.com',
    phone: '9876543210',
    addressLine1: '123 Business St',
    city: 'Bangalore',
    state: 'Karnataka',
    postalCode: '560001',
    country: 'India',
  },
  {
    id: 'client-2',
    name: 'Innovate Hub (Sample)',
    gstin: '27BBBBB0000B1Z5',
    email: 'hello@innovate.co',
    phone: '8765432109',
    addressLine1: '456 Tech Park',
    city: 'Mumbai',
    state: 'Maharashtra',
    postalCode: '400001',
    country: 'India',
  },
];

export const mockInvoices: Invoice[] = [
  {
    id: 'inv-1',
    invoiceNumber: 'INV001',
    invoiceDate: new Date('2023-10-01'),
    dueDate: new Date('2023-10-15'),
    billerInfo: mockBiller,
    client: tempMockClients[0],
    isInterState: false,
    lineItems: [
      { id: 'item-1', productName: 'Web Development', quantity: 1, rate: 50000, discountPercentage: 10, taxRate: 18, amount: 45000, cgst: 4050, sgst: 4050, igst: 0, totalAmount: 53100 },
      { id: 'item-2', productName: 'Hosting Services', quantity: 12, rate: 1000, discountPercentage: 0, taxRate: 18, amount: 12000, cgst: 1080, sgst: 1080, igst: 0, totalAmount: 14160 },
    ],
    subTotal: 57000,
    totalCGST: 5130,
    totalSGST: 5130,
    totalIGST: 0,
    grandTotal: 67260,
    status: 'paid',
    termsAndConditions: 'Payment due within 15 days. Late fee of 2% per month.',
  },
  {
    id: 'inv-2',
    invoiceNumber: 'INV002',
    invoiceDate: new Date('2023-10-05'),
    dueDate: new Date('2023-10-20'),
    billerInfo: mockBiller,
    client: tempMockClients[1],
    isInterState: true, // Example of inter-state
    lineItems: [
      { id: 'item-3', productName: 'Consulting Services', quantity: 20, rate: 2500, discountPercentage: 0, taxRate: 18, amount: 50000, cgst: 0, sgst: 0, igst: 9000, totalAmount: 59000 },
    ],
    subTotal: 50000,
    totalCGST: 0,
    totalSGST: 0,
    totalIGST: 9000,
    grandTotal: 59000,
    status: 'sent',
    notes: 'Thank you for your business!',
  },
];
