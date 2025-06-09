import type { InvoiceTemplate } from '../types';
import { DEFAULT_PDF_CONFIG } from '../config';
import { HeaderSection } from '../sections/header';
import { BillToSection } from '../sections/billTo';
import { TableSection } from '../sections/table';
import { TotalsSection } from '../sections/totals';
import { FooterSection } from '../sections/footer';

export const classicTemplate: InvoiceTemplate = {
  id: 'classic',
  name: 'Classic Professional',
  description: 'A clean, professional invoice template matching your web design',
  config: DEFAULT_PDF_CONFIG,
  sections: [
    {
      name: 'header',
      height: 60,
      render: (generator, invoice, position) => {
        const headerSection = new HeaderSection(generator.utils, generator.config, generator.dimensions);
        return headerSection.render(invoice, position);
      }
    },
    {
      name: 'billTo',
      height: 40,
      render: (generator, invoice, position) => {
        const billToSection = new BillToSection(generator.utils, generator.config);
        return billToSection.render(invoice, position);
      }
    },
    {
      name: 'table',
      height: 100,
      render: (generator, invoice, position) => {
        const tableSection = new TableSection(generator.utils, generator.config, generator.dimensions, generator.doc);
        return tableSection.render(invoice, position);
      }
    },
    {
      name: 'totals',
      height: 50,
      render: (generator, invoice, position) => {
        const totalsSection = new TotalsSection(generator.utils, generator.config, generator.dimensions);
        return totalsSection.render(invoice, position);
      }
    },
    {
      name: 'footer',
      height: 60,
      render: (generator, invoice, position) => {
        const footerSection = new FooterSection(generator.utils, generator.config, generator.dimensions);
        return footerSection.render(invoice, position);
      }
    }
  ]
};