'use client';
import { useHub } from '../hub-context';
import { ConfirmDialog } from './confirm-dialog';
import { HistoryDialog } from './history-dialog';
import { RenameDialog } from './rename-dialog';
import { TransferDialog } from './transfer-dialog';
export function HubDialogs() {
    const { dialog, setDialog, actions, registry } = useHub();
    const close = () => setDialog(null);
    switch (dialog?.kind) {
        case 'rename':
            return <RenameDialog key={dialog.record.id} record={dialog.record} onClose={close}/>;
        case 'purge':
            return (<ConfirmDialog title={`Excluir "${dialog.record.name}" permanentemente?`} description="A cena, os materiais e os ativos deste jogo serão apagados deste navegador. Não há como desfazer; se quiser uma cópia, exporte o arquivo antes." confirmLabel="Excluir permanentemente" onConfirm={() => actions.purge(dialog.record)} onClose={close}/>);
        case 'empty-trash':
            return (<ConfirmDialog title={`Esvaziar a lixeira (${registry.trashed.length})?`} description="Todos os jogos na lixeira serão apagados deste navegador, com cenas, materiais e ativos. Não há como desfazer." confirmLabel="Esvaziar lixeira" onConfirm={() => actions.emptyTrash()} onClose={close}/>);
        case 'history':
            return <HistoryDialog key={dialog.record.id} record={dialog.record} onClose={close}/>;
        case 'transfer':
            return <TransferDialog job={dialog.job} onClose={close}/>;
        default:
            return null;
    }
}
