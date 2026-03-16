import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Headshot AI — Professional Headshots in Seconds',
  description: 'Get stunning professional headshots from your selfies. Perfect for LinkedIn, resumes, and company websites. AI-powered, instant delivery.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Headshot AI — Professional Headshots in Seconds',
    description: 'Get stunning professional headshots from your selfies. AI-powered, instant delivery.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-dark-950 text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
