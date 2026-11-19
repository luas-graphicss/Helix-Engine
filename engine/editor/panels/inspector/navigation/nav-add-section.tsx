'use client';
import { Bot, Construction, Route, Spline, SquareDashed } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Entity } from '@/engine/core/scene/entity';
import { addNavAgent, canAddNavAgent } from '@/engine/editor/operations/navigation/nav-agent-operations';
import { addNavLink, canAddNavLink } from '@/engine/editor/operations/navigation/nav-link-operations';
import { addNavModifier, canAddNavModifier } from '@/engine/editor/operations/navigation/nav-modifier-operations';
import { addNavObstacle, canAddNavObstacle } from '@/engine/editor/operations/navigation/nav-obstacle-operations';
import { addNavSurface, canAddNavSurface } from '@/engine/editor/operations/navigation/nav-surface-operations';
import type { EditorSession } from '@/engine/editor/session/editor-session';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { ActionButton, ActionRow } from '@/engine/ui/action-button';
import { CollapsibleSection } from '@/engine/ui/collapsible-section';
import { NAV_HINT_CLASS } from './nav-field-styles';
interface NavComponentChoice {
    readonly label: string;
    readonly hint: string;
    readonly icon: LucideIcon;
    readonly canAdd: (entity: Entity) => boolean;
    readonly add: (session: EditorSession, entity: Entity) => void;
}
const CHOICES: readonly NavComponentChoice[] = [
    { label: 'Agente', hint: 'Anda pelo NavMesh até um destino, desviando de outros agentes e de obstáculos', icon: Bot, canAdd: canAddNavAgent, add: addNavAgent },
    { label: 'Obstáculo', hint: 'Os agentes contornam este ator, que também pode recortar o NavMesh', icon: Construction, canAdd: canAddNavObstacle, add: addNavObstacle },
    { label: 'Modificador', hint: 'Muda a área da geometria deste ator no NavMesh, ou a tira da malha', icon: SquareDashed, canAdd: canAddNavModifier, add: addNavModifier },
    { label: 'Link', hint: 'Liga dois pontos que a malha não conecta: saltos, escadas e portas', icon: Spline, canAdd: canAddNavLink, add: addNavLink },
    { label: 'Surface', hint: 'Gera o NavMesh a partir deste ator: da cena, dos filhos ou de um volume', icon: Route, canAdd: canAddNavSurface, add: addNavSurface },
];
export function NavAddSection({ entity }: {
    entity: Entity;
}) {
    const session = useEditorSession();
    const choices = CHOICES.filter((choice) => choice.canAdd(entity));
    if (choices.length === 0)
        return null;
    return (<CollapsibleSection title="Navegação" defaultOpen={false}>
      <p className={NAV_HINT_CLASS}>Componentes de navegação que este ator pode receber. Passe o mouse em cada um para ver o que faz.</p>
      <ActionRow>
        {choices.map(({ label, hint, icon, add }) => (<ActionButton key={label} icon={icon} title={hint} onClick={() => add(session, entity)}>
            {label}
          </ActionButton>))}
      </ActionRow>
    </CollapsibleSection>);
}
