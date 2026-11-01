import type { Metadata } from 'next';
import { HubLoader } from '@/engine/hub/hub-loader';
export const metadata: Metadata = {
    title: 'Início',
};
export default function HubPage() {
    return <HubLoader />;
}
