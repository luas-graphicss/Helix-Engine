'use client';
import type { MultiplayerStatus } from '@/engine/editor/multiplayer/use-multiplayer-status';
import type { ConnectionStats } from '@/engine/net/connection/connection';
import { formatBitRate, formatBytes, formatMilliseconds, formatPercent } from '../shared/format';
import { PanelSection, SectionNote } from '../shared/panel-section';
import { ReadoutList, type Readout } from '../shared/readout-list';
function rate(bytesPerSecond: number, packetsPerSecond: number): string {
    return `${formatBitRate(bytesPerSecond)} · ${Math.round(packetsPerSecond)} pacotes/s`;
}
function trafficReadouts(status: MultiplayerStatus, stats: ConnectionStats): Readout[] {
    return [
        { label: 'Jogadores na sessão', value: status.players.length },
        { label: 'Objetos de rede', value: status.objects, hint: 'Objetos da sessão ligados a atores desta máquina' },
        { label: 'Ida e volta', value: formatMilliseconds(stats.roundTripMs), hint: 'Tempo de um pacote ir ao servidor e a confirmação voltar' },
        { label: 'Variação', value: formatMilliseconds(stats.jitterMs), hint: 'Oscilação do tempo de ida e volta' },
        { label: 'Perda', value: formatPercent(stats.lossRate), hint: 'Pacotes enviados que não foram confirmados' },
        { label: 'Envio', value: rate(stats.bytesSentPerSecond, stats.packetsSentPerSecond) },
        { label: 'Recebimento', value: rate(stats.bytesReceivedPerSecond, stats.packetsReceivedPerSecond) },
        { label: 'Fila confiável', value: formatBytes(stats.backlogBytes), hint: 'Dados confiáveis esperando para sair; cresce quando a ligação não dá vazão' },
        { label: 'Reenvios', value: stats.resentFrames.toLocaleString('pt-BR'), hint: 'Quadros confiáveis reenviados depois de uma perda' },
        { label: 'Total enviado', value: formatBytes(stats.totalBytesSent) },
        { label: 'Total recebido', value: formatBytes(stats.totalBytesReceived) },
    ];
}
export function TrafficSection({ status }: {
    status: MultiplayerStatus;
}) {
    const { stats } = status;
    return (<PanelSection title="Tráfego" description="A ligação deste jogo com a sessão, medida pelo próprio transporte.">
      {stats ? <ReadoutList items={trafficReadouts(status, stats)}/> : <SectionNote>Os números aparecem quando o jogo está conectado a uma sessão.</SectionNote>}
    </PanelSection>);
}
