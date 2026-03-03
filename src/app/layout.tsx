import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import { auth } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Content Review Dashboard',
  description: 'Monitor writer content for plagiarism, AI detection, and grammar quality',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isLoggedIn = !!session;

  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans bg-slate-950 text-slate-100 antialiased`}>
        <SessionProvider session={session}>
          {isLoggedIn ? (
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="ml-64 flex-1 p-8">
                {children}
              </main>
            </div>
          ) : (
            children
          )}
        </SessionProvider>
      </body>
    </html>
  );
}
