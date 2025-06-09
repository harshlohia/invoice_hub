"use client";
import type { Invoice } from "@/lib/types";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Download, Printer, Send, Edit, Loader2, CheckCircle, AlertCircle, Clock, FilePenLine, MoreVertical, Trash2 as CancelIcon } from "lucide-react";
import { format } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface InvoicePreviewProps {
  invoice: Invoice;
  onStatusChange?: (updatedInvoice: Invoice) => void; 
}

export interface InvoicePreviewHandle {
  downloadPdf: () => Promise<void>;
}

const statusIcons: Record<Invoice['status'], React.ReactElement> = {
  paid: <CheckCircle className="h-4 w-4 text-green-500" />,
  sent: <Send className="h-4 w-4 text-blue-500" />, 
  overdue: <AlertCircle className="h-4 w-4 text-red-500" />,
  draft: <FilePenLine className="h-4 w-4 text-gray-500" />,
  cancelled: <CancelIcon className="h-4 w-4 text-yellow-600" />,
};

export const InvoicePreview = forwardRef<InvoicePreviewHandle, InvoicePreviewProps>(({ invoice: initialInvoice, onStatusChange }, ref) => {
  const invoiceCardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<Invoice>(initialInvoice);

  useEffect(() => {
    setInvoice(initialInvoice); 
  }, [initialInvoice]);

  const handleUpdateStatus = async (newStatus: Invoice['status']) => {
    if (!invoice.id) {
      toast({ title: "Error", description: "Invoice ID is missing.", variant: "destructive" });
      return;
    }
    setIsUpdatingStatus(true);
    try {
      const invoiceRef = doc(db, 'invoices', invoice.id);
      await updateDoc(invoiceRef, {
        status: newStatus,
        updatedAt: serverTimestamp() as Timestamp,
      });
      
      const updatedInvoice = { ...invoice, status: newStatus, updatedAt: new Timestamp(new Date().getTime() / 1000, 0) }; 
      setInvoice(updatedInvoice);
      if (onStatusChange) {
        onStatusChange(updatedInvoice);
      }

      toast({ title: "Status Updated", description: `Invoice marked as ${newStatus}.` });
    } catch (error) {
      console.error("Error updating invoice status:", error);
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoiceCardRef.current) {
      toast({
        title: "Error",
        description: "Invoice content not found for PDF generation.",
        variant: "destructive",
      });
      return;
    }
    setIsDownloading(true);

    try {
      const elementToCapture = invoiceCardRef.current;
      
      // Wait for all images to load
      const images = elementToCapture.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));

      // Create PDF with proper A4 dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10; // 10mm margin
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2);

      // Calculate how many line items can fit per page
      const headerHeight = 80; // Approximate height for header section in mm
      const footerHeight = 60; // Approximate height for totals and footer in mm
      const lineItemHeight = 8; // Height per line item row in mm
      const maxLineItemsPerPage = Math.floor((availableHeight - headerHeight - footerHeight) / lineItemHeight);
      
      const totalLineItems = invoice.lineItems.length;
      const totalPages = Math.ceil(totalLineItems / maxLineItemsPerPage);

      // Generate each page
      for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
        if (pageIndex > 0) {
          pdf.addPage();
        }

        // Calculate line items for this page
        const startIndex = pageIndex * maxLineItemsPerPage;
        const endIndex = Math.min(startIndex + maxLineItemsPerPage, totalLineItems);
        const pageLineItems = invoice.lineItems.slice(startIndex, endIndex);
        
        // Create a temporary container for this page's content
        const pageContainer = document.createElement('div');
        pageContainer.style.backgroundColor = '#ffffff';
        pageContainer.style.fontFamily = 'Arial, sans-serif';
        pageContainer.style.fontSize = '14px';
        pageContainer.style.lineHeight = '1.5';
        pageContainer.style.color = '#000000';
        pageContainer.style.width = '900px';
        pageContainer.style.padding = '0';
        pageContainer.style.margin = '0';

        // Add content to page container
        pageContainer.innerHTML = `
          ${pageIndex === 0 ? generateHeaderHTML(invoice) : generateContinuationHeaderHTML(invoice, pageIndex + 1)}
          ${generateLineItemsTableHTML(pageLineItems, startIndex, invoice.currency)}
          ${pageIndex === totalPages - 1 ? generateFooterHTML(invoice) : generateContinuationFooterHTML(pageIndex + 1, totalPages)}
        `;

        // Temporarily add to DOM for rendering
        document.body.appendChild(pageContainer);

        try {
          // Create canvas for this page
          const canvas = await html2canvas(pageContainer, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: 900,
            height: Math.min(pageContainer.scrollHeight, 1200) // Limit height per page
          });

          // Convert to image and add to PDF
          const imgData = canvas.toDataURL('image/png', 1.0);
          
          const canvasWidth = canvas.width;
          const canvasHeight = canvas.height;
          
          // Convert pixels to mm
          const pxToMm = 25.4 / 96;
          const imgWidthMm = canvasWidth * pxToMm / 2;
          const imgHeightMm = canvasHeight * pxToMm / 2;
          
          // Scale to fit
          const scaleX = availableWidth / imgWidthMm;
          const scaleY = availableHeight / imgHeightMm;
          const scale = Math.min(scaleX, scaleY, 1);
          
          const finalWidth = imgWidthMm * scale;
          const finalHeight = imgHeightMm * scale;
          
          const x = (pdfWidth - finalWidth) / 2;
          const y = margin;

          pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
          
        } finally {
          // Clean up temporary element
          document.body.removeChild(pageContainer);
        }
      }
      
      // Save the PDF
      pdf.save(`invoice-${invoice.invoiceNumber || 'document'}.pdf`);
      
      toast({
        title: "Success",
        description: `Multi-page invoice ${invoice.invoiceNumber}.pdf downloaded successfully.`,
      });

    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "PDF Generation Failed",
        description: "An error occurred while generating the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  useImperativeHandle(ref, () => ({
    downloadPdf: handleDownloadPdf,
  }));

  const invoiceDate = invoice.invoiceDate instanceof Timestamp ? invoice.invoiceDate.toDate() : new Date(invoice.invoiceDate);
  const dueDate = invoice.dueDate instanceof Timestamp ? invoice.dueDate.toDate() : new Date(invoice.dueDate);
  const currencySymbol = invoice.currency === "INR" ? "Rs." : (invoice.currency || "Rs.");

  return (
    <Card className="max-w-4xl mx-auto shadow-lg">
      <div ref={invoiceCardRef} data-invoice-content style={{
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        lineHeight: '1.5',
        color: '#000000',
        width: '900px',
        maxWidth: 'none'
      }}> 
        <CardHeader style={{
          backgroundColor: '#f8f9fa',
          padding: '24px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '24px',
            width: '100%'
          }}>
            {/* Left side - Company Info */}
            <div style={{ flex: '1', maxWidth: '400px' }}>
              {invoice.billerInfo.logoUrl ? (
                <Image
                  src={invoice.billerInfo.logoUrl}
                  alt={`${invoice.billerInfo.businessName} logo`}
                  width={120}
                  height={60}
                  style={{ 
                    objectFit: 'contain',
                    marginBottom: '12px'
                  }} 
                  data-ai-hint="company logo"
                />
              ) : (
                <div style={{
                  height: '60px',
                  width: '120px',
                  backgroundColor: '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6b7280',
                  marginBottom: '12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  border: '1px solid #d1d5db'
                }} data-ai-hint="logo placeholder">
                  Logo
                </div>
              )}
              <h2 style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#3f51b5',
                marginBottom: '8px',
                margin: '0 0 8px 0'
              }}>{invoice.billerInfo.businessName}</h2>
              <div style={{
                fontSize: '12px',
                color: '#6b7280',
                lineHeight: '1.4'
              }}>
                <p style={{ margin: '2px 0' }}>{invoice.billerInfo.addressLine1}</p>
                {invoice.billerInfo.addressLine2 && <p style={{ margin: '2px 0' }}>{invoice.billerInfo.addressLine2}</p>}
                <p style={{ margin: '2px 0' }}>{invoice.billerInfo.city}, {invoice.billerInfo.state} - {invoice.billerInfo.postalCode}</p>
                {invoice.billerInfo.gstin && (
                  <p style={{
                    fontWeight: '600',
                    color: '#3f51b5',
                    backgroundColor: '#eff6ff',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    marginTop: '6px',
                    display: 'inline-block',
                    border: '1px solid #bfdbfe',
                    margin: '6px 0 0 0'
                  }}>
                    GSTIN: {invoice.billerInfo.gstin}
                  </p>
                )}
              </div>
            </div>

            {/* Right side - Invoice Info */}
            <div style={{ textAlign: 'right', minWidth: '300px' }}>
              <h1 style={{
                fontSize: '32px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                color: '#4b5563',
                marginBottom: '8px',
                margin: '0 0 8px 0'
              }}>Invoice</h1>
              <p style={{
                fontSize: '18px',
                color: '#6b7280',
                marginBottom: '12px',
                margin: '0 0 12px 0'
              }}># {invoice.invoiceNumber}</p>
              
              {/* Status */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
                marginBottom: '12px'
              }}>
                 {statusIcons[invoice.status]}
                <span style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  textTransform: 'capitalize',
                  padding: '4px 8px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '4px'
                }}>{invoice.status}</span>
              </div>
              
              {/* Dates */}
              <div style={{
                borderTop: '1px solid #e5e7eb',
                paddingTop: '12px',
                fontSize: '12px',
                lineHeight: '1.6'
              }}>
                <p style={{ margin: '3px 0' }}>
                  <span style={{ fontWeight: '600', color: '#374151' }}>Date:</span> {format(invoiceDate, "dd MMM, yyyy")}
                </p>
                <p style={{ margin: '3px 0' }}>
                  <span style={{ fontWeight: '600', color: '#374151' }}>Due Date:</span> {format(dueDate, "dd MMM, yyyy")}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent style={{ padding: '24px' }}>
          {/* Bill To Section */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            marginBottom: '24px'
          }}>
            <div>
              <h3 style={{
                fontWeight: 'bold',
                color: '#374151',
                marginBottom: '8px',
                fontSize: '16px',
                borderBottom: '2px solid #e5e7eb',
                paddingBottom: '4px',
                margin: '0 0 8px 0'
              }}>Bill To:</h3>
              <div style={{ lineHeight: '1.5' }}>
                <p style={{
                  fontWeight: '600',
                  color: '#3f51b5',
                  fontSize: '16px',
                  margin: '3px 0'
                }}>{invoice.client.name}</p>
                <p style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  margin: '2px 0'
                }}>{invoice.client.addressLine1}</p>
                {invoice.client.addressLine2 && <p style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  margin: '2px 0'
                }}>{invoice.client.addressLine2}</p>}
                <p style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  margin: '2px 0'
                }}>{invoice.client.city}, {invoice.client.state} - {invoice.client.postalCode}</p>
                {invoice.client.gstin && <p style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#374151',
                  margin: '2px 0'
                }}>GSTIN: {invoice.client.gstin}</p>}
              </div>
            </div>
            {invoice.shippingAddress && (
              <div>
                <h3 style={{
                  fontWeight: 'bold',
                  color: '#374151',
                  marginBottom: '8px',
                  fontSize: '16px',
                  borderBottom: '2px solid #e5e7eb',
                  paddingBottom: '4px',
                  margin: '0 0 8px 0'
                }}>Ship To:</h3>
                <div style={{ lineHeight: '1.5' }}>
                  <p style={{
                    fontWeight: '600',
                    color: '#3f51b5',
                    fontSize: '16px',
                    margin: '3px 0'
                  }}>{invoice.shippingAddress.name}</p>
                  <p style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    margin: '2px 0'
                  }}>{invoice.shippingAddress.addressLine1}</p>
                  {invoice.shippingAddress.addressLine2 && <p style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    margin: '2px 0'
                  }}>{invoice.shippingAddress.addressLine2}</p>}
                  <p style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    margin: '2px 0'
                  }}>{invoice.shippingAddress.city}, {invoice.shippingAddress.state} - {invoice.shippingAddress.postalCode}</p>
                </div>
              </div>
            )}
          </div>

          {/* Line Items Table */}
          <div style={{ marginBottom: '24px', width: '100%' }}>
            <table style={{
              width: '100%',
              fontSize: '11px',
              borderCollapse: 'collapse',
              border: '1px solid #d1d5db'
            }}>
              <thead style={{ backgroundColor: '#f3f4f6' }}>
                <tr>
                  <th style={{
                    padding: '8px 6px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    width: '40px'
                  }}>#</th>
                  <th style={{
                    padding: '8px 6px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    width: '280px'
                  }}>Item/Service</th>
                  <th style={{
                    padding: '8px 6px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    width: '60px'
                  }}>Qty</th>
                  <th style={{
                    padding: '8px 6px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    width: '100px'
                  }}>Rate ({currencySymbol})</th>
                  <th style={{
                    padding: '8px 6px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    width: '80px'
                  }}>Disc (%)</th>
                  <th style={{
                    padding: '8px 6px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    width: '120px'
                  }}>Amount ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #d1d5db' }}>
                    <td style={{
                      padding: '8px 6px',
                      border: '1px solid #d1d5db',
                      textAlign: 'left'
                    }}>{index + 1}</td>
                    <td style={{
                      padding: '8px 6px',
                      fontWeight: '500',
                      border: '1px solid #d1d5db',
                      textAlign: 'left',
                      wordWrap: 'break-word'
                    }}>{item.productName}</td>
                    <td style={{
                      padding: '8px 6px',
                      textAlign: 'center',
                      border: '1px solid #d1d5db'
                    }}>{item.quantity}</td>
                    <td style={{
                      padding: '8px 6px',
                      textAlign: 'right',
                      border: '1px solid #d1d5db'
                    }}>{item.rate.toFixed(2)}</td>
                    <td style={{
                      padding: '8px 6px',
                      textAlign: 'right',
                      border: '1px solid #d1d5db'
                    }}>{item.discountPercentage.toFixed(1)}%</td>
                    <td style={{
                      padding: '8px 6px',
                      textAlign: 'right',
                      fontWeight: '600',
                      border: '1px solid #d1d5db'
                    }}>{item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom Section - Notes and Totals */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 300px',
            gap: '24px',
            alignItems: 'start'
          }}>
            {/* Left side - Notes and Terms */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {invoice.notes && (
                <div>
                  <h4 style={{
                    fontWeight: 'bold',
                    color: '#374151',
                    marginBottom: '6px',
                    margin: '0 0 6px 0'
                  }}>Notes:</h4>
                  <p style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    backgroundColor: '#f9fafb',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid #e5e7eb',
                    margin: '0'
                  }}>{invoice.notes}</p>
                </div>
              )}
              
              <div>
                <h4 style={{
                  fontWeight: 'bold',
                  color: '#374151',
                  marginBottom: '6px',
                  margin: '0 0 6px 0'
                }}>Terms & Conditions:</h4>
                <p style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  backgroundColor: '#f9fafb',
                  padding: '8px',
                  borderRadius: '4px',
                  border: '1px solid #e5e7eb',
                  margin: '0'
                }}>
                  {invoice.termsAndConditions || "Thank you for your business! Payment is due within the specified date."}
                </p>
              </div>
            </div>
            
            {/* Right side - Totals */}
            <div>
              <div style={{
                backgroundColor: '#f9fafb',
                padding: '12px',
                borderRadius: '4px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  marginBottom: '6px'
                }}>
                  <span style={{ color: '#6b7280' }}>Subtotal:</span> 
                  <span style={{ fontWeight: '600' }}>{currencySymbol}{invoice.subTotal.toFixed(2)}</span>
                </div>
                {!invoice.isInterState && (
                  <>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    marginBottom: '6px'
                  }}>
                    <span style={{ color: '#6b7280' }}>
                      CGST ({(invoice.lineItems[0]?.taxRate || 18) / 2}%):
                    </span> 
                    <span style={{ fontWeight: '600' }}>{currencySymbol}{invoice.totalCGST.toFixed(2)}</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    marginBottom: '6px'
                  }}>
                    <span style={{ color: '#6b7280' }}>
                      SGST ({(invoice.lineItems[0]?.taxRate || 18) / 2}%):
                    </span> 
                    <span style={{ fontWeight: '600' }}>{currencySymbol}{invoice.totalSGST.toFixed(2)}</span>
                  </div>
                  </>
                )}
                {invoice.isInterState && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    marginBottom: '6px'
                  }}>
                    <span style={{ color: '#6b7280' }}>
                      IGST ({invoice.lineItems[0]?.taxRate || 18}%):
                    </span> 
                    <span style={{ fontWeight: '600' }}>{currencySymbol}{invoice.totalIGST.toFixed(2)}</span>
                  </div>
                )}
                <div style={{
                  borderTop: '1px solid #d1d5db',
                  paddingTop: '8px',
                  marginTop: '8px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: '#3f51b5'
                  }}>
                    <span>Grand Total:</span> 
                    <span>{currencySymbol}{invoice.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          {invoice.billerInfo.bankName && (
          <div style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <h4 style={{
              fontWeight: 'bold',
              color: '#374151',
              marginBottom: '12px',
              fontSize: '16px',
              margin: '0 0 12px 0'
            }}>Payment Information:</h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '6px 16px',
              fontSize: '12px',
              backgroundColor: '#f9fafb',
              padding: '12px',
              borderRadius: '4px',
              border: '1px solid #e5e7eb'
            }}>
              {invoice.billerInfo.bankName && <p style={{ margin: '2px 0' }}><strong>Bank:</strong> {invoice.billerInfo.bankName}</p>}
              {invoice.billerInfo.accountNumber && <p style={{ margin: '2px 0' }}><strong>A/C No:</strong> {invoice.billerInfo.accountNumber}</p>}
              {invoice.billerInfo.ifscCode && <p style={{ margin: '2px 0' }}><strong>IFSC:</strong> {invoice.billerInfo.ifscCode}</p>}
              {invoice.billerInfo.upiId && <p style={{ margin: '2px 0' }}><strong>UPI:</strong> {invoice.billerInfo.upiId}</p>}
            </div>
          </div>
          )}
        </CardContent>
      </div> 
      <CardFooter className="p-6 border-t bg-gray-50 flex flex-col sm:flex-row justify-end items-center gap-2 do-not-print-in-pdf">
        <Button variant="outline" asChild>
          <Link href={`/dashboard/invoices/${invoice.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit Invoice</Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isUpdatingStatus}>
                {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MoreVertical className="mr-2 h-4 w-4" />}
                Change Status
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Mark as...</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {invoice.status !== 'sent' && <DropdownMenuItem onClick={() => handleUpdateStatus('sent')} disabled={isUpdatingStatus}>Sent</DropdownMenuItem>}
            {invoice.status !== 'paid' && <DropdownMenuItem onClick={() => handleUpdateStatus('paid')} disabled={isUpdatingStatus}>Paid</DropdownMenuItem>}
            {invoice.status !== 'overdue' && (invoice.status === 'sent' || invoice.status === 'draft') && <DropdownMenuItem onClick={() => handleUpdateStatus('overdue')} disabled={isUpdatingStatus}>Overdue</DropdownMenuItem>}
            <DropdownMenuSeparator />
            {invoice.status !== 'draft' && <DropdownMenuItem onClick={() => handleUpdateStatus('draft')} disabled={isUpdatingStatus}>Draft</DropdownMenuItem>}
            {invoice.status !== 'cancelled' && <DropdownMenuItem onClick={() => handleUpdateStatus('cancelled')} disabled={isUpdatingStatus || invoice.status === 'paid'} className="text-destructive focus:text-destructive focus:bg-destructive/10">Cancelled</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button variant="outline" onClick={() => window.print()} disabled={isDownloading}><Printer className="mr-2 h-4 w-4" /> Print</Button>
        <Button 
          className="bg-accent hover:bg-accent/90 text-accent-foreground"
          onClick={handleDownloadPdf}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {isDownloading ? 'Generating PDF...' : 'Download PDF'}
        </Button>
      </CardFooter>
    </Card>
  );
});

InvoicePreview.displayName = 'InvoicePreview';

// Helper functions for generating page content
function generateHeaderHTML(invoice: Invoice): string {
  const invoiceDate = invoice.invoiceDate instanceof Timestamp ? invoice.invoiceDate.toDate() : new Date(invoice.invoiceDate);
  const dueDate = invoice.dueDate instanceof Timestamp ? invoice.dueDate.toDate() : new Date(invoice.dueDate);
  
  return `
    <div style="background-color: #f8f9fa; padding: 24px; border-bottom: 1px solid #e5e7eb; margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 24px;">
        <div style="flex: 1; max-width: 400px;">
          ${invoice.billerInfo.logoUrl ? 
            `<img src="${invoice.billerInfo.logoUrl}" alt="Logo" style="width: 120px; height: 60px; object-fit: contain; margin-bottom: 12px;" />` :
            `<div style="height: 60px; width: 120px; background-color: #e5e7eb; display: flex; align-items: center; justify-content: center; color: #6b7280; margin-bottom: 12px; border-radius: 4px; font-size: 12px; border: 1px solid #d1d5db;">Logo</div>`
          }
          <h2 style="font-size: 20px; font-weight: bold; color: #3f51b5; margin: 0 0 8px 0;">${invoice.billerInfo.businessName}</h2>
          <div style="font-size: 12px; color: #6b7280; line-height: 1.4;">
            <p style="margin: 2px 0;">${invoice.billerInfo.addressLine1}</p>
            ${invoice.billerInfo.addressLine2 ? `<p style="margin: 2px 0;">${invoice.billerInfo.addressLine2}</p>` : ''}
            <p style="margin: 2px 0;">${invoice.billerInfo.city}, ${invoice.billerInfo.state} - ${invoice.billerInfo.postalCode}</p>
            ${invoice.billerInfo.gstin ? `<p style="font-weight: 600; color: #3f51b5; background-color: #eff6ff; padding: 4px 8px; border-radius: 4px; margin: 6px 0 0 0; display: inline-block; border: 1px solid #bfdbfe;">GSTIN: ${invoice.billerInfo.gstin}</p>` : ''}
          </div>
        </div>
        <div style="text-align: right; min-width: 300px;">
          <h1 style="font-size: 32px; font-weight: bold; text-transform: uppercase; color: #4b5563; margin: 0 0 8px 0;">Invoice</h1>
          <p style="font-size: 18px; color: #6b7280; margin: 0 0 12px 0;"># ${invoice.invoiceNumber}</p>
          <div style="border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 12px; line-height: 1.6;">
            <p style="margin: 3px 0;"><span style="font-weight: 600; color: #374151;">Date:</span> ${format(invoiceDate, "dd MMM, yyyy")}</p>
            <p style="margin: 3px 0;"><span style="font-weight: 600; color: #374151;">Due Date:</span> ${format(dueDate, "dd MMM, yyyy")}</p>
          </div>
        </div>
      </div>
    </div>
    <div style="padding: 0 24px; margin-bottom: 24px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <div>
          <h3 style="font-weight: bold; color: #374151; margin: 0 0 8px 0; font-size: 16px; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px;">Bill To:</h3>
          <div style="line-height: 1.5;">
            <p style="font-weight: 600; color: #3f51b5; font-size: 16px; margin: 3px 0;">${invoice.client.name}</p>
            <p style="font-size: 12px; color: #6b7280; margin: 2px 0;">${invoice.client.addressLine1}</p>
            ${invoice.client.addressLine2 ? `<p style="font-size: 12px; color: #6b7280; margin: 2px 0;">${invoice.client.addressLine2}</p>` : ''}
            <p style="font-size: 12px; color: #6b7280; margin: 2px 0;">${invoice.client.city}, ${invoice.client.state} - ${invoice.client.postalCode}</p>
            ${invoice.client.gstin ? `<p style="font-size: 12px; font-weight: 600; color: #374151; margin: 2px 0;">GSTIN: ${invoice.client.gstin}</p>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function generateContinuationHeaderHTML(invoice: Invoice, pageNumber: number): string {
  return `
    <div style="background-color: #f8f9fa; padding: 16px 24px; border-bottom: 1px solid #e5e7eb; margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h2 style="font-size: 18px; font-weight: bold; color: #3f51b5; margin: 0;">${invoice.billerInfo.businessName}</h2>
          <p style="font-size: 14px; color: #6b7280; margin: 0;">Invoice #${invoice.invoiceNumber}</p>
        </div>
        <div style="text-align: right;">
          <p style="font-size: 14px; color: #6b7280; margin: 0;">Page ${pageNumber}</p>
          <p style="font-size: 12px; color: #9ca3af; margin: 0;">Continued...</p>
        </div>
      </div>
    </div>
  `;
}

function generateLineItemsTableHTML(lineItems: any[], startIndex: number, currency?: string): string {
  const currencySymbol = currency === "INR" ? "Rs." : (currency || "Rs.");
  
  return `
    <div style="padding: 0 24px; margin-bottom: 24px;">
      <table style="width: 100%; font-size: 11px; border-collapse: collapse; border: 1px solid #d1d5db;">
        <thead style="background-color: #f3f4f6;">
          <tr>
            <th style="padding: 8px 6px; text-align: left; font-weight: bold; color: #374151; border: 1px solid #d1d5db; width: 40px;">#</th>
            <th style="padding: 8px 6px; text-align: left; font-weight: bold; color: #374151; border: 1px solid #d1d5db; width: 280px;">Item/Service</th>
            <th style="padding: 8px 6px; text-align: center; font-weight: bold; color: #374151; border: 1px solid #d1d5db; width: 60px;">Qty</th>
            <th style="padding: 8px 6px; text-align: right; font-weight: bold; color: #374151; border: 1px solid #d1d5db; width: 100px;">Rate (${currencySymbol})</th>
            <th style="padding: 8px 6px; text-align: right; font-weight: bold; color: #374151; border: 1px solid #d1d5db; width: 80px;">Disc (%)</th>
            <th style="padding: 8px 6px; text-align: right; font-weight: bold; color: #374151; border: 1px solid #d1d5db; width: 120px;">Amount (${currencySymbol})</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.map((item, index) => `
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 8px 6px; border: 1px solid #d1d5db; text-align: left;">${startIndex + index + 1}</td>
              <td style="padding: 8px 6px; font-weight: 500; border: 1px solid #d1d5db; text-align: left; word-wrap: break-word;">${item.productName}</td>
              <td style="padding: 8px 6px; text-align: center; border: 1px solid #d1d5db;">${item.quantity}</td>
              <td style="padding: 8px 6px; text-align: right; border: 1px solid #d1d5db;">${item.rate.toFixed(2)}</td>
              <td style="padding: 8px 6px; text-align: right; border: 1px solid #d1d5db;">${item.discountPercentage.toFixed(1)}%</td>
              <td style="padding: 8px 6px; text-align: right; font-weight: 600; border: 1px solid #d1d5db;">${item.amount.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function generateFooterHTML(invoice: Invoice): string {
  const currencySymbol = invoice.currency === "INR" ? "Rs." : (invoice.currency || "Rs.");
  
  return `
    <div style="padding: 0 24px;">
      <div style="display: grid; grid-template-columns: 1fr 300px; gap: 24px; align-items: start;">
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${invoice.notes ? `
            <div>
              <h4 style="font-weight: bold; color: #374151; margin: 0 0 6px 0;">Notes:</h4>
              <p style="font-size: 12px; color: #6b7280; background-color: #f9fafb; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb; margin: 0;">${invoice.notes}</p>
            </div>
          ` : ''}
          <div>
            <h4 style="font-weight: bold; color: #374151; margin: 0 0 6px 0;">Terms & Conditions:</h4>
            <p style="font-size: 12px; color: #6b7280; background-color: #f9fafb; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb; margin: 0;">
              ${invoice.termsAndConditions || "Thank you for your business! Payment is due within the specified date."}
            </p>
          </div>
        </div>
        <div>
          <div style="background-color: #f9fafb; padding: 12px; border-radius: 4px; border: 1px solid #e5e7eb;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
              <span style="color: #6b7280;">Subtotal:</span> 
              <span style="font-weight: 600;">${currencySymbol}${invoice.subTotal.toFixed(2)}</span>
            </div>
            ${!invoice.isInterState ? `
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
                <span style="color: #6b7280;">CGST (${(invoice.lineItems[0]?.taxRate || 18) / 2}%):</span> 
                <span style="font-weight: 600;">${currencySymbol}${invoice.totalCGST.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
                <span style="color: #6b7280;">SGST (${(invoice.lineItems[0]?.taxRate || 18) / 2}%):</span> 
                <span style="font-weight: 600;">${currencySymbol}${invoice.totalSGST.toFixed(2)}</span>
              </div>
            ` : `
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
                <span style="color: #6b7280;">IGST (${invoice.lineItems[0]?.taxRate || 18}%):</span> 
                <span style="font-weight: 600;">${currencySymbol}${invoice.totalIGST.toFixed(2)}</span>
              </div>
            `}
            <div style="border-top: 1px solid #d1d5db; padding-top: 8px; margin-top: 8px;">
              <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; color: #3f51b5;">
                <span>Grand Total:</span> 
                <span>${currencySymbol}${invoice.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${invoice.billerInfo.bankName ? `
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <h4 style="font-weight: bold; color: #374151; margin: 0 0 12px 0; font-size: 16px;">Payment Information:</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 16px; font-size: 12px; background-color: #f9fafb; padding: 12px; border-radius: 4px; border: 1px solid #e5e7eb;">
            ${invoice.billerInfo.bankName ? `<p style="margin: 2px 0;"><strong>Bank:</strong> ${invoice.billerInfo.bankName}</p>` : ''}
            ${invoice.billerInfo.accountNumber ? `<p style="margin: 2px 0;"><strong>A/C No:</strong> ${invoice.billerInfo.accountNumber}</p>` : ''}
            ${invoice.billerInfo.ifscCode ? `<p style="margin: 2px 0;"><strong>IFSC:</strong> ${invoice.billerInfo.ifscCode}</p>` : ''}
            ${invoice.billerInfo.upiId ? `<p style="margin: 2px 0;"><strong>UPI:</strong> ${invoice.billerInfo.upiId}</p>` : ''}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function generateContinuationFooterHTML(pageNumber: number, totalPages: number): string {
  return `
    <div style="padding: 16px 24px; border-top: 1px solid #e5e7eb; margin-top: 24px; text-align: center;">
      <p style="font-size: 12px; color: #6b7280; margin: 0;">Page ${pageNumber} of ${totalPages} - Continued on next page...</p>
    </div>
  `;
}