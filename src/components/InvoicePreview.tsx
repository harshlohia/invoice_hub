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
  showActions?: boolean; // Controls whether to show action buttons
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

export const InvoicePreview = forwardRef<InvoicePreviewHandle, InvoicePreviewProps>(({ invoice: initialInvoice, onStatusChange, showActions = true }, ref) => {
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

      // Create PDF with standard A4 dimensions
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm
      const margin = 15; // Standard 15mm margin for professional appearance
      const availableWidth = pdfWidth - (margin * 2); // 180mm
      const availableHeight = pdfHeight - (margin * 2); // 267mm

      // Hide elements that shouldn't appear in PDF
      const elementsToHide = elementToCapture.querySelectorAll('.do-not-print-in-pdf');
      const originalDisplayValues: string[] = [];
      
      elementsToHide.forEach((element, index) => {
        const htmlElement = element as HTMLElement;
        originalDisplayValues[index] = htmlElement.style.display;
        htmlElement.style.display = 'none';
      });

      // Optimize content spacing for PDF
      const cardContent = elementToCapture.querySelector('[style*="padding: 24px"]') as HTMLElement;
      const originalCardContentStyle = cardContent?.style.cssText || '';
      if (cardContent) {
        cardContent.style.padding = '16px';
      }
      
      // Reduce digital signature spacing
      const digitalSignature = elementToCapture.querySelector('[style*="marginTop: 32px"]') as HTMLElement;
      const originalSignatureStyle = digitalSignature?.style.cssText || '';
      if (digitalSignature) {
        digitalSignature.style.marginTop = '20px';
        digitalSignature.style.marginBottom = '16px';
      }

      // Force layout recalculation
      elementToCapture.offsetHeight;
      
      // Capture content with optimal settings
      const canvas = await html2canvas(elementToCapture, {
        scale: 2, // Good quality without being excessive
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 900,
        height: elementToCapture.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 900,
        windowHeight: elementToCapture.scrollHeight
      });
      
      // Restore original styles
      elementsToHide.forEach((element, index) => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.display = originalDisplayValues[index];
      });
      
      if (cardContent && originalCardContentStyle) {
        cardContent.style.cssText = originalCardContentStyle;
      }
      
      if (digitalSignature && originalSignatureStyle) {
        digitalSignature.style.cssText = originalSignatureStyle;
      }

      const imgData = canvas.toDataURL('image/png', 0.95);
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      
      // Convert canvas dimensions to mm (assuming 96 DPI)
      const pxToMm = 25.4 / 96;
      const imgWidthMm = (canvasWidth / 2) * pxToMm; // Divide by scale factor
      const imgHeightMm = (canvasHeight / 2) * pxToMm;
      
      // Calculate scaling based on width only to preserve natural content flow
      const scaleToFitWidth = availableWidth / imgWidthMm;
      const optimalScale = Math.min(scaleToFitWidth, 1.0); // Only scale down if content is too wide
      
      const finalWidth = imgWidthMm * optimalScale;
      const finalHeight = imgHeightMm * optimalScale;
      
      // Check if content fits on a single page (based on actual height, not scaled)
      if (finalHeight <= availableHeight) {
        // Single page - center content properly
        const x = margin + (availableWidth - finalWidth) / 2;
        const y = margin;
        
        pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
        
        console.log(`Single page PDF: ${finalWidth.toFixed(1)}x${finalHeight.toFixed(1)}mm at scale ${optimalScale.toFixed(3)}`);
      } else {
        // Multi-page - split content evenly
        const contentPerPage = availableHeight / optimalScale; // How much original content fits per page
        const totalPages = Math.ceil(imgHeightMm / contentPerPage);
        
        console.log(`Multi-page PDF: ${totalPages} pages needed, ${contentPerPage.toFixed(1)}mm content per page`);
        
        for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
          if (pageIndex > 0) {
            pdf.addPage();
          }
          
          // Calculate content slice for this page
          const contentStart = pageIndex * contentPerPage;
          const contentEnd = Math.min((pageIndex + 1) * contentPerPage, imgHeightMm);
          const pageContentHeight = contentEnd - contentStart;
          
          // Convert to pixel coordinates
          const pixelStart = (contentStart / imgHeightMm) * canvasHeight;
          const pixelHeight = (pageContentHeight / imgHeightMm) * canvasHeight;
          
          // Create canvas for this page slice
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvasWidth;
          pageCanvas.height = pixelHeight;
          const pageCtx = pageCanvas.getContext('2d');
          
          if (!pageCtx) {
            throw new Error('Failed to create canvas context for page slice');
          }
          
          // Draw the content slice
          pageCtx.drawImage(
            canvas,
            0, pixelStart, canvasWidth, pixelHeight, // source
            0, 0, canvasWidth, pixelHeight // destination
          );
          
          const pageImgData = pageCanvas.toDataURL('image/png', 0.95);
          
          // Calculate dimensions for this page
          const pageImgHeightMm = pageContentHeight;
          const scaledPageHeight = pageImgHeightMm * optimalScale;
          
          // Position content with proper margins
          const x = margin + (availableWidth - finalWidth) / 2;
          const y = margin;
          
          pdf.addImage(pageImgData, 'PNG', x, y, finalWidth, scaledPageHeight, undefined, 'FAST');
          
          console.log(`Page ${pageIndex + 1}: ${finalWidth.toFixed(1)}x${scaledPageHeight.toFixed(1)}mm`);
        }
      }
      
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
    <>
      <style jsx global>{`
        .do-not-print-in-pdf {
          /* This class is used to hide elements from PDF output */
        }
        @media print {
          .do-not-print-in-pdf {
            display: none !important;
          }
        }
      `}</style>
      <Card className="max-w-4xl mx-auto shadow-lg">
      <div ref={invoiceCardRef} data-invoice-content style={{
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        lineHeight: '1.5',
        color: '#000000',
        width: '900px',
        maxWidth: 'none',
        minHeight: 'auto',
        overflow: 'hidden'
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
                  <div style={{
                    marginTop: '8px',
                    display: 'inline-block'
                  }}>
                    <span style={{
                      fontWeight: '600',
                      color: '#3f51b5',
                      backgroundColor: '#eff6ff',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #bfdbfe',
                      fontSize: '11px',
                      letterSpacing: '0.5px',
                      display: 'inline-block'
                    }}>
                      GSTIN: {invoice.billerInfo.gstin}
                    </span>
                  </div>
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
              
              {/* Status - Hidden in PDF */}
              <div className="do-not-print-in-pdf" style={{
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

        <CardContent style={{ padding: '24px', paddingBottom: '16px' }}>
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
                {invoice.client.gstin && (
                  <div style={{
                    marginTop: '6px',
                    display: 'inline-block'
                  }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#374151',
                      backgroundColor: '#f9fafb',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #e5e7eb',
                      letterSpacing: '0.5px',
                      display: 'inline-block'
                    }}>
                      GSTIN: {invoice.client.gstin}
                    </span>
                  </div>
                )}
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

          {/* Line Items Table - Updated for simplified structure */}
          <div style={{ marginBottom: '24px', width: '100%' }}>
            <table style={{
              width: '100%',
              fontSize: '11px',
              borderCollapse: 'collapse',
              border: '2px solid #d1d5db',
              borderRadius: '8px',
              overflow: 'hidden'
            }}>
              <thead style={{ backgroundColor: '#f8fafc' }}>
                <tr>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: '#374151',
                    borderRight: '1px solid #d1d5db',
                    borderBottom: '2px solid #d1d5db',
                    width: '40px',
                    fontSize: '12px'
                  }}>#</th>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: '#374151',
                    borderRight: '1px solid #d1d5db',
                    borderBottom: '2px solid #d1d5db',
                    width: '120px',
                    fontSize: '12px'
                  }}>Date</th>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'left',
                    fontWeight: 'bold',
                    color: '#374151',
                    borderRight: '1px solid #d1d5db',
                    borderBottom: '2px solid #d1d5db',
                    width: '450px',
                    fontSize: '12px'
                  }}>Item/Service</th>
                  <th style={{
                    padding: '12px 8px',
                    textAlign: 'right',
                    fontWeight: 'bold',
                    color: '#374151',
                    borderBottom: '2px solid #d1d5db',
                    width: '120px',
                    fontSize: '12px'
                  }}>Amount ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, index) => (
                  <tr key={item.id} style={{ 
                    borderBottom: index === invoice.lineItems.length - 1 ? 'none' : '1px solid #e5e7eb',
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafbfc'
                  }}>
                    <td style={{
                      padding: '10px 8px',
                      borderRight: '1px solid #e5e7eb',
                      textAlign: 'left',
                      fontSize: '11px'
                    }}>{index + 1}</td>
                    <td style={{
                      padding: '10px 8px',
                      borderRight: '1px solid #e5e7eb',
                      textAlign: 'left',
                      fontSize: '11px'
                    }}>{item.date ? format(new Date(item.date), "dd/MM/yyyy") : format(invoiceDate, "dd/MM/yyyy")}</td>
                    <td style={{
                      padding: '10px 8px',
                      fontWeight: '500',
                      borderRight: '1px solid #e5e7eb',
                      textAlign: 'left',
                      wordWrap: 'break-word',
                      fontSize: '11px'
                    }}>{item.productName}</td>
                    <td style={{
                      padding: '10px 8px',
                      textAlign: 'right',
                      fontWeight: '600',
                      fontSize: '11px'
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
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb',
                    margin: '0',
                    lineHeight: '1.5'
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
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  margin: '0',
                  lineHeight: '1.5'
                }}>
                  {invoice.termsAndConditions || "Thank you for your business! Payment is due within the specified date."}
                </p>
              </div>
            </div>
            
            {/* Right side - Totals */}
            <div>
              <div style={{
                backgroundColor: '#f8fafc',
                padding: '16px',
                borderRadius: '8px',
                border: '2px solid #e5e7eb'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  marginBottom: '8px',
                  paddingBottom: '4px'
                }}>
                  <span style={{ color: '#6b7280', fontWeight: '500' }}>Subtotal:</span> 
                  <span style={{ fontWeight: '600' }}>{currencySymbol}{invoice.subTotal.toFixed(2)}</span>
                </div>
                {!invoice.isInterState && (
                  <>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    marginBottom: '8px',
                    paddingBottom: '4px'
                  }}>
                    <span style={{ color: '#6b7280', fontWeight: '500' }}>
                      CGST ({(invoice.lineItems[0]?.taxRate || 18) / 2}%):
                    </span> 
                    <span style={{ fontWeight: '600' }}>{currencySymbol}{invoice.totalCGST.toFixed(2)}</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    marginBottom: '8px',
                    paddingBottom: '4px'
                  }}>
                    <span style={{ color: '#6b7280', fontWeight: '500' }}>
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
                    marginBottom: '8px',
                    paddingBottom: '4px'
                  }}>
                    <span style={{ color: '#6b7280', fontWeight: '500' }}>
                      IGST ({invoice.lineItems[0]?.taxRate || 18}%):
                    </span> 
                    <span style={{ fontWeight: '600' }}>{currencySymbol}{invoice.totalIGST.toFixed(2)}</span>
                  </div>
                )}
                <div style={{
                  borderTop: '2px solid #d1d5db',
                  paddingTop: '12px',
                  marginTop: '12px'
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
            borderTop: '2px solid #e5e7eb'
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
              gap: '8px 16px',
              fontSize: '12px',
              backgroundColor: '#f8fafc',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              {invoice.billerInfo.bankName && <p style={{ margin: '2px 0' }}><strong>Bank:</strong> {invoice.billerInfo.bankName}</p>}
              {invoice.billerInfo.accountNumber && <p style={{ margin: '2px 0' }}><strong>A/C No:</strong> {invoice.billerInfo.accountNumber}</p>}
              {invoice.billerInfo.ifscCode && <p style={{ margin: '2px 0' }}><strong>IFSC:</strong> {invoice.billerInfo.ifscCode}</p>}
              {invoice.billerInfo.upiId && <p style={{ margin: '2px 0' }}><strong>UPI:</strong> {invoice.billerInfo.upiId}</p>}
            </div>
          </div>
          )}

          {/* Digital Signature */}
          <div style={{
            marginTop: '40px',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}>
            {/* Digital Certificate Stamp */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative'
            }}>
              {/* Certificate Badge */}
              <div style={{
                border: '2px solid #059669',
                borderRadius: '8px',
                padding: '12px 16px',
                backgroundColor: '#f0fdf4',
                position: 'relative',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.15)'
              }}>
                {/* Certificate Header */}
                <div style={{
                  textAlign: 'center',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    fontSize: '8px',
                    color: '#059669',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '2px'
                  }}>
                    DIGITALLY VERIFIED
                  </div>
                  <div style={{
                    width: '40px',
                    height: '1px',
                    backgroundColor: '#059669',
                    margin: '0 auto'
                  }}></div>
                </div>

                {/* Certificate Body */}
                <div style={{
                  textAlign: 'center',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    fontSize: '10px',
                    color: '#065f46',
                    fontWeight: '600',
                    lineHeight: '1.2',
                    maxWidth: '120px'
                  }}>
                    {invoice.billerInfo.businessName}
                  </div>
                  <div style={{
                    fontSize: '8px',
                    color: '#6b7280',
                    marginTop: '4px',
                    fontWeight: '500'
                  }}>
                    Certificate ID: {invoice.id?.slice(-8).toUpperCase() || 'N/A'}
                  </div>
                </div>

                {/* Certificate Footer */}
                <div style={{
                  textAlign: 'center',
                  borderTop: '1px solid #d1fae5',
                  paddingTop: '6px'
                }}>
                  <div style={{
                    fontSize: '7px',
                    color: '#6b7280',
                    fontWeight: '500'
                  }}>
                    Signed on {format(new Date(), "dd MMM yyyy")}
                  </div>
                  <div style={{
                    fontSize: '7px',
                    color: '#6b7280',
                    marginTop: '1px'
                  }}>
                    Valid Certificate
                  </div>
                </div>

                {/* Security Icon */}
                <div style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  backgroundColor: '#059669',
                  borderRadius: '50%',
                  width: '16px',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #ffffff'
                }}>
                  <div style={{
                    color: '#ffffff',
                    fontSize: '8px',
                    fontWeight: 'bold'
                  }}>✓</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </div> 
      {showActions && (
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
      )}
    </Card>
    </>
  );
});

InvoicePreview.displayName = 'InvoicePreview';

// Helper functions for generating page content - Updated for simplified structure
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
            ${invoice.billerInfo.gstin ? `
              <div style="margin-top: 8px; display: inline-block;">
                <span style="font-weight: 600; color: #2563eb; background-color: #eff6ff; padding: 6px 12px; border-radius: 6px; border: 1px solid #bfdbfe; font-size: 11px; letter-spacing: 0.5px; display: inline-block;">GSTIN: ${invoice.billerInfo.gstin}</span>
              </div>
            ` : ''}
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
            ${invoice.client.gstin ? `
              <div style="margin-top: 6px; display: inline-block;">
                <span style="font-size: 11px; font-weight: 600; color: #374151; background-color: #f9fafb; padding: 4px 8px; border-radius: 4px; border: 1px solid #e5e7eb; letter-spacing: 0.5px; display: inline-block;">GSTIN: ${invoice.client.gstin}</span>
              </div>
            ` : ''}
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
  const currencySymbol = "Rs.";
  
  return `
    <div style="padding: 0 24px; margin-bottom: 24px;">
      <table style="width: 100%; font-size: 11px; border-collapse: collapse; border: 2px solid #d1d5db; border-radius: 8px; overflow: hidden;">
        <thead style="background-color: #f8fafc;">
          <tr>
            <th style="padding: 12px 8px; text-align: left; font-weight: bold; color: #374151; border-right: 1px solid #d1d5db; border-bottom: 2px solid #d1d5db; width: 40px; font-size: 12px;">#</th>
            <th style="padding: 12px 8px; text-align: left; font-weight: bold; color: #374151; border-right: 1px solid #d1d5db; border-bottom: 2px solid #d1d5db; width: 120px; font-size: 12px;">Date</th>
            <th style="padding: 12px 8px; text-align: left; font-weight: bold; color: #374151; border-right: 1px solid #d1d5db; border-bottom: 2px solid #d1d5db; width: 450px; font-size: 12px;">Item/Service</th>
            <th style="padding: 12px 8px; text-align: right; font-weight: bold; color: #374151; border-bottom: 2px solid #d1d5db; width: 120px; font-size: 12px;">Amount (${currencySymbol})</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.map((item, index) => `
            <tr style="border-bottom: ${index === lineItems.length - 1 ? 'none' : '1px solid #e5e7eb'}; background-color: ${index % 2 === 0 ? '#ffffff' : '#fafbfc'};">
              <td style="padding: 10px 8px; border-right: 1px solid #e5e7eb; text-align: left; font-size: 11px;">${startIndex + index + 1}</td>
              <td style="padding: 10px 8px; border-right: 1px solid #e5e7eb; text-align: left; font-size: 11px;">${item.date ? format(new Date(item.date), "dd/MM/yyyy") : format(new Date(), "dd/MM/yyyy")}</td>
              <td style="padding: 10px 8px; font-weight: 500; border-right: 1px solid #e5e7eb; text-align: left; word-wrap: break-word; font-size: 11px;">${item.productName}</td>
              <td style="padding: 10px 8px; text-align: right; font-weight: 600; font-size: 11px;">${item.amount.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function generateFooterHTML(invoice: Invoice): string {
  const currencySymbol = "Rs.";
  
  return `
    <div style="padding: 0 24px;">
      <div style="display: grid; grid-template-columns: 1fr 300px; gap: 24px; align-items: start;">
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${invoice.notes ? `
            <div>
              <h4 style="font-weight: bold; color: #374151; margin: 0 0 6px 0;">Notes:</h4>
              <p style="font-size: 12px; color: #6b7280; background-color: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; margin: 0; line-height: 1.5;">${invoice.notes}</p>
            </div>
          ` : ''}
          <div>
            <h4 style="font-weight: bold; color: #374151; margin: 0 0 6px 0;">Terms & Conditions:</h4>
            <p style="font-size: 12px; color: #6b7280; background-color: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; margin: 0; line-height: 1.5;">
              ${invoice.termsAndConditions || "Thank you for your business! Payment is due within the specified date."}
            </p>
          </div>
        </div>
        <div>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; border: 2px solid #e5e7eb;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; padding-bottom: 4px;">
              <span style="color: #6b7280; font-weight: 500;">Subtotal:</span> 
              <span style="font-weight: 600;">${currencySymbol}${invoice.subTotal.toFixed(2)}</span>
            </div>
            ${!invoice.isInterState ? `
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; padding-bottom: 4px;">
                <span style="color: #6b7280; font-weight: 500;">CGST (${(invoice.lineItems[0]?.taxRate || 18) / 2}%):</span> 
                <span style="font-weight: 600;">${currencySymbol}${invoice.totalCGST.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; padding-bottom: 4px;">
                <span style="color: #6b7280; font-weight: 500;">SGST (${(invoice.lineItems[0]?.taxRate || 18) / 2}%):</span> 
                <span style="font-weight: 600;">${currencySymbol}${invoice.totalSGST.toFixed(2)}</span>
              </div>
            ` : `
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 8px; padding-bottom: 4px;">
                <span style="color: #6b7280; font-weight: 500;">IGST (${invoice.lineItems[0]?.taxRate || 18}%):</span> 
                <span style="font-weight: 600;">${currencySymbol}${invoice.totalIGST.toFixed(2)}</span>
              </div>
            `}
            <div style="border-top: 2px solid #d1d5db; padding-top: 12px; margin-top: 12px;">
              <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; color: #3f51b5;">
                <span>Grand Total:</span> 
                <span>${currencySymbol}${invoice.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      ${invoice.billerInfo.bankName ? `
        <div style="margin-top: 24px; padding-top: 16px; border-top: 2px solid #e5e7eb;">
          <h4 style="font-weight: bold; color: #374151; margin: 0 0 12px 0; font-size: 16px;">Payment Information:</h4>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 16px; font-size: 12px; background-color: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
            ${invoice.billerInfo.bankName ? `<p style="margin: 2px 0;"><strong>Bank:</strong> ${invoice.billerInfo.bankName}</p>` : ''}
            ${invoice.billerInfo.accountNumber ? `<p style="margin: 2px 0;"><strong>A/C No:</strong> ${invoice.billerInfo.accountNumber}</p>` : ''}
            ${invoice.billerInfo.ifscCode ? `<p style="margin: 2px 0;"><strong>IFSC:</strong> ${invoice.billerInfo.ifscCode}</p>` : ''}
            ${invoice.billerInfo.upiId ? `<p style="margin: 2px 0;"><strong>UPI:</strong> ${invoice.billerInfo.upiId}</p>` : ''}
          </div>
        </div>
      ` : ''}
      
      <!-- Digital Signature -->
      <div style="margin-top: 32px; display: flex; justify-content: flex-end; align-items: center;">
        <div style="position: relative; display: inline-block;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); border: 3px solid #065f46; position: relative; transform: rotate(-5deg);">
            <div style="background: rgba(255, 255, 255, 0.1); border-radius: 50%; width: 100px; height: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px solid rgba(255, 255, 255, 0.3); text-align: center; padding: 8px;">
              <div style="color: #ffffff; font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.1; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3); word-wrap: break-word; max-width: 80px;">
                ${invoice.billerInfo.businessName}
              </div>
              <div style="width: 60px; height: 1px; background-color: rgba(255, 255, 255, 0.6); margin: 4px 0;"></div>
              <div style="color: #ffffff; font-size: 7px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);">Authorized</div>
              <div style="color: #ffffff; font-size: 7px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);">Signature</div>
            </div>
            <div style="position: absolute; top: 8px; left: 50%; transform: translateX(-50%); color: #ffffff; font-size: 8px; opacity: 0.8;">★</div>
            <div style="position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); color: #ffffff; font-size: 8px; opacity: 0.8;">★</div>
          </div>
          <div style="position: absolute; bottom: -20px; right: 10px; font-size: 9px; color: #6b7280; font-weight: 500; transform: rotate(-5deg);">
            ${format(new Date(), "dd/MM/yyyy")}
          </div>
        </div>
      </div>
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