import type { Metadata } from "next";
import { Outfit } from "next/font/google"; // Import Outfit
import "./globals.css";
import PWAProvider from '@/components/PWAProvider';
import AppHeader from '@/components/AppHeader';
import BottomNavigation from '@/components/BottomNavigation';

const outfit = Outfit({ subsets: ["latin"] }); // Configure font

export const metadata: Metadata = {
  title: "Splitmark - Next Generation Orienteering",
  description: "Fullständig orienteringsplattform med MeOS, Livelox och Strava funktionalitet",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Splitmark",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#020617', // Midnight Blue
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${outfit.className} antialiased min-h-screen selection:bg-emerald-500 selection:text-white`}
      >
        <PWAProvider>
          <AppHeader />
          <main className="pb-20 md:pb-8 pt-16 md:pt-24">
            {children}
          </main>
          <BottomNavigation />
        </PWAProvider>
      </body>
    </html>
  );
}
