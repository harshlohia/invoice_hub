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

      // Create canvas from the invoice element with enhanced options
      const canvas = await html2canvas(elementToCapture, {
        scale: 2, // Good balance between quality and performance
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: elementToCapture.scrollWidth,
        height: elementToCapture.scrollHeight,
        ignoreElements: (element) => {
          // Hide elements that shouldn't appear in PDF
          return element.classList.contains('do-not-print-in-pdf') ||
                 element.tagName === 'BUTTON' ||
                 element.getAttribute('role') === 'button';
        }
      });

      // Convert canvas to image data
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // Create PDF with proper A4 dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      // Calculate dimensions to fit the content properly
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      // Calculate scaling to fit content within PDF page with margins
      const margin = 10; // 10mm margin
      const availableWidth = pdfWidth - (margin * 2);
      const availableHeight = pdfHeight - (margin * 2);
      
      // Convert pixels to mm (assuming 96 DPI)
      const pxToMm = 25.4 / 96;
      const imgWidthMm = canvasWidth * pxToMm / 2; // Divide by scale factor
      const imgHeightMm = canvasHeight * pxToMm / 2;
      
      // Scale to fit if necessary
      const scaleX = availableWidth / imgWidthMm;
      const scaleY = availableHeight / imgHeightMm;
      const scale = Math.min(scaleX, scaleY, 1); // Don't scale up
      
      const finalWidth = imgWidthMm * scale;
      const finalHeight = imgHeightMm * scale;
      
      // Center the image on the page
      const x = (pdfWidth - finalWidth) / 2;
      const y = margin;

      // Add image to PDF
      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
      
      // Save the PDF
      pdf.save(`invoice-${invoice.invoiceNumber || 'document'}.pdf`);
      
      toast({
        title: "Success",
        description: `Invoice ${invoice.invoiceNumber}.pdf downloaded successfully.`,
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
        minWidth: '800px' // Ensure minimum width for proper table display
      }}> 
        <CardHeader style={{
          backgroundColor: '#f8f9fa',
          padding: '32px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '24px'
          }}>
            <div style={{ flex: '1', minWidth: '300px' }}>
              {invoice.billerInfo.logoUrl ? (
                <Image
                  src={invoice.billerInfo.logoUrl}
                  alt={`${invoice.billerInfo.businessName} logo`}
                  width={150}
                  height={75}
                  style={{ 
                    objectFit: 'contain',
                    marginBottom: '16px'
                  }} 
                  data-ai-hint="company logo"
                />
              ) : (
                <div style={{
                  height: '80px',
                  width: '160px',
                  backgroundColor: '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#6b7280',
                  marginBottom: '16px',
                  borderRadius: '4px',
                  fontSize: '14px',
                  border: '1px solid #d1d5db'
                }} data-ai-hint="logo placeholder">
                  {invoice.billerInfo.businessName}
                </div>
              )}
              <h2 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#3f51b5',
                marginBottom: '8px',
                margin: '0 0 8px 0'
              }}>{invoice.billerInfo.businessName}</h2>
              <div style={{
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: '1.4'
              }}>
                <p style={{ margin: '4px 0' }}>{invoice.billerInfo.addressLine1}</p>
                {invoice.billerInfo.addressLine2 && <p style={{ margin: '4px 0' }}>{invoice.billerInfo.addressLine2}</p>}
                <p style={{ margin: '4px 0' }}>{invoice.billerInfo.city}, {invoice.billerInfo.state} - {invoice.billerInfo.postalCode}</p>
                {invoice.billerInfo.gstin && (
                  <p style={{
                    fontWeight: '600',
                    color: '#3f51b5',
                    backgroundColor: '#eff6ff',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    marginTop: '8px',
                    display: 'inline-block',
                    border: '1px solid #bfdbfe',
                    margin: '8px 0 0 0'
                  }}>
                    GSTIN: {invoice.billerInfo.gstin}
                  </p>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right', minWidth: '250px' }}>
              <h1 style={{
                fontSize: '36px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                color: '#4b5563',
                marginBottom: '8px',
                margin: '0 0 8px 0'
              }}>Invoice</h1>
              <p style={{
                fontSize: '20px',
                color: '#6b7280',
                marginBottom: '16px',
                margin: '0 0 16px 0'
              }}># {invoice.invoiceNumber}</p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
                marginBottom: '16px'
              }}>
                 {statusIcons[invoice.status]}
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  textTransform: 'capitalize',
                  padding: '4px 12px',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '4px'
                }}>{invoice.status}</span>
              </div>
              <div style={{
                borderTop: '1px solid #e5e7eb',
                paddingTop: '16px',
                fontSize: '14px',
                lineHeight: '1.6'
              }}>
                <p style={{ margin: '4px 0' }}>
                  <span style={{ fontWeight: '600', color: '#374151' }}>Date:</span> {format(invoiceDate, "dd MMM, yyyy")}
                </p>
                <p style={{ margin: '4px 0' }}>
                  <span style={{ fontWeight: '600', color: '#374151' }}>Due Date:</span> {format(dueDate, "dd MMM, yyyy")}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent style={{ padding: '32px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '32px',
            marginBottom: '32px'
          }}>
            <div>
              <h3 style={{
                fontWeight: 'bold',
                color: '#374151',
                marginBottom: '12px',
                fontSize: '18px',
                borderBottom: '2px solid #e5e7eb',
                paddingBottom: '8px',
                margin: '0 0 12px 0'
              }}>Bill To:</h3>
              <div style={{ lineHeight: '1.6' }}>
                <p style={{
                  fontWeight: '600',
                  color: '#3f51b5',
                  fontSize: '18px',
                  margin: '4px 0'
                }}>{invoice.client.name}</p>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: '4px 0'
                }}>{invoice.client.addressLine1}</p>
                {invoice.client.addressLine2 && <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: '4px 0'
                }}>{invoice.client.addressLine2}</p>}
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  margin: '4px 0'
                }}>{invoice.client.city}, {invoice.client.state} - {invoice.client.postalCode}</p>
                {invoice.client.gstin && <p style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#374151',
                  margin: '4px 0'
                }}>GSTIN: {invoice.client.gstin}</p>}
              </div>
            </div>
            {invoice.shippingAddress && (
              <div>
                <h3 style={{
                  fontWeight: 'bold',
                  color: '#374151',
                  marginBottom: '12px',
                  fontSize: '18px',
                  borderBottom: '2px solid #e5e7eb',
                  paddingBottom: '8px',
                  margin: '0 0 12px 0'
                }}>Ship To:</h3>
                <div style={{ lineHeight: '1.6' }}>
                  <p style={{
                    fontWeight: '600',
                    color: '#3f51b5',
                    fontSize: '18px',
                    margin: '4px 0'
                  }}>{invoice.shippingAddress.name}</p>
                  <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    margin: '4px 0'
                  }}>{invoice.shippingAddress.addressLine1}</p>
                  {invoice.shippingAddress.addressLine2 && <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    margin: '4px 0'
                  }}>{invoice.shippingAddress.addressLine2}</p>}
                  <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    margin: '4px 0'
                  }}>{invoice.shippingAddress.city}, {invoice.shippingAddress.state} - {invoice.shippingAddress.postalCode}</p>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '32px', overflowX: 'visible' }}>
            <table style={{
              width: '100%',
              fontSize: '12px',
              borderCollapse: 'collapse',
              border: '1px solid #d1d5db',
              tableLayout: 'fixed'
            }}>
              <thead style={{ backgroundColor: '#f3f4f6' }}>
                <tr>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    width: '8%'
                  }}>#</th>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    width: '35%'
                  }}>Item/Service</th>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    width: '10%'
                  }}>Qty</th>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    width: '15%'
                  }}>Rate ({currencySymbol})</th>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    width: '12%'
                  }}>Disc (%)</th>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    width: '20%'
                  }}>Amount ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #d1d5db' }}>
                    <td style={{
                      padding: '12px 8px',
                      border: '1px solid #d1d5db',
                      textAlign: 'left'
                    }}>{index + 1}</td>
                    <td style={{
                      padding: '12px 8px',
                      fontWeight: '500',
                      border: '1px solid #d1d5db',
                      textAlign: 'left',
                      wordWrap: 'break-word'
                    }}>{item.productName}</td>
                    <td style={{
                      padding: '12px 8px',
                      textAlign: 'center',
                      border: '1px solid #d1d5db'
                    }}>{item.quantity}</td>
                    <td style={{
                      padding: '12px 8px',
                      textAlign: 'right',
                      border: '1px solid #d1d5db'
                    }}>{item.rate.toFixed(2)}</td>
                    <td style={{
                      padding: '12px 8px',
                      textAlign: 'right',
                      border: '1px solid #d1d5db'
                    }}>{item.discountPercentage.toFixed(1)}%</td>
                    <td style={{
                      padding: '12px 8px',
                      textAlign: 'right',
                      fontWeight: '600',
                      border: '1px solid #d1d5db'
                    }}>{item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 350px',
            gap: '32px',
            alignItems: 'start'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {invoice.notes && (
                <div>
                  <h4 style={{
                    fontWeight: 'bold',
                    color: '#374151',
                    marginBottom: '8px',
                    margin: '0 0 8px 0'
                  }}>Notes:</h4>
                  <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    backgroundColor: '#f9fafb',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #e5e7eb',
                    margin: '0'
                  }}>{invoice.notes}</p>
                </div>
              )}
              {invoice.termsAndConditions && (
                <div>
                  <h4 style={{
                    fontWeight: 'bold',
                    color: '#374151',
                    marginBottom: '8px',
                    margin: '0 0 8px 0'
                  }}>Terms & Conditions:</h4>
                  <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    backgroundColor: '#f9fafb',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #e5e7eb',
                    margin: '0'
                  }}>{invoice.termsAndConditions}</p>
                </div>
              )}
              {!invoice.termsAndConditions && (
                <div>
                  <h4 style={{
                    fontWeight: 'bold',
                    color: '#374151',
                    marginBottom: '8px',
                    margin: '0 0 8px 0'
                  }}>Terms & Conditions:</h4>
                  <p style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    backgroundColor: '#f9fafb',
                    padding: '12px',
                    borderRadius: '4px',
                    border: '1px solid #e5e7eb',
                    margin: '0'
                  }}>Thank you for your business! Payment is due within the specified date.</p>
                </div>
              )}
            </div>
            <div>
              <div style={{
                backgroundColor: '#f9fafb',
                padding: '16px',
                borderRadius: '4px',
                border: '1px solid #e5e7eb'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '14px',
                  marginBottom: '8px'
                }}>
                  <span style={{ color: '#6b7280' }}>Subtotal:</span> 
                  <span style={{ fontWeight: '600' }}>{currencySymbol}{invoice.subTotal.toFixed(2)}</span>
                </div>
                {!invoice.isInterState && (
                  <>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    marginBottom: '8px'
                  }}>
                    <span style={{ color: '#6b7280' }}>
                      CGST ({(invoice.lineItems[0]?.taxRate || 18) / 2}%):
                    </span> 
                    <span style={{ fontWeight: '600' }}>{currencySymbol}{invoice.totalCGST.toFixed(2)}</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    marginBottom: '8px'
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
                    fontSize: '14px',
                    marginBottom: '8px'
                  }}>
                    <span style={{ color: '#6b7280' }}>
                      IGST ({invoice.lineItems[0]?.taxRate || 18}%):
                    </span> 
                    <span style={{ fontWeight: '600' }}>{currencySymbol}{invoice.totalIGST.toFixed(2)}</span>
                  </div>
                )}
                <div style={{
                  borderTop: '1px solid #d1d5db',
                  paddingTop: '12px',
                  marginTop: '12px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '18px',
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

          {invoice.billerInfo.bankName && (
          <div style={{
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <h4 style={{
              fontWeight: 'bold',
              color: '#374151',
              marginBottom: '16px',
              fontSize: '18px',
              margin: '0 0 16px 0'
            }}>Payment Information:</h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '8px 24px',
              fontSize: '14px',
              backgroundColor: '#f9fafb',
              padding: '16px',
              borderRadius: '4px',
              border: '1px solid #e5e7eb'
            }}>
              {invoice.billerInfo.bankName && <p style={{ margin: '4px 0' }}><strong>Bank:</strong> {invoice.billerInfo.bankName}</p>}
              {invoice.billerInfo.accountNumber && <p style={{ margin: '4px 0' }}><strong>A/C No:</strong> {invoice.billerInfo.accountNumber}</p>}
              {invoice.billerInfo.ifscCode && <p style={{ margin: '4px 0' }}><strong>IFSC:</strong> {invoice.billerInfo.ifscCode}</p>}
              {invoice.billerInfo.upiId && <p style={{ margin: '4px 0' }}><strong>UPI:</strong> {invoice.billerInfo.upiId}</p>}
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