'use client';
import { Cpu, PackageCheck, ServerOff, ShieldCheck } from 'lucide-react';
import { HELIX_PLAYER_ELECTRON_VERSION } from '@/engine/build/build-targets';
import { useSessionTopic } from '@/engine/editor/session/editor-session-context';
import { snapshotGameSettings } from '@/engine/player/game-settings';
import { contextOf } from '@/engine/scripting/script-sides';
import { isAuthoritative } from '@/engine/scripting/scripting-settings';
import { useEngineSettingsVersion } from '@/engine/settings/engine-settings-store';
import { FactGrid, Section } from './build-dialog-parts';
const GUARANTEES: ReadonlyArray<{
    icon: typeof Cpu;
    title: string;
    text: string;
}> = [
    { icon: Cpu, title: 'A mesma engine do playtest', text: 'O jogo leva o runtime da engine sem o editor: renderer, física, áudio, animação, interface e rede, com os scripts já compilados pelo mesmo compilador do playtest.' },
    { icon: ServerOff, title: 'Sem o lado do servidor', text: 'Scripts marcados como Servidor ficam fora do pacote, com os arquivos deles; o jogo compilado nunca carrega código de servidor.' },
    { icon: ShieldCheck, title: 'Helix Player verificado', text: `O invólucro nativo é o Electron ${HELIX_PLAYER_ELECTRON_VERSION} oficial, conferido contra o SHASUMS256 do lançamento antes de ser usado; o jogo é a pasta de aplicação dentro dele.` },
    { icon: PackageCheck, title: 'Tudo no seu navegador', text: 'Nenhum arquivo do jogo sai da sua máquina: a compilação roda aqui, e o servidor só entrega o runtime e o Helix Player.' },
];
export function BuildContents() {
    const session = useSessionTopic('assets', 'scene');
    useEngineSettingsVersion();
    const scripts = session.library.byKind('script');
    const serverScripts = scripts.filter((asset) => contextOf(asset) === 'server').length;
    const clientScripts = scripts.length - serverScripts;
    const assets = session.library.size - scripts.length;
    const { server } = session.scene.scripting;
    const authoritative = isAuthoritative(session.scene.scripting);
    const settingsCount = Object.keys(snapshotGameSettings()).length;
    return (<Section title="O que vai no pacote" description="Lido do projeto agora; a compilação salva a cena e os scripts abertos antes de começar.">
      <FactGrid columns={4} facts={[
            { label: 'Scripts', value: `${clientScripts} ${clientScripts === 1 ? 'pré-compilado' : 'pré-compilados'}`, detail: serverScripts > 0 ? `${serverScripts} de servidor ${serverScripts === 1 ? 'fica' : 'ficam'} de fora.` : 'Nenhum script de servidor.' },
            { label: 'Ativos', value: `${assets} ${assets === 1 ? 'ativo' : 'ativos'}`, detail: 'Modelos, texturas, sons, animações e materiais da biblioteca.' },
            {
                label: 'Rede',
                value: authoritative ? 'Servidor autoritativo' : 'Sem servidor',
                detail: authoritative ? (server.url ? server.url : 'Sem endereço: informe-o em Código ▸ Servidor do jogo.') : 'Tudo roda na máquina do jogador.',
                tone: authoritative && !server.url ? 'warn' : 'default',
            },
            { label: 'Preferências', value: settingsCount === 0 ? 'Padrão da engine' : `${settingsCount} ${settingsCount === 1 ? 'alterada' : 'alteradas'}`, detail: 'Física, render, câmera, sombras e áudio viajam como no playtest.' },
        ]}/>
      <ul className="grid gap-3 sm:grid-cols-2">
        {GUARANTEES.map(({ icon: Icon, title, text }) => (<li key={title} className="flex items-start gap-2.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden/>
            <span className="flex flex-col gap-0.5">
              <span className="text-2xs font-medium text-foreground">{title}</span>
              <span className="text-3xs leading-relaxed text-pretty text-muted-foreground">{text}</span>
            </span>
          </li>))}
      </ul>
    </Section>);
}
