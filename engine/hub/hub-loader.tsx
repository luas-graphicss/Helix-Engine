'use client';
import dynamic from 'next/dynamic';
import { LoadingScreen } from '@/engine/boot/loading-screen';
export const HubLoader = dynamic(() => import('./hub-boot').then((module) => module.HubBoot), {
    ssr: false,
    loading: () => <LoadingScreen progress={null}/>,
});
