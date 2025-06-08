import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palette, Wand2, Eye } from "lucide-react";
import Image from "next/image";

const templates = [
  { id: "classic", name: "Classic Professional", description: "A timeless, formal design suitable for all businesses.", imageUrl: "https://placehold.co/400x560.png", dataAiHint: "invoice template" },
  { id: "modern", name: "Modern Minimalist", description: "Clean lines and contemporary typography for a sleek look.", imageUrl: "https://placehold.co/400x560.png", dataAiHint: "invoice design" },
  { id: "creative", name: "Creative Agency", description: "A vibrant, bold design perfect for creative industries.", imageUrl: "https://placehold.co/400x560.png", dataAiHint: "invoice layout" },
];

export default function TemplatesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold tracking-tight flex items-center">
          <Palette className="mr-3 h-8 w-8 text-primary" /> Invoice Templates
        </h1>
        <p className="text-muted-foreground">
          Choose and customize templates to match your brand identity.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Available Templates</CardTitle>
          <CardDescription>Select a base template to start customizing or use as is.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(template => (
            <Card key={template.id} className="overflow-hidden hover:shadow-xl transition-shadow">
              <div className="aspect-[4/5.6] bg-muted overflow-hidden">
                <Image 
                  src={template.imageUrl} 
                  alt={template.name} 
                  width={400} 
                  height={560} 
                  className="object-cover w-full h-full"
                  data-ai-hint={template.dataAiHint}
                />
              </div>
              <CardHeader>
                <CardTitle className="font-headline text-lg">{template.name}</CardTitle>
                <CardDescription className="text-xs h-10 overflow-hidden">{template.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" disabled>
                  <Eye className="mr-2 h-4 w-4" /> Preview
                </Button>
                <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90" disabled>
                  <Wand2 className="mr-2 h-4 w-4" /> Customize
                </Button>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Customization Options (Coming Soon)</CardTitle>
          <CardDescription>Full customization features are under development. You'll soon be able to:</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-muted-foreground">
          <ul className="list-disc list-inside space-y-1">
            <li>Upload your business logo and header images.</li>
            <li>Adjust color schemes to match your brand.</li>
            <li>Select from a variety of professional fonts.</li>
            <li>Modify label text (e.g., "Invoice" to "Tax Invoice").</li>
            <li>Customize footer content with bank details, UPI, or QR codes.</li>
            <li>Save and reuse your personalized templates.</li>
          </ul>
          <p className="pt-2">Stay tuned for these exciting updates!</p>
        </CardContent>
      </Card>
    </div>
  );
}
