
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLogo } from '@/components/layout/AppLogo';
import { ArrowRight, CheckCircle, Zap, BarChart3, ShieldCheck, Target } from 'lucide-react';
import Image from 'next/image';

export default function HomePage() {
  const features = [
    {
      icon: <Zap className="h-10 w-10 text-primary" />, // Changed from text-accent to text-primary for feature icons
      title: "Create Invoices in Seconds",
      description: "Our intuitive interface lets you generate professional, GST-compliant invoices faster than ever. Say goodbye to manual data entry.",
      link: "/signup",
      linkText: "Start Invoicing Fast"
    },
    {
      icon: <ShieldCheck className="h-10 w-10 text-primary" />, // Changed from text-accent to text-primary
      title: "Automated GST Compliance",
      description: "BillFlow handles complex GST calculations (CGST, SGST, IGST) automatically, ensuring your invoices are always accurate and compliant.",
      link: "/dashboard/invoices/new",
      linkText: "Explore Compliance"
    },
    {
      icon: <BarChart3 className="h-10 w-10 text-primary" />, // Changed from text-accent to text-primary
      title: "Track & Manage with Ease",
      description: "Get a clear overview of your finances. Track invoice statuses, payments, and client histories all in one place.",
      link: "/dashboard",
      linkText: "View Your Dashboard"
    }
  ];

  return (
    <main className="flex flex-col items-center min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Hero Section */}
      <section className="w-full py-20 md:py-32 flex flex-col items-center justify-center text-center px-4">
        <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-12 duration-700">
          <AppLogo className="justify-center mb-8" iconClassName="h-20 w-20 text-accent" textClassName="text-6xl text-accent" hideTextOnMobile={false} />
          <h1 className="font-headline text-5xl md:text-7xl font-bold text-foreground mb-6">
            Invoicing, <span className="text-accent">Simplified.</span>
          </h1>
          <p className="text-lg md:text-xl text-foreground/80 mb-10 max-w-2xl mx-auto">
            BillFlow empowers Indian businesses to create GST-compliant invoices effortlessly. Focus on your growth, we'll handle the paperwork.
          </p>
          <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-8 py-6 animate-in fade-in slide-in-from-bottom-16 duration-700 delay-300">
            <Link href="/signup">Get Started Free <ArrowRight className="ml-2 h-5 w-5" /></Link>
          </Button>
          <p className="mt-4 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-16 duration-700 delay-500">No credit card required. Start in minutes.</p>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="w-full py-16 md:py-24 bg-card px-4 border-y">
        <div className="container mx-auto max-w-5xl grid md:grid-cols-2 gap-12 items-center">
          <div className="animate-in fade-in slide-in-from-left-16 duration-700 delay-200">
            <h2 className="text-3xl md:text-4xl font-headline font-bold text-foreground mb-6">Stop Wrestling with Invoices.</h2>
            <p className="text-lg text-muted-foreground mb-4">
              Manual invoicing is time-consuming, error-prone, and a compliance headache.
              BillFlow is designed to eliminate these frustrations:
            </p>
            <ul className="space-y-3 text-lg">
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-3 mt-1 shrink-0" />
                <span>Waste less time on repetitive data entry.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-3 mt-1 shrink-0" />
                <span>Eliminate costly calculation errors with automation.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-3 mt-1 shrink-0" />
                <span>Navigate GST complexities with built-in intelligence.</span>
              </li>
              <li className="flex items-start">
                <CheckCircle className="h-6 w-6 text-green-500 mr-3 mt-1 shrink-0" />
                <span>Present a professional image with polished invoices.</span>
              </li>
            </ul>
             <Button asChild variant="link" size="lg" className="text-accent hover:text-accent/80 text-lg p-0 mt-6 animate-in fade-in slide-in-from-bottom-8 duration-500 delay-700">
              <Link href="/dashboard/invoices/new">See it in action <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
          </div>
          <div className="animate-in fade-in slide-in-from-right-16 duration-700 delay-400">
            <Image
              src="https://placehold.co/600x400.png"
              alt="BillFlow Dashboard Preview"
              width={600}
              height={400}
              className="rounded-xl shadow-2xl"
              data-ai-hint="dashboard invoice app"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12 md:mb-16 animate-in fade-in slide-in-from-bottom-12 duration-700">
            <h2 className="text-3xl md:text-4xl font-headline font-bold text-foreground mb-4">Everything You Need, Nothing You Don't.</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              BillFlow is packed with features designed to make your invoicing seamless and efficient.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={feature.title} className={`animate-in fade-in slide-in-from-bottom-${12 + index * 2} duration-700 delay-${200 + index * 150}`}>
                <Card className="h-full flex flex-col hover:shadow-2xl transition-shadow duration-300 bg-card border">
                  <CardHeader className="items-center text-center">
                    <div className="p-4 bg-primary/10 rounded-full mb-4 inline-block">
                      {feature.icon}
                    </div>
                    <CardTitle className="font-headline text-2xl mb-2 text-foreground">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center text-muted-foreground flex-grow">
                    <p>{feature.description}</p>
                  </CardContent>
                  <CardFooter className="justify-center pt-4">
                     <Button asChild variant="outline" className="mt-auto">
                        <Link href={feature.link}>{feature.linkText} <ArrowRight className="ml-2 h-4 w-4" /></Link>
                     </Button>
                  </CardFooter>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="w-full py-16 md:py-24 bg-muted/50 px-4 border-t">
        <div className="container mx-auto max-w-3xl text-center animate-in fade-in slide-in-from-bottom-12 duration-700 delay-300">
          <Target className="h-16 w-16 text-accent mx-auto mb-6" />
          <h2 className="text-3xl md:text-4xl font-headline font-bold text-foreground mb-6">Ready to Transform Your Invoicing?</h2>
          <p className="text-lg text-muted-foreground mb-10">
            Join hundreds of Indian businesses streamlining their billing with BillFlow.
            Sign up today and experience the difference.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-8 py-6">
              <Link href="/signup">Claim Your Free Account <ArrowRight className="ml-2 h-5 w-5" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6 border-foreground/20 hover:bg-foreground/5">
              <Link href="/login">Login to Dashboard</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-8 border-t bg-card">
        <div className="container mx-auto text-center text-muted-foreground text-sm">
          <AppLogo className="justify-center mb-4" iconClassName="h-8 w-8 text-primary" textClassName="text-xl text-primary" hideTextOnMobile={false}/>
          <p>© {new Date().getFullYear()} BillFlow. All rights reserved. Built for India.</p>
          <div className="mt-2 space-x-4">
            <Link href="#" className="hover:text-accent">Privacy Policy</Link>
            <Link href="#" className="hover:text-accent">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
