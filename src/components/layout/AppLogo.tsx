import Link from 'next/link';
import { BillFlowLogoIcon } from '@/components/icons/BillFlowLogoIcon';
import { cn } from '@/lib/utils';

interface AppLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  hideTextOnMobile?: boolean;
}

export function AppLogo({ className, iconClassName, textClassName, hideTextOnMobile = true }: AppLogoProps) {
  return (
    <Link href="/" className={cn("flex items-center gap-2", className)}>
      <BillFlowLogoIcon className={cn("h-6 w-6 text-primary", iconClassName)} />
      <span
        className={cn(
          "font-headline font-semibold text-lg text-primary",
          hideTextOnMobile && "hidden sm:inline-block",
          textClassName
        )}
      >
        BillFlow
      </span>
    </Link>
  );
}
