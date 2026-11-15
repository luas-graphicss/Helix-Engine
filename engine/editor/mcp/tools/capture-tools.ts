import { clamp } from '@/engine/core/math/scalar';
import { ToolFailure } from '@/engine/editor/assistant/tools/tool-failure';
import { integer, parameters } from '@/engine/editor/assistant/tools/tool-parameters';
import type { McpTool } from './mcp-tool';
const DEFAULT_WIDTH = 960;
const MIN_WIDTH = 256;
const MAX_WIDTH = 1920;
const CAPTURE_FILE_NAME = 'viewport.jpg';
const captureViewport: McpTool = {
    name: 'capture_viewport',
    title: 'Capturar a viewport',
    access: 'read',
    description: 'Takes a screenshot of the 3D viewport as the user sees it, in edit mode or during the playtest, and returns it as a JPEG image. Use it to check the scene, the lighting or the running game. The editor tab must be visible with the scene workspace open.',
    parameters: parameters({ width: integer(`Image width in pixels, from ${MIN_WIDTH} to ${MAX_WIDTH}. Default ${DEFAULT_WIDTH}. Never larger than the viewport.`) }),
    async run({ session, files }, input) {
        const canvas = session.viewportCanvas;
        const widthLimit = canvas ? clamp(canvas.width, MIN_WIDTH, MAX_WIDTH) : MAX_WIDTH;
        const image = await session.capture.request(canvas, clamp(input.optionalInteger('width') ?? DEFAULT_WIDTH, MIN_WIDTH, widthLimit));
        if (!image)
            throw new ToolFailure('The viewport did not render a frame. Ask the user to keep the editor tab visible with the scene workspace open, then try again.');
        const attachment = await files.upload(image, CAPTURE_FILE_NAME);
        return { output: { file: attachment.fileId, bytes: attachment.size, playtest: session.playtest.state }, attachments: [attachment] };
    },
};
export const CAPTURE_TOOLS: readonly McpTool[] = [captureViewport];
