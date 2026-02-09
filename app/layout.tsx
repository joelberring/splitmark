import type { Metadata } from "next";
import "./globals.css";
import PWAProvider from '@/components/PWAProvider';
import AppHeader from '@/components/AppHeader';
import BottomNavigation from '@/components/BottomNavigation';

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
        {/* Avoid build-time font fetch (works in restricted CI environments). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="antialiased min-h-screen selection:bg-emerald-500 selection:text-white"
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
