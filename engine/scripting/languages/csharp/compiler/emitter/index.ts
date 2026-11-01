import { JsWriter } from '../../../../compiler/js-writer';
import { BUILTIN_MODULE_NAME } from '../../runtime';
import { EmitContext, INDENT, q, type EmitInput, type EmitOutput } from './context';
import { classLines, enumLines, nestedTypeLines, staticInitializerLines } from './declarations';
export type { EmitInput, EmitOutput } from './context';
export function emit(input: EmitInput): EmitOutput {
    const ctx = new EmitContext(input);
    const { program } = input;
    const lines: string[] = [`const $ = require(${q(BUILTIN_MODULE_NAME)}).module(helix, require, console, module);`];
    for (const ref of program.siblingTypes)
        lines.push(`const ${ref.alias} = $.sibling(${q(ref.script)}, ${q(ref.type)});`);
    lines.push('');
    for (const info of program.enums)
        lines.push(...enumLines(ctx, info));
    if (program.enums.length > 0)
        lines.push('');
    for (const cls of program.classes)
        lines.push(...classLines(ctx, cls), '');
    lines.push(...nestedTypeLines(ctx), ...staticInitializerLines(ctx));
    const writer = new JsWriter(input.fileName, input.source, INDENT);
    writer.write(lines.join('\n'));
    return { code: writer.toCode(), sourceMap: writer.toSourceMap() };
}
