import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLogo } from '@/components/layout/AppLogo';
import { ArrowRight } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-br from-primary/10 via-background to-background">
      <div className="text-center max-w-2xl mx-auto">
        <AppLogo className="justify-center mb-8" iconClassName="h-16 w-16" textClassName="text-5xl" hideTextOnMobile={false} />
        <h1 className="font-headline text-4xl md:text-5xl font-bold text-primary mb-6">
          Welcome to BillFlow
        </h1>
        <p className="text-lg md:text-xl text-foreground/80 mb-10">
          Modern invoice generation tailored for Indian businesses. Create, manage, and track GST-compliant invoices with ease.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Get Started</CardTitle>
              <CardDescription>New to BillFlow? Create an account or log in.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col space-y-3">
              <Button asChild size="lg" className="w-full bg-primary hover:bg-primary/90">
                <Link href="/signup">Sign Up <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link href="/login">Log In</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="hover:shadow-xl transition-shadow duration-300">
            <CardHeader>
              <CardTitle className="font-headline text-2xl">Explore</CardTitle>
              <CardDescription>Jump right into your dashboard if you're already set up.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="lg" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                <Link href="/dashboard">Go to Dashboard <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} BillFlow. Streamlining your invoicing process.
        </p>
      </div>
    </main>
  );
}
