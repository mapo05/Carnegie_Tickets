import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Carnegie Tickets | Student Access',
  description: 'Verify your student status to view campus events.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
