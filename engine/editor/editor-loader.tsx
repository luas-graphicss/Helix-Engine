'use client';
import dynamic from 'next/dynamic';
import { LoadingScreen } from '@/engine/boot/loading-screen';
export const EditorLoader = dynamic(() => import('./editor-boot').then((module) => module.EditorBoot), {
    ssr: false,
    loading: () => <LoadingScreen progress={null}/>,
});
