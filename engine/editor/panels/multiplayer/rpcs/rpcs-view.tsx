'use client';
import { Plus, Trash2 } from 'lucide-react';
import { addRpc, canAddRpc, removeRpc, updateRpc } from '@/engine/editor/operations/multiplayer/rpc-declaration-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { MAX_RPC_RATE, RPC_AUDIENCES, RPC_AUDIENCE_HINT, RPC_AUDIENCE_LABEL, type RpcDeclaration } from '@/engine/net/settings/rpc-declarations';
import { CheckBox } from '@/engine/ui/check-box';
import { IconButton } from '@/engine/ui/icon-button';
import { SelectField } from '@/engine/ui/select-field';
import { CommitField, NumberField } from '../shared/fields';
import { PanelSection, SectionNote } from '../shared/panel-section';
const AUDIENCE_OPTIONS = RPC_AUDIENCES.map((audience) => ({ value: audience, label: RPC_AUDIENCE_LABEL[audience] }));
const COLUMNS_CLASS = 'grid grid-cols-[minmax(6rem,1fr)_minmax(9rem,1fr)_4.5rem_4.5rem_5rem_1.5rem] items-center gap-2';
function RpcRow({ rpc }: {
    rpc: RpcDeclaration;
}) {
    const session = useEditorSession();
    return (<li className={`${COLUMNS_CLASS} rounded-sm px-1.5 py-0.5 odd:bg-surface-sunken/50`} title={RPC_AUDIENCE_HINT[rpc.audience]}>
      <CommitField label={`Nome do RPC ${rpc.name}`} value={rpc.name} onCommit={(name) => updateRpc(session, rpc.name, { name })}/>
      <SelectField label={`Quem recebe ${rpc.name}`} options={AUDIENCE_OPTIONS} value={rpc.audience} onChange={(audience) => updateRpc(session, rpc.name, { audience })}/>
      <span className="flex justify-center">
        <CheckBox label={`${rpc.name} com entrega garantida`} checked={rpc.reliable} onChange={(reliable) => updateRpc(session, rpc.name, { reliable })}/>
      </span>
      <span className="flex justify-center">
        <CheckBox label={`${rpc.name} exige a posse do objeto`} checked={rpc.requireOwnership} onChange={(requireOwnership) => updateRpc(session, rpc.name, { requireOwnership })}/>
      </span>
      <NumberField label={`Chamadas por segundo de ${rpc.name}`} value={rpc.perSecond} min={1} max={MAX_RPC_RATE} className="w-full" onCommit={(perSecond) => updateRpc(session, rpc.name, { perSecond })}/>
      <IconButton label={`Excluir o RPC ${rpc.name}`} size="xs" className="hover:text-destructive" onClick={() => removeRpc(session, rpc.name)}>
        <Trash2 />
      </IconButton>
    </li>);
}
export function RpcsView() {
    const session = useEditorSession();
    const { rpcs } = session.scene.multiplayer;
    return (<div className="h-full min-h-0 overflow-auto">
      <PanelSection title="RPCs declarados" description="Chamadas que os jogos trocam pela sessão. O servidor só aceita os nomes declarados aqui, confere o limite por segundo e a posse do objeto, e repassa a quem deve receber. Chamada fora da lista conta como abuso e derruba quem insiste." actions={<IconButton label="Declarar RPC" size="sm" disabled={!canAddRpc(session)} onClick={() => addRpc(session)}>
            <Plus />
          </IconButton>}>
        {rpcs.length === 0 ? (<SectionNote>Nenhum RPC declarado. Declare um para os jogadores avisarem uns aos outros de tiros, emotes, chat e outros eventos.</SectionNote>) : (<div className="min-w-[34rem]">
            <div className={`${COLUMNS_CLASS} px-1.5 pb-1 text-3xs text-muted-foreground`}>
              <span>Nome</span>
              <span>Quem recebe</span>
              <span className="text-center" title="Entrega garantida e em ordem; desligue para eventos frequentes em que só o mais novo importa">
                Garantido
              </span>
              <span className="text-center" title="Só quem tem a posse do objeto pode enviar este RPC a ele">
                Só o dono
              </span>
              <span title="Chamadas aceitas por segundo de cada jogador">Por segundo</span>
              <span aria-hidden/>
            </div>
            <ul className="flex flex-col gap-px">
              {rpcs.map((rpc) => (<RpcRow key={rpc.name} rpc={rpc}/>))}
            </ul>
          </div>)}
        <p className="font-mono text-3xs leading-relaxed text-muted-foreground">{"helix.multiplayer.rpc.send('nome', valor) · helix.multiplayer.rpc.on('nome', (remetente, valor) => { })"}</p>
      </PanelSection>
    </div>);
}
