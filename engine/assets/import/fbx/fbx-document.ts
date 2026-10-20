import { FbxProperties, findChild, findChildren, propString, stripClassPrefix, type FbxNode, type FbxValue } from './fbx-node';
const ROOT_IDS = new Set(['0', 'Model::Scene']);
export interface FbxObject {
    id: string;
    name: string;
    className: string;
    subClass: string;
    node: FbxNode;
    properties: FbxProperties;
}
export interface FbxConnection {
    child: string;
    parent: string;
    property: string | null;
}
function idToString(value: FbxValue | undefined): string {
    if (typeof value === 'number' || typeof value === 'string')
        return String(value);
    return '';
}
function readObject(node: FbxNode, legacy: boolean): FbxObject | null {
    if (legacy) {
        const fullName = propString(node, 0);
        if (!fullName)
            return null;
        return { id: fullName, name: stripClassPrefix(fullName), className: node.name, subClass: propString(node, 1), node, properties: FbxProperties.fromNode(node) };
    }
    const id = idToString(node.props[0]);
    if (!id)
        return null;
    return { id, name: stripClassPrefix(propString(node, 1)), className: node.name, subClass: propString(node, 2), node, properties: FbxProperties.fromNode(node) };
}
function readConnection(node: FbxNode): FbxConnection | null {
    const kind = propString(node, 0);
    const child = idToString(node.props[1]);
    const parent = idToString(node.props[2]);
    if (!child || !parent)
        return null;
    if (kind === 'OO')
        return { child, parent, property: null };
    if (kind === 'OP')
        return { child, parent, property: propString(node, 3) || null };
    return null;
}
export class FbxDocument {
    readonly objects = new Map<string, FbxObject>();
    readonly globalSettings: FbxProperties;
    private readonly childrenByParent = new Map<string, FbxConnection[]>();
    private readonly parentsByChild = new Map<string, FbxConnection[]>();
    constructor(readonly root: FbxNode, readonly version: number) {
        const legacy = version < 7000;
        const objectsNode = findChild(root, 'Objects');
        for (const node of objectsNode?.children ?? []) {
            const object = readObject(node, legacy);
            if (object)
                this.objects.set(object.id, object);
        }
        const connectionsNode = findChild(root, 'Connections');
        for (const node of connectionsNode?.children ?? []) {
            if (node.name !== 'C' && node.name !== 'Connect')
                continue;
            const connection = readConnection(node);
            if (!connection)
                continue;
            this.append(this.childrenByParent, connection.parent, connection);
            this.append(this.parentsByChild, connection.child, connection);
        }
        this.globalSettings = FbxProperties.fromNode(findChild(root, 'GlobalSettings'));
    }
    private append(map: Map<string, FbxConnection[]>, key: string, connection: FbxConnection): void {
        const list = map.get(key);
        if (list)
            list.push(connection);
        else
            map.set(key, [connection]);
    }
    get(id: string): FbxObject | null {
        return this.objects.get(id) ?? null;
    }
    byClass(className: string): FbxObject[] {
        return Array.from(this.objects.values()).filter((object) => object.className === className);
    }
    children(parentId: string, className?: string): FbxObject[] {
        const result: FbxObject[] = [];
        for (const connection of this.childrenByParent.get(parentId) ?? []) {
            if (connection.property !== null)
                continue;
            const object = this.objects.get(connection.child);
            if (object && (!className || object.className === className))
                result.push(object);
        }
        return result;
    }
    propertyConnections(parentId: string): Array<{
        object: FbxObject;
        property: string;
    }> {
        const result: Array<{
            object: FbxObject;
            property: string;
        }> = [];
        for (const connection of this.childrenByParent.get(parentId) ?? []) {
            if (connection.property === null)
                continue;
            const object = this.objects.get(connection.child);
            if (object)
                result.push({ object, property: connection.property });
        }
        return result;
    }
    hasParent(childId: string): boolean {
        return (this.parentsByChild.get(childId) ?? []).some((connection) => connection.property === null);
    }
    rootModels(): FbxObject[] {
        const models = this.byClass('Model');
        const linkedToRoot = models.filter((model) => (this.parentsByChild.get(model.id) ?? []).some((connection) => ROOT_IDS.has(connection.parent)));
        const orphans = models.filter((model) => !this.hasParent(model.id));
        const roots = Array.from(new Set([...linkedToRoot, ...orphans]));
        return roots.sort((a, b) => models.indexOf(a) - models.indexOf(b));
    }
    count(className: string): number {
        return this.byClass(className).length;
    }
    topLevel(name: string): FbxNode[] {
        return findChildren(this.root, name);
    }
}
