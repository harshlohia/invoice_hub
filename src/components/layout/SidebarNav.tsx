"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  Briefcase,
  Palette,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/invoices', label: 'Invoices', icon: FileText },
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
  { href: '/dashboard/services', label: 'Products/Services', icon: Briefcase, disabled: true }, // Placeholder for future
  { href: '/dashboard/templates', label: 'Templates', icon: Palette },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

interface SidebarNavProps {
  isMobile?: boolean;
  className?: string;
}

export function SidebarNav({ isMobile = false, className }: SidebarNavProps) {
  const pathname = usePathname();

  const renderNavItems = () => (
    <nav className={cn("flex flex-col gap-1 p-2", className)}>
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
              isActive
                ? "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              item.disabled && "cursor-not-allowed opacity-50"
            )}
            aria-disabled={item.disabled}
            onClick={(e) => item.disabled && e.preventDefault()}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  if (isMobile) {
    return <ScrollArea className="flex-1 py-2">{renderNavItems()}</ScrollArea>;
  }

  return renderNavItems();
}