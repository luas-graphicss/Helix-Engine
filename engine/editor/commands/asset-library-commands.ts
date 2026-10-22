import type { ImportedScene } from '@/engine/assets/import/import-types';
import type { AssetLibrary } from '@/engine/assets/library/asset-library';
import type { AssetSnapshot } from '@/engine/assets/library/asset-types';
import type { Command } from '@/engine/editor/history/command';
export class AddAssetCommand implements Command {
    readonly label: string;
    constructor(private readonly library: AssetLibrary, private readonly snapshot: AssetSnapshot, private readonly scene: ImportedScene | null = null) {
        this.label = `Adicionar ${snapshot.asset.name} à biblioteca`;
    }
    execute(): void {
        this.library.add(this.snapshot, this.scene);
    }
    undo(): void {
        this.library.remove(this.snapshot.asset.id);
    }
}
export class ReplaceAssetCommand implements Command {
    readonly label: string;
    constructor(private readonly library: AssetLibrary, private readonly before: AssetSnapshot, private readonly after: AssetSnapshot) {
        this.label = `Salvar ${after.asset.name} na biblioteca`;
    }
    execute(): void {
        this.library.remove(this.before.asset.id);
        this.library.add(this.after);
    }
    undo(): void {
        this.library.remove(this.after.asset.id);
        this.library.add(this.before);
    }
}
export class RemoveAssetCommand implements Command {
    readonly label: string;
    constructor(private readonly library: AssetLibrary, private readonly snapshot: AssetSnapshot) {
        this.label = `Remover ${snapshot.asset.name} da biblioteca`;
    }
    execute(): void {
        this.library.remove(this.snapshot.asset.id);
    }
    undo(): void {
        this.library.add(this.snapshot);
    }
}
