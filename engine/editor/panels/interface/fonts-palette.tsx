'use client';
import { Type } from 'lucide-react';
import { FONT_ACCEPT } from '@/engine/assets/library/asset-kinds';
import type { GuiFontFamily } from '@/engine/gui/document/gui-document';
import { GUI_BUILTIN_FONTS, fontAssetFamily, guiFonts } from '@/engine/gui/fonts/gui-font-registry';
import { useGuiDesigner } from '@/engine/editor/gui/ui/use-gui-designer';
import { importGuiFonts } from '@/engine/editor/operations/gui-operations';
import { setSelectedTextFamily } from '@/engine/editor/operations/gui-property-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton } from '@/engine/ui/action-button';
import { cn } from '@/lib/utils';
import { EMPTY_NOTE_CLASS } from '@/engine/ui/surface-styles';
import { PaletteNotice } from './palette-notice';
const SAMPLE = 'Aa Bb 0123 · Jogar';
interface FontRowProps {
    readonly family: GuiFontFamily;
    readonly label: string;
    readonly detail: string;
    readonly active: boolean;
    readonly failed?: boolean;
    readonly onApply: () => void;
}
function FontRow({ family, label, detail, active, failed, onApply }: FontRowProps) {
    return (<button type="button" onClick={onApply} title={`Aplicar ${label} aos textos selecionados`} className={cn('flex h-11 w-full min-w-0 items-center gap-3 overflow-hidden rounded-sm border border-border bg-surface px-3 text-left transition-colors', 'hover:border-primary/60 hover:bg-highlight focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary', active && 'border-primary/60 bg-primary/10')}>
      <span className="flex w-40 max-w-[45%] min-w-0 shrink-0 flex-col">
        <span className={cn('truncate text-2xs font-medium', active ? 'text-primary' : 'text-foreground')}>{label}</span>
        <span className="truncate font-mono text-3xs text-muted-foreground">{failed ? 'não foi possível carregar' : detail}</span>
      </span>
      <span className="min-w-0 flex-1 truncate text-base text-foreground" style={{ fontFamily: guiFonts.cssFamily(family) }}>
        {SAMPLE}
      </span>
    </button>);
}
export function FontsPalette() {
    const session = useEditorSession();
    const designer = useGuiDesigner();
    const fonts = session.library.byKind('font');
    const selectedTexts = designer.selectedNodes.filter((node) => node.text);
    const current = selectedTexts.length > 0 && selectedTexts.every((node) => node.text?.family === selectedTexts[0].text?.family) ? (selectedTexts[0].text?.family ?? null) : null;
    return (<div className="flex h-full min-h-0 flex-col">
      {designer.isOpen && selectedTexts.length === 0 && <PaletteNotice>Selecione um texto, botão ou campo na tela e clique numa fonte para aplicá-la. Fontes também podem ser arrastadas da biblioteca sobre a tela.</PaletteNotice>}
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-3 py-1.5">
        <span className="min-w-0 flex-1 basis-40 truncate text-2xs text-muted-foreground">Formatos aceitos: {FONT_ACCEPT.replace(/\./g, '').toUpperCase().replace(/,/g, ', ')}</span>
        <div className="ml-auto shrink-0">
          <ActionButton icon={Type} onClick={() => importGuiFonts(session)}>
            Importar fontes…
          </ActionButton>
        </div>
      </div>
      
      <div className="flex min-h-0 flex-1 flex-wrap content-start gap-4 overflow-auto p-3">
        <section className="flex min-w-0 flex-1 basis-80 flex-col gap-1.5">
          <h3 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">Importadas ({fonts.length})</h3>
          {fonts.length === 0 ? (<p className={cn('px-3 py-3 text-2xs', EMPTY_NOTE_CLASS)}>Nenhuma fonte importada. Use “Importar fontes…” ou solte arquivos no painel Ativos.</p>) : (fonts.map((asset) => {
            const details = asset.details.kind === 'font' ? asset.details : null;
            const family = fontAssetFamily(asset.id);
            return (<FontRow key={asset.id} family={family} label={asset.name} detail={details ? `${details.family} · ${details.style} · ${details.weight}` : 'fonte'} active={current === family} failed={guiFonts.hasFailed(asset.id)} onApply={() => setSelectedTextFamily(session, family, asset.name)}/>);
        }))}
        </section>
        <section className="flex min-w-0 flex-1 basis-80 flex-col gap-1.5">
          <h3 className="text-3xs font-medium tracking-wider text-muted-foreground uppercase">Embutidas (sem download)</h3>
          {GUI_BUILTIN_FONTS.map((font) => (<FontRow key={font.id} family={font.id} label={font.label} detail={font.css.split(',')[0].replace(/"/g, '')} active={current === font.id} onApply={() => setSelectedTextFamily(session, font.id, font.label)}/>))}
        </section>
      </div>
    </div>);
}
