export const HUD_HTML = `<!-- DebugHud · HUD do jogo de teste -->
<!-- Helix Engine: montada por helix.gui.html("DebugHud"); os valores entram por helix.gui.bind(nome, valor). -->
<section class="debug-hud" aria-label="Painel do jogo de teste">
	<header class="debug-hud__topo">
		<span class="debug-hud__icone" data-slot="icone"></span>
		<h1 data-bind="titulo">Helix · Debug</h1>
		<span class="debug-hud__tag" data-bind="linguagem">—</span>
	</header>
	<dl class="debug-hud__dados">
		<div><dt>FPS</dt><dd data-bind="fps">0</dd></div>
		<div><dt>Atores</dt><dd data-bind="atores">0</dd></div>
		<div><dt>Pontos</dt><dd data-bind="pontos">0</dd></div>
		<div><dt>Checagens</dt><dd data-bind="checagens">0</dd></div>
		<div><dt>Falhas</dt><dd class="debug-hud__falhas" data-bind="falhas">0</dd></div>
	</dl>
	<p class="debug-hud__dica">WASD anda · Espaço pula · B solta caixa · E evento · F tremor · G efeito · T câmera lenta · H tela · R reinicia</p>
	<nav class="debug-hud__acoes">
		<button type="button" data-action="caixa">Soltar caixa</button>
		<button type="button" data-action="reiniciar">Reiniciar</button>
	</nav>
</section>
`;
export const HUD_CSS = `/* DebugEstilo · Estilo da HUD do jogo de teste */
/* Helix Engine: entra no jogo por helix.gui.css("DebugEstilo"). */
.debug-hud {
	position: absolute;
	top: 16px;
	left: 16px;
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-width: 280px;
	padding: 12px 14px;
	border-radius: 8px;
	background: rgba(12, 14, 20, 0.78);
	color: #f3f4f6;
	font: 500 13px/1.4 system-ui, sans-serif;
	backdrop-filter: blur(6px);
}

.debug-hud__topo {
	display: flex;
	align-items: center;
	gap: 8px;
}

.debug-hud__icone svg {
	display: block;
	width: 22px;
	height: 22px;
}

.debug-hud h1 {
	margin: 0;
	font-size: 14px;
	font-weight: 700;
	letter-spacing: 0.04em;
}

.debug-hud__tag {
	margin-left: auto;
	padding: 2px 6px;
	border-radius: 4px;
	background: #d98c2b;
	color: #16100a;
	font: 700 11px/1.2 ui-monospace, monospace;
}

.debug-hud__dados {
	display: grid;
	grid-template-columns: repeat(5, minmax(0, 1fr));
	gap: 6px;
	margin: 0;
}

.debug-hud__dados div {
	display: flex;
	flex-direction: column;
	gap: 2px;
}

.debug-hud__dados dt {
	font-size: 10px;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	color: #9ca3af;
}

.debug-hud__dados dd {
	margin: 0;
	font: 600 15px/1.2 ui-monospace, monospace;
}

.debug-hud__falhas {
	color: #fb7185;
}

.debug-hud__dica {
	margin: 0;
	font-size: 11px;
	color: #9ca3af;
}

.debug-hud__acoes {
	display: flex;
	gap: 6px;
}

.debug-hud__acoes button {
	flex: 1;
	padding: 6px 8px;
	border: 1px solid rgba(255, 255, 255, 0.14);
	border-radius: 6px;
	background: rgba(255, 255, 255, 0.08);
	color: inherit;
	font: 600 12px/1.2 system-ui, sans-serif;
	cursor: pointer;
}

.debug-hud__acoes button:hover {
	background: rgba(255, 255, 255, 0.16);
}
`;
export const ICON_SVG = `<!-- DebugIcone · Ícone da HUD do jogo de teste -->
<!-- Helix Engine: montado por helix.gui.svg("DebugIcone"). -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#d98c2b" stroke-width="4" stroke-linecap="round">
	<path d="M16 8c0 16 32 16 32 32" />
	<path d="M48 8c0 16-32 16-32 32" />
	<path d="M16 40c0 8 8 16 16 16s16-8 16-16" />
	<circle cx="32" cy="32" r="4" fill="#d98c2b" stroke="none" />
</svg>
`;
export const CONFIG_TOML = `# DebugConfig · Configuração do jogo de teste
# Helix Engine: lida por helix.assets.data("DebugConfig") já interpretada.
titulo = "Helix · Debug"

[jogador]
velocidade = 6.5
pulo = 1.4

[caixas]
quantidade = 5
cores = ["#d98c2b", "#3a86ff", "#06d6a0"]
`;
