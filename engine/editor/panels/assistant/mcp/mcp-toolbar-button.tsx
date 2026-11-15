'use client';
import { useSyncExternalStore } from 'react';
import { Cable } from 'lucide-react';
import type { McpBridge } from '@/engine/editor/mcp/mcp-bridge';
import { IconButton } from '@/engine/ui/icon-button';
type McpToolbarButtonProps = {
    bridge: McpBridge;
    open: boolean;
    onToggle: () => void;
};
export function McpToolbarButton({ bridge, open, onToggle }: McpToolbarButtonProps) {
    const status = useSyncExternalStore(bridge.subscribeStatus, bridge.getStatus, bridge.getStatus);
    const online = status.state === 'online';
    return (<IconButton label={online ? 'Conexão MCP ativa: agentes externos podem usar o editor' : 'Conexão MCP para agentes externos'} size="sm" active={open} className={online && !open ? 'text-success' : undefined} onClick={onToggle}>
      <Cable />
    </IconButton>);
}
