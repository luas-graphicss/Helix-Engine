import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
const _inter = Inter({ subsets: ['latin'] });
const _jetbrainsMono = JetBrains_Mono({ subsets: ['latin'] });
export const metadata: Metadata = {
    title: 'Helix Engine — Editor',
    description: 'Editor da Helix Engine, uma engine 3D para a web.',
    generator: 'v0.app',
    icons: {
        icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
        apple: '/apple-icon.png',
    },
};
export const viewport: Viewport = {
    colorScheme: 'dark',
    themeColor: '#131315',
    width: 'device-width',
    initialScale: 1,
};
export default function RootLayout({ children, }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang="pt-BR" className="dark bg-background">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>);
}
