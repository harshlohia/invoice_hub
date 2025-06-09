import { NextRequest, NextResponse } from 'next/server';
import { pdfGenerator } from '@/lib/pdf-generator';

export async function POST(request: NextRequest) {
  try {
    console.log('PDF generation API called');
    
    const invoiceData = await request.json();
    
    if (!invoiceData) {
      return NextResponse.json(
        { error: 'Invoice data is required' },
        { status: 400 }
      );
    }

    console.log('Generating PDF for invoice:', invoiceData.invoiceNumber);
    
    const pdfBuffer = await pdfGenerator.generateInvoicePDF(invoiceData);
    
    console.log('PDF generated successfully, buffer size:', pdfBuffer.length);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${invoiceData.invoiceNumber || 'document'}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('PDF generation API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { message: 'PDF generation endpoint. Use POST method with invoice data.' },
    { status: 200 }
  );
}