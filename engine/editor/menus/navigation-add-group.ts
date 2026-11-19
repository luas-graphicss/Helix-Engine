import { Bot, Construction, Route, Spline, SquareDashed } from 'lucide-react';
import { addNavAgentActor } from '@/engine/editor/operations/navigation/nav-agent-operations';
import { addNavLinkActor } from '@/engine/editor/operations/navigation/nav-link-operations';
import { addNavModifierActor } from '@/engine/editor/operations/navigation/nav-modifier-operations';
import { addNavObstacleActor } from '@/engine/editor/operations/navigation/nav-obstacle-operations';
import { addNavSurfaceActor } from '@/engine/editor/operations/navigation/nav-surface-operations';
import type { AddMenuGroup } from './add-entity-model';
export const NAVIGATION_ADD_GROUP: AddMenuGroup = {
    id: 'navigation',
    label: 'Navegação',
    icon: Route,
    entries: [
        {
            id: 'nav-surface',
            label: 'NavMesh Surface',
            description: 'Gera a malha caminhável a partir da geometria parada da cena; o botão Gerar NavMesh fica no Inspetor',
            icon: Route,
            run: (session) => {
                addNavSurfaceActor(session);
            },
        },
        {
            id: 'nav-agent',
            label: 'Agente',
            description: 'NPC em cápsula que anda pelo NavMesh até um destino, desviando de outros agentes e de obstáculos',
            icon: Bot,
            run: (session) => {
                addNavAgentActor(session);
            },
        },
        {
            id: 'nav-obstacle',
            label: 'Obstáculo',
            description: 'Caixa que os agentes contornam e que recorta o NavMesh quando fica parada',
            icon: Construction,
            run: (session) => {
                addNavObstacleActor(session);
            },
        },
        {
            id: 'nav-link',
            label: 'Off-Mesh Link',
            description: 'Liga dois pontos que a malha não conecta: saltos, escadas, portas e teleportes',
            icon: Spline,
            run: (session) => {
                addNavLinkActor(session);
            },
        },
        {
            id: 'nav-modifier',
            label: 'Volume de área',
            description: 'Caixa que troca a área do NavMesh dentro dela: bloqueia, encarece ou barateia a passagem',
            icon: SquareDashed,
            run: (session) => {
                addNavModifierActor(session);
            },
        },
    ],
};
