'use client';
import { LoadingScreen } from '@/engine/boot/loading-screen';
import { useHub } from './hub-context';
export function OpeningOverlay() {
    const { opening } = useHub();
    if (!opening)
        return null;
    return <LoadingScreen title={opening.name} progress={null}/>;
}
