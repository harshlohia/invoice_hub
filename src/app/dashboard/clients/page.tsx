import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClientCard } from '@/components/ClientCard';
import { mockClients } from '@/lib/types'; // Using mock data
import { PlusCircle, Search, Users } from 'lucide-react';

export default function ClientsPage() {
  // In a real app, clients would be fetched from an API
  const clients = mockClients;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">Manage your client database.</p>
        </div>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href="/dashboard/clients/new">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Client
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 p-4 border rounded-lg bg-card shadow">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input placeholder="Search by client name, GSTIN, email..." className="pl-10 w-full" />
        </div>
        <Button variant="outline" className="w-full md:w-auto">Search</Button>
      </div>

      {clients.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-xl font-semibold">No clients yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your first client to get started.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/dashboard/clients/new">Add Client</Link>
          </Button>
        </div>
      )}
      {/* Pagination placeholder */}
      {clients.length > 10 && (
         <div className="flex justify-center mt-8">
            <Button variant="outline" className="mr-2">Previous</Button>
            <Button variant="outline">Next</Button>
        </div>
      )}
    </div>
  );
}
