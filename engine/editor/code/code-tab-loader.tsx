'use client';
import dynamic from 'next/dynamic';
import { LoadingScreen } from '@/engine/boot/loading-screen';
export const CodeTabLoader = dynamic(() => import('./code-tab-boot').then((module) => module.CodeTabBoot), {
    ssr: false,
    loading: () => <LoadingScreen progress={null}/>,
});
