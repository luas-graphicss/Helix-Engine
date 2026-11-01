import Link from 'next/link';
import type { SectionTree } from '../content/docs-content';
import { DocsIcon } from '../navigation/docs-icons';
import { DocsHero } from './docs-hero';
const NAMING_CONVENTIONS: readonly {
    readonly languages: string;
    readonly form: string;
}[] = [
    { languages: 'Luau, Lua, JavaScript, TypeScript, Python, Ruby, PHP, Dart, GDScript', form: 'helix.scene.spawn("mesh", { name = "Caixa" })' },
    { languages: 'C#, Java, Kotlin, Swift, Haxe', form: 'Helix.Scene.Spawn("mesh", new SpawnOptions { Name = "Caixa" })' },
    { languages: 'C, C++, Rust, Zig, Go', form: 'helix_scene_spawn(HELIX_MESH, &options) / helix::scene::spawn(Kind::Mesh, options)' },
];
export function ReferenceHome({ tree }: {
    tree: SectionTree;
}) {
    return (<div className="flex flex-col gap-14 py-8 lg:py-10 lg:pl-10">
      <DocsHero eyebrow="Referência" title={tree.section.title} description={tree.section.description}>
        <div className="overflow-hidden rounded-md border border-border-strong bg-surface-sunken shadow-well">
          <table className="w-full text-sm">
            <caption className="sr-only">Forma do namespace helix em cada família de linguagens</caption>
            <thead>
              <tr className="border-b border-border-strong bg-surface text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-medium">
                  Linguagens
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Forma
                </th>
              </tr>
            </thead>
            <tbody>
              {NAMING_CONVENTIONS.map((row) => (<tr key={row.languages} className="border-b border-border-strong last:border-0">
                  <td className="px-4 py-2.5 align-top text-muted-foreground">{row.languages}</td>
                  <td className="px-4 py-2.5 align-top font-mono text-xs text-foreground">{row.form}</td>
                </tr>))}
            </tbody>
          </table>
        </div>
      </DocsHero>

      <section className="grid gap-4 md:grid-cols-2">
        {tree.categories.map((category) => (<div key={category.category.id} className="flex flex-col gap-4 rounded-md border border-border-strong bg-surface p-5 shadow-bevel">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-border-strong bg-surface-sunken text-primary shadow-well">
                <DocsIcon id={category.category.icon} className="size-[18px]"/>
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="font-medium text-foreground">
                  <Link href={category.path} className="hover:text-primary">
                    {category.category.title}
                  </Link>
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{category.category.description}</p>
              </div>
            </div>
            <ul className="flex flex-col divide-y divide-border-strong border-t border-border-strong">
              {category.articles.map((article) => (<li key={article.slug}>
                  <Link href={article.path} className="flex items-baseline justify-between gap-4 py-2 text-sm transition-colors hover:text-primary">
                    <span className="font-mono text-[0.8125rem] text-foreground">{article.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{article.description}</span>
                  </Link>
                </li>))}
            </ul>
          </div>))}
      </section>
    </div>);
}
