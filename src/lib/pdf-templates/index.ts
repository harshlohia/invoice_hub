import { ClassicTemplate } from './classic-template';
import type { PDFTemplate } from './base-template';

export type TemplateType = 'classic' | 'modern' | 'minimal';

export class PDFTemplateFactory {
  static createTemplate(templateType: TemplateType): PDFTemplate {
    switch (templateType) {
      case 'classic':
        return new ClassicTemplate();
      case 'modern':
        // TODO: Implement ModernTemplate
        return new ClassicTemplate(); // Fallback for now
      case 'minimal':
        // TODO: Implement MinimalTemplate
        return new ClassicTemplate(); // Fallback for now
      default:
        return new ClassicTemplate();
    }
  }
}

export { PDFTemplate } from './base-template';
export { ClassicTemplate } from './classic-template';