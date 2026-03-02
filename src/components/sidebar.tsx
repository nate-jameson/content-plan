'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/writers', label: 'Writers', icon: Users },
  { href: '/articles', label: 'Articles', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-700 bg-slate-950">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-slate-700 px-6">
        <ShieldCheck className="h-7 w-7 text-teal-500" />
        <span className="text-lg font-semibold text-slate-100">
          ContentReview
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-teal-500/10 text-teal-500'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700 p-4">
        <p className="text-xs text-slate-500">Content Review Dashboard</p>
        <p className="text-xs text-slate-600">v1.0.0</p>
      </div>
    </aside>
  );
}
