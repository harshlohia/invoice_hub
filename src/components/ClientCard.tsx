
import type { Client } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Mail, Phone, Edit, Trash2, FilePlus, MapPin, Building2 } from 'lucide-react';

interface ClientCardProps {
  client: Client;
  onDeleteRequest: (clientId: string) => void;
}

export function ClientCard({ client, onDeleteRequest }: ClientCardProps) {
  return (
    <Card className="group hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 hover:-translate-y-1 flex flex-col border-0 shadow-md bg-gradient-to-br from-card to-card/80 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <CardTitle className="font-headline text-xl font-semibold text-foreground group-hover:text-blue-600 transition-colors duration-200">
              {client.name}
            </CardTitle>
            {client.gstin && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full border border-blue-200 dark:border-blue-800">
                <Building2 className="h-3 w-3" />
                GSTIN: {client.gstin}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4 flex-grow px-6">
        <div className="space-y-3">
          {client.email && (
            <div className="flex items-center gap-3 group/item hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-950/30 rounded-full flex items-center justify-center">
                <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <a 
                href={`mailto:${client.email}`} 
                className="text-sm text-foreground hover:text-blue-600 transition-colors truncate font-medium" 
                title={client.email}
              >
                {client.email}
              </a>
            </div>
          )}
          
          {client.phone && (
            <div className="flex items-center gap-3 group/item hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-950/30 rounded-full flex items-center justify-center">
                <Phone className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <a 
                href={`tel:${client.phone}`} 
                className="text-sm text-foreground hover:text-green-600 transition-colors font-medium"
              >
                {client.phone}
              </a>
            </div>
          )}
          
          <div className="flex items-start gap-3 group/item hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors">
            <div className="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-950/30 rounded-full flex items-center justify-center mt-0.5">
              <MapPin className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed">
              <div className="font-medium text-foreground">
                {client.addressLine1}
                {client.addressLine2 && <span>, {client.addressLine2}</span>}
              </div>
              <div className="text-xs mt-1">
                {client.city}, {client.state} - {client.postalCode}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-3 pt-6 mt-auto border-t border-border/50">
        <Button 
          variant="default" 
          size="sm" 
          asChild 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
        >
          <Link href={`/dashboard/invoices/new?clientId=${client.id}`}>
            <FilePlus className="mr-2 h-4 w-4" /> 
            Create New Invoice
          </Link>
        </Button>
        
        <div className="flex gap-2 w-full">
          <Button 
            variant="outline" 
            size="sm" 
            asChild 
            className="flex-1 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 dark:hover:bg-blue-950/30 transition-all duration-200"
          >
            <Link href={`/dashboard/clients/${client.id}/edit`}>
              <Edit className="mr-1.5 h-4 w-4" /> 
              Edit
            </Link>
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30 transition-all duration-200"
            onClick={() => onDeleteRequest(client.id)}
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> 
            Delete
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
