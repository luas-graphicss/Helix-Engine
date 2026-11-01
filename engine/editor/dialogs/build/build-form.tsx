'use client';
import { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBuildBytes } from '@/engine/build/build-progress';
import { BUILD_PLATFORMS, BUILD_STORES, BUILD_WINDOW_MODES, buildPlatformOf, executableBaseName, normalizeVersion, type BuildOptions, type BuildPlatformId } from '@/engine/build/build-targets';
import { FieldInput } from '@/engine/ui/field-input';
import { ImageBlobThumbnail } from '@/engine/ui/image-blob-thumbnail';
import { SegmentedControl } from '@/engine/ui/segmented-control';
import { SelectField } from '@/engine/ui/select-field';
import { WELL_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { Row, Section } from './build-dialog-parts';
interface BuildFormProps {
    options: BuildOptions;
    onChange(patch: Partial<BuildOptions>): void;
    cached: ReadonlySet<BuildPlatformId>;
    disabled?: boolean;
}
const PLATFORM_OPTIONS = BUILD_PLATFORMS.map((platform) => ({ value: platform.id, label: platform.label }));
const STORE_OPTIONS = BUILD_STORES.map((store) => ({ value: store.id, label: store.label }));
const WINDOW_OPTIONS = BUILD_WINDOW_MODES.map((mode) => ({ value: mode.id, label: mode.label }));
const ICON_TYPES = 'image/png,image/jpeg,image/webp';
export function BuildForm({ options, onChange, cached, disabled = false }: BuildFormProps) {
    const iconInputRef = useRef<HTMLInputElement>(null);
    const platform = buildPlatformOf(options.platform);
    const store = BUILD_STORES.find((candidate) => candidate.id === options.store) ?? BUILD_STORES[0];
    const executable = executableBaseName(options.gameName);
    const launch = platform.os === 'windows' ? `${executable}.exe` : platform.os === 'macos' ? `${executable}.app` : executable;
    const templateCached = cached.has(platform.id);
    const pickIcon = (file: File | null) => {
        if (!file)
            return;
        if (!file.type.startsWith('image/'))
            return;
        onChange({ icon: file });
    };
    return (<>
      <Section title="Jogo" description="O que o jogador vê: título da janela, nome do executável e propriedades do arquivo.">
        <Row label="Nome" hint={`O executável será "${launch}".`}>
          <FieldInput type="text" value={options.gameName} disabled={disabled} aria-label="Nome do jogo" placeholder="Nome do jogo" spellCheck={false} className="w-full" onChange={(event) => onChange({ gameName: event.currentTarget.value })}/>
        </Row>
        <Row label="Versão" hint={`Gravada como ${normalizeVersion(options.version)} nas propriedades do executável e no manifesto.`}>
          <FieldInput type="text" inputMode="decimal" value={options.version} disabled={disabled} aria-label="Versão do jogo" placeholder="1.0.0" spellCheck={false} className="w-32" onChange={(event) => onChange({ version: event.currentTarget.value })}/>
        </Row>
        <Row label="Estúdio" hint="Nome da empresa nas propriedades do executável. Opcional; sem ele vai o nome do jogo.">
          <FieldInput type="text" value={options.company} disabled={disabled} aria-label="Nome do estúdio" placeholder="Seu estúdio" className="w-full" onChange={(event) => onChange({ company: event.currentTarget.value })}/>
        </Row>
        <Row label="Ícone" hint="PNG quadrado, 256×256 ou maior. Vira o ícone do executável no Windows e da janela em todas as plataformas.">
          <div className="flex items-center gap-2">
            <span className={cn('flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-sm', WELL_CLASS)}>
              <ImageBlobThumbnail blob={options.icon} alt={options.icon ? 'Ícone do jogo' : 'Sem ícone'}/>
            </span>
            <input ref={iconInputRef} type="file" accept={ICON_TYPES} aria-label="Arquivo do ícone" className="sr-only" tabIndex={-1} disabled={disabled} onChange={(event) => pickIcon(event.currentTarget.files?.[0] ?? null)}/>
            <Button size="xs" variant="outline" disabled={disabled} onClick={() => iconInputRef.current?.click()}>
              <ImagePlus aria-hidden/>
              {options.icon ? 'Trocar ícone…' : 'Escolher ícone…'}
            </Button>
            {options.icon && (<Button size="xs" variant="ghost" disabled={disabled} aria-label="Remover ícone" onClick={() => onChange({ icon: null })}>
                <X aria-hidden/>
                Remover
              </Button>)}
          </div>
        </Row>
        <Row label="Janela" hint="Tela cheia é o padrão dos jogos de computador; F11 e Alt+Enter alternam a qualquer momento.">
          <SegmentedControl label="Modo da janela" options={WINDOW_OPTIONS} value={options.window} onChange={(window) => !disabled && onChange({ window })}/>
        </Row>
      </Section>

      <Section title="Destino" description="Uma compilação gera uma pasta para uma plataforma. Para publicar em várias, compile uma vez por plataforma; a cena, os scripts e as preferências são os mesmos.">
        <Row label="Plataforma" hint={<>
              {platform.hint}{' '}
              {templateCached ? (<span className="text-success">Helix Player já no cache deste navegador.</span>) : (<>Baixa o Helix Player ({formatBuildBytes(platform.templateBytes)}) só na primeira vez; depois fica no cache.</>)}
            </>}>
          <div className="w-60">
            <SelectField label="Plataforma" options={PLATFORM_OPTIONS} value={options.platform} disabled={disabled} onChange={(platform) => onChange({ platform })}/>
          </div>
        </Row>
        <Row label="Loja" hint={store.hint}>
          <SegmentedControl label="Loja de destino" options={STORE_OPTIONS} value={options.store} onChange={(store) => !disabled && onChange({ store })}/>
        </Row>
        {options.store === 'steam' && (<Row label="App ID da Steam" hint="Opcional. Com ele, o steam_appid.txt vai na pasta para o jogo abrir fora do cliente Steam durante os testes.">
            <FieldInput type="text" inputMode="numeric" pattern="[0-9]*" value={options.steamAppId} disabled={disabled} aria-label="App ID da Steam" placeholder="480" spellCheck={false} className="w-32" onChange={(event) => onChange({ steamAppId: event.currentTarget.value.replace(/\D/g, '') })}/>
          </Row>)}
      </Section>
    </>);
}
