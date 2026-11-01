import { redirect } from 'next/navigation';
import { HUB_PATH } from '@/engine/hub/hub-routes';
export default function RootPage() {
    redirect(HUB_PATH);
}
