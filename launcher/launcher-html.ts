import type { SourceEntryStats, SourceManifest } from './source-manifest';
export const LAUNCHER_PREFIX = '/__launcher';
export const LAUNCHER_ZIP_PATH = `${LAUNCHER_PREFIX}/source-zip`;
export const LAUNCHER_CSS_PATH = `${LAUNCHER_PREFIX}/launcher.css`;
export const LAUNCHER_SCRIPT_PATH = `${LAUNCHER_PREFIX}/launcher.js`;
export const LAUNCHER_TOKEN_COOKIE = 'helix_zip_token';
const relativeTime = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
const integer = new Intl.NumberFormat('pt-BR');
export function formatBytes(bytes: number): string {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
function formatRelative(epochMs: number, now: number): string {
    if (epochMs <= 0)
        return '—';
    const seconds = Math.round((epochMs - now) / 1000);
    if (Math.abs(seconds) < 60)
        return relativeTime.format(seconds, 'second');
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60)
        return relativeTime.format(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24)
        return relativeTime.format(hours, 'hour');
    return relativeTime.format(Math.round(hours / 24), 'day');
}
function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const BRAND_MARK_SVG = `<svg viewBox="0 0 32 32" aria-hidden="true"><polygon points="1.8,16 8.9,3.7 23.1,3.7 30.2,16 23.1,28.3 8.9,28.3" fill="var(--launcher-brand)" stroke="var(--launcher-brand)" stroke-width="2" stroke-linejoin="round"/><g fill="var(--launcher-brand-fg)"><rect x="6.9" y="8.4" width="4.8" height="15.2"/><rect x="20.3" y="8.4" width="4.8" height="15.2"/><polygon points="7.3,16.22 24.7,11.29 24.7,15.78 7.3,20.71"/></g></svg>`;
const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" />`;
function renderRow(entry: SourceEntryStats, now: number): string {
    const classes = [entry.assets ? 'row-assets' : '', entry.present ? '' : 'row-dim'].filter(Boolean).join(' ');
    const tags = [entry.assets ? '<span class="tag">ativos</span>' : '', entry.present ? '' : '<span class="tag tag-missing">ausente</span>'].join('');
    return `
            <tr${classes ? ` class="${classes}"` : ''}>
              <td><code>${escapeHtml(entry.path)}</code>${tags}</td>
              <td class="col-description">${escapeHtml(entry.description)}</td>
              <td class="num">${entry.present ? integer.format(entry.files) : '—'}</td>
              <td class="num">${entry.present ? formatBytes(entry.bytes) : '—'}</td>
              <td class="num">${formatRelative(entry.modifiedAt, now)}</td>
            </tr>`;
}
export function renderLauncherHtml(manifest: SourceManifest): string {
    const now = manifest.generatedAt;
    const assetsBytes = manifest.totalBytes - manifest.codeBytes;
    const rows = manifest.entries.map((entry) => renderRow(entry, now)).join('');
    return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="theme-color" content="#101114" />
    <title>Helix Engine — Launcher</title>
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    ${FONT_LINKS}
    <link rel="stylesheet" href="${LAUNCHER_CSS_PATH}" />
  </head>
  <body>
    <main
      class="launcher"
      data-zip-path="${LAUNCHER_ZIP_PATH}"
      data-token-cookie="${LAUNCHER_TOKEN_COOKIE}"
      data-total-files="${manifest.totalFiles}"
      data-total-bytes="${manifest.totalBytes}"
      data-code-files="${manifest.codeFiles}"
      data-code-bytes="${manifest.codeBytes}"
    >
      <header class="launcher-header">
        <div class="brand">
          <span class="brand-mark" aria-hidden="true">${BRAND_MARK_SVG}</span>
          <span class="brand-name">Helix Engine</span>
          <span class="badge">launcher · fora da engine</span>
        </div>
        <h1>Baixar e gerenciar a engine</h1>
        <p class="lede">
          Esta página é servida pelo <code>proxy.ts</code>, antes de qualquer rota do Next, e não importa nada de <code>engine/</code>.
          Se o editor parar de compilar, o download continua funcionando e o zip sai com os arquivos exatamente como estão no disco.
        </p>
      </header>

      <section class="actions" aria-label="Ações">
        <a class="button button-ghost" href="/editor">
          Abrir editor
          <span class="button-hint">/editor</span>
        </a>

        <div class="download">
          <a class="button button-primary" href="${LAUNCHER_ZIP_PATH}?assets=1" download data-download>
            <span data-download-label>Baixar código-fonte (.zip)</span>
            <span class="button-hint"><span data-package-summary>${integer.format(manifest.totalFiles)} arquivos · ${formatBytes(manifest.totalBytes)}</span> antes de comprimir</span>
          </a>
          <label class="checkbox">
            <input type="checkbox" checked data-include-assets />
            <span>Incluir ativos de <code>public/</code> <span class="muted">(texturas, modelos, fixtures · ${formatBytes(assetsBytes)})</span></span>
          </label>
          <p class="status" role="status" aria-live="polite" data-status>O pacote é montado na hora, lendo o disco; quem baixa é o próprio navegador.</p>
          <div class="fallback" data-fallback>
            <p class="fallback-title">O download não começou?</p>
            <ul>
              <li>Clique com o botão direito em <a href="${LAUNCHER_ZIP_PATH}?assets=1" download data-direct-link>helix-engine.zip</a> e escolha <strong>Salvar link como…</strong></li>
              <li>Ou <a href="${LAUNCHER_ZIP_PATH}?assets=1" download target="_blank" rel="noopener" data-direct-link>abra o zip em uma nova aba</a> — fora de pré-visualizações embutidas o navegador sempre baixa.</li>
              <li>Ou cole a URL em uma aba nova: <code data-zip-url>${LAUNCHER_ZIP_PATH}?assets=1</code> <button type="button" class="link" data-copy-url>Copiar</button></li>
            </ul>
          </div>
        </div>
      </section>

      <section class="manifest" aria-labelledby="manifest-title">
        <div class="section-head">
          <h2 id="manifest-title">Conteúdo do pacote</h2>
          <a class="link" href="/">Reler o disco</a>
        </div>
        <table>
          <thead>
            <tr>
              <th scope="col">Entrada</th>
              <th scope="col" class="col-description">Descrição</th>
              <th scope="col" class="num">Arquivos</th>
              <th scope="col" class="num">Tamanho</th>
              <th scope="col" class="num">Modificado</th>
            </tr>
          </thead>
          <tbody>${rows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2">Total do pacote atual</td>
              <td class="num" data-total-files-cell>${integer.format(manifest.totalFiles)}</td>
              <td class="num" data-total-bytes-cell>${formatBytes(manifest.totalBytes)}</td>
              <td class="num">${formatRelative(manifest.modifiedAt, now)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section class="notes" aria-labelledby="notes-title">
        <h2 id="notes-title">Convenção para quem for servir este projeto</h2>
        <ul>
          <li><code>/</code> é esta página. É ela que o preview deve mostrar: ela não depende do código da engine.</li>
          <li><code>/editor</code> é a engine. Nenhum botão dentro dela leva de volta para cá; o único caminho é a URL.</li>
          <li><code>${LAUNCHER_ZIP_PATH}</code> monta o zip a partir de <code>launcher/source-entries.ts</code>, lendo o disco como está — compile ou não.</li>
          <li>Tudo isto (<code>proxy.ts</code> e <code>launcher/</code>) vai dentro do zip, pronto para ser servido de novo sem recriar nada.</li>
        </ul>
      </section>
    </main>
    <script src="${LAUNCHER_SCRIPT_PATH}" defer></script>
  </body>
</html>
`;
}
export function renderLauncherErrorHtml(title: string, message: string): string {
    return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="theme-color" content="#101114" />
    <title>Helix Engine — Launcher</title>
    ${FONT_LINKS}
    <link rel="stylesheet" href="${LAUNCHER_CSS_PATH}" />
  </head>
  <body>
    <main class="launcher">
      <header class="launcher-header">
        <div class="brand"><span class="brand-mark" aria-hidden="true">${BRAND_MARK_SVG}</span><span class="brand-name">Helix Engine</span><span class="badge">launcher</span></div>
        <h1>${escapeHtml(title)}</h1>
        <p class="lede error">${escapeHtml(message)}</p>
      </header>
      <section class="actions" aria-label="Ações">
        <a class="button button-ghost" href="/">Voltar ao launcher<span class="button-hint">/</span></a>
        <div class="download">
          <a class="button button-primary" href="${LAUNCHER_ZIP_PATH}" download>Tentar baixar o zip de novo<span class="button-hint">${LAUNCHER_ZIP_PATH}</span></a>
          <a class="button button-ghost" href="/editor">Abrir editor<span class="button-hint">/editor</span></a>
        </div>
      </section>
    </main>
  </body>
</html>
`;
}
