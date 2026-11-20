import { Box, PackageOpen, PersonStanding, type LucideIcon } from 'lucide-react';
import type { NetworkSpawnMode } from '@/engine/net/scene/network-object-settings';
export const NETWORK_SPAWN_ICON: Record<NetworkSpawnMode, LucideIcon> = {
    scene: Box,
    player: PersonStanding,
    template: PackageOpen,
};
