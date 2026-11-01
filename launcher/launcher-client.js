;
(() => {
    const root = document.querySelector('main.launcher');
    if (!(root instanceof HTMLElement))
        return;
    const link = root.querySelector('[data-download]');
    const label = root.querySelector('[data-download-label]');
    const summary = root.querySelector('[data-package-summary]');
    const status = root.querySelector('[data-status]');
    const includeAssets = root.querySelector('[data-include-assets]');
    const totalFilesCell = root.querySelector('[data-total-files-cell]');
    const totalBytesCell = root.querySelector('[data-total-bytes-cell]');
    const fallback = root.querySelector('[data-fallback]');
    const urlCode = root.querySelector('[data-zip-url]');
    const copyButton = root.querySelector('[data-copy-url]');
    const directLinks = Array.from(root.querySelectorAll('[data-direct-link]')).filter((el) => el instanceof HTMLAnchorElement);
    if (!(link instanceof HTMLAnchorElement) ||
        !(label instanceof HTMLElement) ||
        !(summary instanceof HTMLElement) ||
        !(status instanceof HTMLElement) ||
        !(includeAssets instanceof HTMLInputElement) ||
        !(totalFilesCell instanceof HTMLElement) ||
        !(totalBytesCell instanceof HTMLElement) ||
        !(fallback instanceof HTMLElement) ||
        !(urlCode instanceof HTMLElement) ||
        !(copyButton instanceof HTMLButtonElement)) {
        return;
    }
    const integer = new Intl.NumberFormat('pt-BR');
    const totals = {
        all: { files: Number(root.dataset.totalFiles), bytes: Number(root.dataset.totalBytes) },
        code: { files: Number(root.dataset.codeFiles), bytes: Number(root.dataset.codeBytes) },
    };
    const zipPath = root.dataset.zipPath ?? '/__launcher/source-zip';
    const TOKEN_COOKIE = root.dataset.tokenCookie ?? 'helix_zip_token';
    const CONFIRM_TIMEOUT_MS = 45000;
    const POLL_MS = 250;
    const IDLE_LABEL = 'Baixar código-fonte (.zip)';
    const newToken = () => `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    let token = newToken();
    let pollTimer = 0;
    let deadlineTimer = 0;
    const formatBytes = (bytes) => {
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
    };
    const zipUrl = (withToken) => `${zipPath}?assets=${includeAssets.checked ? '1' : '0'}${withToken ? `&token=${token}` : ''}`;
    const syncLinks = () => {
        link.href = zipUrl(true);
        for (const direct of directLinks)
            direct.href = zipUrl(false);
        urlCode.textContent = new URL(zipUrl(false), location.href).href;
    };
    const syncTotals = () => {
        const selected = includeAssets.checked ? totals.all : totals.code;
        summary.textContent = `${integer.format(selected.files)} arquivos · ${formatBytes(selected.bytes)}`;
        totalFilesCell.textContent = integer.format(selected.files);
        totalBytesCell.textContent = formatBytes(selected.bytes);
        for (const row of root.querySelectorAll('tr.row-assets'))
            row.classList.toggle('row-excluded', !includeAssets.checked);
        syncLinks();
    };
    const setStatus = (text, isError = false) => {
        status.textContent = text;
        status.classList.toggle('error', isError);
    };
    const setBusy = (busy) => {
        link.setAttribute('aria-busy', String(busy));
        label.textContent = busy ? 'Montando o zip…' : IDLE_LABEL;
        includeAssets.disabled = busy;
    };
    const hasTokenCookie = (expected) => document.cookie.split(';').some((part) => part.trim() === `${TOKEN_COOKIE}=${expected}`);
    const clearTokenCookie = () => {
        document.cookie = `${TOKEN_COOKIE}=; Max-Age=0; Path=/`;
    };
    const stopWatching = () => {
        clearInterval(pollTimer);
        clearTimeout(deadlineTimer);
    };
    const rotateToken = () => {
        token = newToken();
        syncLinks();
    };
    const watchDownload = (expected) => {
        stopWatching();
        setBusy(true);
        fallback.classList.remove('fallback-visible');
        setStatus('O servidor está lendo os arquivos e comprimindo. O navegador mostra o download assim que o zip ficar pronto.');
        const startedAt = performance.now();
        pollTimer = window.setInterval(() => {
            if (!hasTokenCookie(expected))
                return;
            stopWatching();
            clearTokenCookie();
            setBusy(false);
            const seconds = ((performance.now() - startedAt) / 1000).toFixed(1).replace('.', ',');
            setStatus(`Zip entregue ao navegador em ${seconds} s — confira a barra ou a pasta de downloads.`);
        }, POLL_MS);
        deadlineTimer = window.setTimeout(() => {
            stopWatching();
            setBusy(false);
            setStatus('Não deu para confirmar que o download começou (é normal dentro de pré-visualizações embutidas ou com cookies bloqueados). Se ele não apareceu, use uma das saídas abaixo.', true);
            fallback.classList.add('fallback-visible');
        }, CONFIRM_TIMEOUT_MS);
    };
    link.addEventListener('click', () => {
        const used = token;
        watchDownload(used);
        window.setTimeout(rotateToken, 0);
    });
    for (const direct of directLinks) {
        direct.addEventListener('click', () => {
            setStatus('Pedido feito pelo link direto. Se o navegador abriu uma aba em branco, o download segue nela.');
        });
    }
    copyButton.addEventListener('click', async () => {
        const url = urlCode.textContent ?? '';
        try {
            await navigator.clipboard.writeText(url);
            setStatus('URL do zip copiada. Cole na barra de endereços de uma aba nova para baixar.');
        }
        catch {
            const range = document.createRange();
            range.selectNodeContents(urlCode);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
            setStatus('Não foi possível copiar automaticamente; a URL ficou selecionada para você copiar.', true);
        }
    });
    includeAssets.addEventListener('change', syncTotals);
    syncTotals();
})();
