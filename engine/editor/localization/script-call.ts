import type { MessageArgument } from '@/engine/localization/message/message-arguments';
export function translationCall(key: string, args: readonly MessageArgument[]): string {
    const names = args.map((argument) => argument.name).join(', ');
    return names === '' ? `helix.localization.t('${key}')` : `helix.localization.t('${key}', { ${names} })`;
}
