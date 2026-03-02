import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Sidebar } from '@/components/sidebar';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Content Review Dashboard',
  description: 'Monitor writer content for plagiarism, AI detection, and grammar quality',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans bg-slate-950 text-slate-100 antialiased`}>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="ml-64 flex-1 p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
