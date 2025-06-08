import type { ReactNode } from 'react';
import { AppLogo } from '@/components/layout/AppLogo';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function AuthLayout({ children, title, description }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
      <div className="mb-8">
        <AppLogo iconClassName="h-10 w-10" textClassName="text-3xl" hideTextOnMobile={false}/>
      </div>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <h1 className="font-headline text-2xl font-semibold tracking-tight text-primary">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} BillFlow. All rights reserved.
      </p>
    </div>
  );
}
