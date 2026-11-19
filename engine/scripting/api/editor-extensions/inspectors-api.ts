import type { Entity } from '@/engine/core/scene/entity';
import { GuiSurface } from '@/engine/editor/extensions/gui/gui-surface';
import type { InspectorContribution } from '@/engine/editor/extensions/inspectors/inspector-contribution';
import { inspectorTargets, type InspectorScope } from '@/engine/editor/extensions/inspectors/inspector-targets';
import { HelixError } from '../../runtime/script-errors';
import { optionalNumber, requireFunction, requireObject, requireString } from '../../runtime/values';
import { entityFilterOf } from './entity-filter-options';
import { requireContributionId, type ExtensionApiContext } from './extension-api-context';
import { createGuiBuilder, type EditorGui } from './gui-api';
type InspectorGui = (ui: EditorGui, actors: Entity[]) => void;
export function createInspectorsApi(context: ExtensionApiContext) {
    const { host, extensions } = context;
    const { inspectors } = extensions;
    const find = (id: unknown, member: string): InspectorContribution => {
        const key = requireContributionId(id, member);
        const inspector = inspectors.get(key);
        if (!inspector)
            throw new HelixError(`${member}: o inspetor "${key}" não está registrado.`);
        return inspector;
    };
    return {
        register: (id: unknown, options: unknown) => {
            const member = 'helix.editor.inspectors.register';
            const key = requireContributionId(id, member);
            const settings = requireObject(options, member);
            const onGui = requireFunction<InspectorGui>(settings.onGui, member, 'onGui');
            const owner = host.current;
            const label = `inspetor "${key}"`;
            const scope: InspectorScope = { ...entityFilterOf(context, owner, settings, member, label), multiple: settings.multiple === true };
            const surface = new GuiSurface((frame) => onGui(createGuiBuilder(host, frame), inspectorTargets(scope, host.session.selectedEntities())), (render) => context.run(owner, label, render));
            const inspector: InspectorContribution = {
                ...scope,
                id: key,
                title: settings.title === undefined ? key : requireString(settings.title, member, 'o título'),
                order: optionalNumber(settings.order, 0, member, 'a ordem'),
                defaultOpen: settings.open !== false,
                surface,
            };
            const unregister = context.own(inspectors.register(inspector, context.ownerAssetId()));
            return {
                id: key,
                repaint: () => surface.requestRepaint(),
                unregister,
            };
        },
        unregister: (id: unknown) => inspectors.unregister(requireContributionId(id, 'helix.editor.inspectors.unregister')),
        repaint: (id: unknown) => find(id, 'helix.editor.inspectors.repaint').surface.requestRepaint(),
        list: () => inspectors.list().map((inspector) => ({ id: inspector.id, title: inspector.title })),
    };
}
