import { Download } from 'lucide-react';
import { MCP_KIT_API, MCP_KIT_FILE_NAME } from '@/engine/mcp/kit/kit-location';
import { FOCUS_RING_CLASS, RAISED_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
export function KitDownloadLink() {
    return (<a href={MCP_KIT_API} download={MCP_KIT_FILE_NAME} className={cn('flex h-6 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-sm px-2.5 text-2xs font-medium whitespace-nowrap text-foreground transition-[color,border-color,filter] duration-100', RAISED_CLASS, 'hover:border-primary/50 hover:brightness-115 active:brightness-90', FOCUS_RING_CLASS)}>
      <Download aria-hidden className="size-3.5 shrink-0 text-primary"/>
      Baixar kit MCP
    </a>);
}
