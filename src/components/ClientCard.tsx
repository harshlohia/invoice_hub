
import type { Client } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Mail, Phone, Edit, Trash2, FilePlus } from 'lucide-react';

interface ClientCardProps {
  client: Client;
  onDeleteRequest: (clientId: string) => void;
}

export function ClientCard({ client, onDeleteRequest }: ClientCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200 flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline text-xl">{client.name}</CardTitle>
        {client.gstin && <CardDescription>GSTIN: {client.gstin}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-1 text-sm flex-grow">
        {client.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <a href={`mailto:${client.email}`} className="hover:underline truncate" title={client.email}>{client.email}</a>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4" />
            <a href={`tel:${client.phone}`} className="hover:underline">{client.phone}</a>
          </div>
        )}
        <p className="text-muted-foreground pt-1">
          {client.addressLine1}{client.addressLine2 ? `, ${client.addressLine2}` : ''}
          <br/>
          {client.city}, {client.state} - {client.postalCode}
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 justify-end border-t pt-4 mt-auto">
        <Button variant="outline" size="sm" asChild className="flex-1 min-w-[120px]">
          <Link href={`/dashboard/invoices/new?clientId=${client.id}`}>
            <FilePlus className="mr-1 h-4 w-4" /> New Invoice
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/clients/${client.id}/edit`}><Edit className="mr-1 h-4 w-4" /> Edit</Link>
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
          onClick={() => onDeleteRequest(client.id)}
        >
          <Trash2 className="mr-1 h-4 w-4" /> Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
