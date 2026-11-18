import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import { downloadFile } from '../transport/source-request';
const THUMBNAIL_LIMIT_BYTES = 4 * 1024 * 1024;
const THUMBNAIL_FILE_NAME = 'thumbnail';
export async function loadThumbnail(url: URL | null): Promise<ImageBitmap | null> {
    if (!url)
        return null;
    try {
        return await createImageBitmap(await downloadFile(url, THUMBNAIL_FILE_NAME, THUMBNAIL_LIMIT_BYTES));
    }
    catch (cause) {
        if (cause instanceof ToolFailure || cause instanceof DOMException)
            return null;
        throw cause;
    }
}
