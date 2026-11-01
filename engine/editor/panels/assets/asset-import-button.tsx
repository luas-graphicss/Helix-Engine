'use client';
import { FolderInput } from 'lucide-react';
import type { AssetKind, LibraryAsset } from '@/engine/assets/library/asset-types';
import { importLibraryAssetOfKind } from '@/engine/editor/operations/asset-library-operations';
import { useEditorSession } from '@/engine/editor/session/editor-session-context';
import { IconButton } from '@/engine/ui/icon-button';
type AssetImportButtonProps = {
    kind: AssetKind;
    label: string;
    accept?: string;
    disabled?: boolean;
    onImported: (asset: LibraryAsset) => void;
};
export function AssetImportButton({ kind, label, accept, disabled, onImported }: AssetImportButtonProps) {
    const session = useEditorSession();
    const importAndApply = async () => {
        const asset = await importLibraryAssetOfKind(session, kind, accept);
        if (asset)
            onImported(asset);
    };
    return (<IconButton size="sm" label={label} disabled={disabled} onClick={() => void importAndApply()}>
      <FolderInput aria-hidden/>
    </IconButton>);
}
