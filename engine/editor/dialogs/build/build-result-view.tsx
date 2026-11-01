'use client';
import { useState } from 'react';
import { CircleCheck, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBuildBytes, type BuildLogLine } from '@/engine/build/build-progress';
import { buildPlatformOf, type BuildOptions } from '@/engine/build/build-targets';
import type { BuildResult } from '@/engine/build/game-compiler';
import { copyTextToClipboard } from '@/engine/ui/clipboard';
import { EMPTY_WELL_CLASS } from '@/engine/ui/surface-styles';
import { cn } from '@/lib/utils';
import { FactGrid, Section } from './build-dialog-parts';
import { BuildLog } from './build-log';
function nextSteps(options: BuildOptions, launchTarget: string): readonly string[] {
    const platform = buildPlatformOf(options.platform);
    const steps: string[] = ['Descompacte o zip: a pasta inteira é o jogo e os arquivos precisam ficar juntos.'];
    if (platform.os === 'windows')
        steps.push(`Abra "${launchTarget}" para testar. Para distribuir fora de lojas sem o aviso do SmartScreen, assine o executável com o seu certificado (comando no LEIA-ME).`);
    else if (platform.os === 'macos')
        steps.push(`Num Mac, assine e notarize "${launchTarget}" antes de distribuir (comandos no LEIA-ME); sem isso o sistema recusa abrir fora da Steam.`);
    else
        steps.push(`Dê permissão de execução ("chmod +x ${launchTarget}") e abra para testar.`);
    if (options.store === 'steam')
        steps.push('No Steamworks, aponte o depot desta plataforma para a pasta descompactada e use o executável como opção de inicialização.');
    else if (options.store === 'itch')
        steps.push('Envie a pasta com o butler (comando no LEIA-ME); o .itch.toml incluído diz ao app do itch o que abrir.');
    else
        steps.push('Publique o zip onde quiser: o jogador descompacta e abre o executável.');
    return steps;
}
export function BuildResultView({ result, options, log }: {
    result: BuildResult;
    options: BuildOptions;
    log: readonly BuildLogLine[];
}) {
    const { summary } = result;
    const [copied, setCopied] = useState(false);
    const copyHash = async () => {
        if (await copyTextToClipboard(summary.sha256)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
    };
    return (<>
      <Section title="Entregue">
        <div className={cn('flex items-start gap-3 px-3 py-2.5', EMPTY_WELL_CLASS)}>
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden/>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate font-mono text-2xs text-foreground">{result.fileName}</span>
            <span className="text-3xs text-muted-foreground">
              {formatBuildBytes(summary.totalBytes)} · {summary.platformLabel} · {summary.storeLabel} · compilado em {summary.durationSeconds.toFixed(1)} s
            </span>
            <span className="flex items-center gap-1.5 text-3xs text-muted-foreground">
              <span className="truncate font-mono">SHA-256 {summary.sha256}</span>
              <Button size="icon-xs" variant="ghost" aria-label={copied ? 'Hash copiado' : 'Copiar o SHA-256'} title="Copiar o SHA-256" onClick={() => void copyHash()}>
                <Copy aria-hidden/>
              </Button>
              {copied && <span className="text-success">copiado</span>}
            </span>
          </div>
        </div>
        {summary.scriptsWithErrors.length > 0 && (<p className={cn('px-3 py-2 text-2xs leading-relaxed text-pretty text-warning', EMPTY_WELL_CLASS)}>
            {summary.scriptsWithErrors.length === 1 ? 'Um script com erros de compilação ficou de fora' : `${summary.scriptsWithErrors.length} scripts com erros de compilação ficaram de fora`} ({summary.scriptsWithErrors.join(', ')}), exatamente como no playtest. Corrija e compile de novo para incluí-los.
          </p>)}
      </Section>

      <Section title="Do que o pacote é feito">
        <FactGrid columns={4} facts={[
            { label: 'Helix Player', value: formatBuildBytes(summary.templateBytes), detail: summary.templateFromCache ? 'Do cache do navegador, hash conferido.' : 'Baixado e verificado contra o SHASUMS256.' },
            { label: 'Runtime da engine', value: formatBuildBytes(summary.runtimeJsBytes + summary.cssBytes), detail: 'Código da engine sem o editor, mais os estilos do jogo.' },
            { label: 'Conteúdo do jogo', value: formatBuildBytes(summary.packBytes), detail: `Cena, materiais e ativos.${summary.removedServerScripts.length > 0 ? ` ${summary.removedServerScripts.length} ${summary.removedServerScripts.length === 1 ? 'script de servidor removido' : 'scripts de servidor removidos'}.` : ''}` },
            { label: 'Arquivos da engine', value: `${summary.publicAssetCount} (${formatBuildBytes(summary.publicAssetBytes)})`, detail: summary.vendors.length > 0 ? `Inclui os runtimes de ${summary.vendors.join(', ')}.` : 'SMAA e modelos embutidos usados pela cena.' },
            { label: 'Scripts', value: `${summary.precompiledScripts} ${summary.precompiledScripts === 1 ? 'pré-compilado' : 'pré-compilados'}`, detail: 'Cliente e compartilhados, prontos para rodar sem compilador.' },
            { label: 'Preferências', value: summary.settingsCount === 0 ? 'Padrão' : `${summary.settingsCount} no manifesto`, detail: 'A engine do jogo adota os mesmos valores do playtest.' },
            { label: 'Rede', value: summary.net.authoritative ? 'Servidor hospedado' : 'Sem servidor', detail: summary.net.serverUrl ?? 'Tudo roda na máquina do jogador.' },
            { label: 'Executável', value: summary.launchTarget, detail: summary.branding === 'applied' ? 'Com ícone e versão gravados.' : summary.branding === 'failed' ? 'Com o ícone e a versão do Electron.' : summary.platformLabel.startsWith('Windows') ? 'Versão gravada; sem ícone escolhido.' : 'Renomeado para o jogo.', tone: summary.branding === 'failed' ? 'warn' : 'default' },
        ]}/>
      </Section>

      <Section title="Próximos passos" description="O LEIA-ME.txt dentro do zip repete isto com os comandos completos.">
        <ol className="flex list-decimal flex-col gap-1 pl-4 text-2xs leading-relaxed text-pretty text-foreground marker:text-muted-foreground">
          {nextSteps(options, summary.launchTarget).map((step) => (<li key={step}>{step}</li>))}
        </ol>
      </Section>

      <Section title="Registro">
        <BuildLog lines={log} follow={false} className="max-h-48"/>
      </Section>
    </>);
}
