type VendorModuleImporter = (url: string) => Promise<unknown>;
let importer: VendorModuleImporter | null = null;
export function importVendorModule<TModule = unknown>(url: string): Promise<TModule> {
    importer ??= new Function('url', 'return import(url);') as VendorModuleImporter;
    return importer(url) as Promise<TModule>;
}
