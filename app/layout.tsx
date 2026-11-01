import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import { PreferencesBoot } from '@/engine/settings/preferences-boot';
import './globals.css';
const plexSans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-sans' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });
export const metadata: Metadata = {
    title: {
        default: 'Helix Engine',
        template: '%s · Helix Engine',
    },
    description: 'Helix Engine, uma engine 3D para a web: crie, edite e guarde seus jogos direto no navegador.',
    applicationName: 'Helix Engine',
    generator: 'v0.app',
    icons: {
        icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
        apple: '/apple-icon.png',
    },
};
export const viewport: Viewport = {
    colorScheme: 'dark',
    themeColor: '#101114',
    width: 'device-width',
    initialScale: 1,
};
export default function EngineLayout({ children, }: Readonly<{
    children: React.ReactNode;
}>) {
    return (<html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable} bg-background`}>
      <body className="antialiased">
        <PreferencesBoot />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>);
}
