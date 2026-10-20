import type { Command } from '@/engine/editor/history/command';
import type { Entity } from '@/engine/core/scene/entity';
export class AddEntityCommand implements Command {
    constructor(readonly label: string, private readonly entity: Entity, private readonly parent: Entity, private readonly index: number = parent.children.length) { }
    execute(): void {
        this.parent.insert(this.entity, this.index);
    }
    undo(): void {
        this.parent.remove(this.entity);
    }
}
export class RemoveEntityCommand implements Command {
    readonly label: string;
    private readonly parent: Entity;
    private readonly index: number;
    constructor(private readonly entity: Entity) {
        if (!entity.parent)
            throw new Error('A raiz da cena não pode ser removida.');
        this.label = `Excluir ${entity.name}`;
        this.parent = entity.parent;
        this.index = entity.parent.children.indexOf(entity);
    }
    execute(): void {
        this.parent.remove(this.entity);
    }
    undo(): void {
        this.parent.insert(this.entity, this.index);
    }
}
export class ReparentEntityCommand implements Command {
    readonly label: string;
    private readonly oldParent: Entity;
    private readonly oldIndex: number;
    constructor(private readonly entity: Entity, private readonly newParent: Entity, private readonly newIndex: number) {
        if (!entity.parent)
            throw new Error('A raiz da cena não pode ser movida.');
        if (entity.contains(newParent))
            throw new Error('Uma entidade não pode ser filha de si mesma.');
        this.label = `Mover ${entity.name}`;
        this.oldParent = entity.parent;
        this.oldIndex = entity.parent.children.indexOf(entity);
    }
    execute(): void {
        this.oldParent.remove(this.entity);
        this.newParent.insert(this.entity, this.newIndex);
    }
    undo(): void {
        this.newParent.remove(this.entity);
        this.oldParent.insert(this.entity, this.oldIndex);
    }
}
