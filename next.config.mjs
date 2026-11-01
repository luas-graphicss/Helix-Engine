const SECURITY_HEADERS = [
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
];
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    images: {
        unoptimized: true,
    },
    async headers() {
        return [{ source: '/(.*)', headers: SECURITY_HEADERS }];
    },
    serverExternalPackages: ['esbuild'],
    turbopack: {
        resolveAlias: {
            module: { browser: './lib/shims/node-module.browser.ts' },
            fs: { browser: './lib/shims/node-fs.browser.ts' },
        },
    },
};
export default nextConfig;
