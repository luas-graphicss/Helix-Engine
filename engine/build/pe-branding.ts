import * as ResEdit from 'resedit';
export interface WindowsBranding {
    readonly productName: string;
    readonly description: string;
    readonly company: string;
    readonly version: string;
    readonly originalFilename: string;
    readonly iconPng: Uint8Array | null;
}
function versionParts(version: string): [
    number,
    number,
    number,
    number
] {
    const parts = version.split('.').map((part) => Number.parseInt(part, 10));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0, parts[3] || 0];
}
export function pngToIco(png: Uint8Array, size: number): Uint8Array {
    const ico = new Uint8Array(6 + 16 + png.length);
    const view = new DataView(ico.buffer);
    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, 1, true);
    ico[6] = size >= 256 ? 0 : size;
    ico[7] = size >= 256 ? 0 : size;
    ico[8] = 0;
    ico[9] = 0;
    view.setUint16(10, 1, true);
    view.setUint16(12, 32, true);
    view.setUint32(14, png.length, true);
    view.setUint32(18, 22, true);
    ico.set(png, 22);
    return ico;
}
function exactBuffer(bytes: Uint8Array): ArrayBuffer {
    if (bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength && bytes.buffer instanceof ArrayBuffer)
        return bytes.buffer;
    return bytes.slice().buffer as ArrayBuffer;
}
export interface BrandingReport {
    readonly iconReplaced: boolean;
    readonly versionInfoWritten: boolean;
}
export function brandWindowsExecutable(exe: Uint8Array, branding: WindowsBranding, iconSize = 256): {
    bytes: Uint8Array;
    report: BrandingReport;
} {
    const executable = ResEdit.NtExecutable.from(exactBuffer(exe), { ignoreCert: true });
    const resource = ResEdit.NtExecutableResource.from(executable);
    const infos = ResEdit.Resource.VersionInfo.fromEntries(resource.entries);
    const info = infos[0] ?? ResEdit.Resource.VersionInfo.createEmpty();
    const language = info.getAllLanguagesForStringValues()[0] ?? { lang: 1033, codepage: 1200 };
    const [major, minor, micro, revision] = versionParts(branding.version);
    info.setFileVersion(major, minor, micro, revision, language.lang);
    info.setProductVersion(major, minor, micro, revision, language.lang);
    const versionText = `${major}.${minor}.${micro}.${revision}`;
    info.setStringValues(language, {
        ProductName: branding.productName,
        FileDescription: branding.description,
        CompanyName: branding.company,
        LegalCopyright: `© ${new Date().getFullYear()} ${branding.company}`,
        OriginalFilename: branding.originalFilename,
        InternalName: branding.productName,
        FileVersion: versionText,
        ProductVersion: versionText,
    });
    info.outputToResourceEntries(resource.entries);
    let iconReplaced = false;
    if (branding.iconPng) {
        const groups = ResEdit.Resource.IconGroupEntry.fromEntries(resource.entries);
        const target = groups[0];
        const icon = ResEdit.Data.IconFile.from(exactBuffer(pngToIco(branding.iconPng, iconSize)));
        ResEdit.Resource.IconGroupEntry.replaceIconsForResource(resource.entries, target?.id ?? 1, target?.lang ?? language.lang, icon.icons.map((item) => item.data));
        iconReplaced = true;
    }
    resource.outputResource(executable);
    return { bytes: new Uint8Array(executable.generate()), report: { iconReplaced, versionInfoWritten: true } };
}
