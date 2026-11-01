import type { GameServerTarget } from '@/engine/scripting/scripting-settings';
import { ROOM_RUNTIME_FILE } from './room-runtime-source';
export const NODE_SERVER_SOURCE = String.raw `                             
                                                                                       
                                                                 

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { Room, loadGameFromDisk } from './${ROOM_RUNTIME_FILE}'
import { builtins } from './game/index.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const game = await loadGameFromDisk(path.join(here, 'game'), { readFile }, path)
const port = Number(process.env.PORT) || 8787
const maxRooms = Number(process.env.HELIX_MAX_ROOMS) || 64

const rooms = new Map()
function roomFor(name) {
  let room = rooms.get(name)
  if (room) return room
  if (rooms.size >= maxRooms) return null
  room = new Room({ name, game, builtins, tickRate: game.server.tickRate, maxPlayers: game.server.maxPlayers })
  room.start()
  room.timer = setInterval(() => room.tick(1 / room.tickRate), Math.round(1000 / room.tickRate))
  room.sweep = setInterval(() => {
                                                                                                
    if (room.players.size > 0) room.emptySince = null
    else if (!room.emptySince) room.emptySince = Date.now()
    else if (Date.now() - room.emptySince > 60_000) closeRoom(name, 'sala vazia')
  }, 10_000)
  rooms.set(name, room)
  return room
}
function closeRoom(name, reason) {
  const room = rooms.get(name)
  if (!room) return
  clearInterval(room.timer)
  clearInterval(room.sweep)
  room.close(reason)
  rooms.delete(name)
}

const http = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ ok: true, game: game.name, protocol: game.protocol, rooms: rooms.size, players: Array.from(rooms.values()).reduce((sum, room) => sum + room.players.size, 0) }))
    return
  }
  response.writeHead(426, { 'content-type': 'text/plain; charset=utf-8' })
  response.end('Servidor Helix de ' + game.name + ': conecte por WebSocket.')
})

const wss = new WebSocketServer({ server: http, maxPayload: 256 * 1024 })
wss.on('connection', (ws, request) => {
  const url = new URL(request.url || '/', 'http://localhost')
  const name = (url.searchParams.get('room') || 'principal').slice(0, 64)
  const room = roomFor(name)
  if (!room) {
    ws.send(JSON.stringify({ t: 'reject', reason: 'servidor lotado' }))
    ws.close(1013, 'servidor lotado')
    return
  }
  let onMessage = () => undefined
  let onClose = () => undefined
  room.connect({
    send: (text) => {
      if (ws.readyState === ws.OPEN) ws.send(text)
    },
    close: (reason) => ws.close(1000, String(reason || '').slice(0, 120)),
    onMessage: (handler) => {
      onMessage = handler
    },
    onClose: (handler) => {
      onClose = handler
    },
  })
  ws.on('message', (data, isBinary) => {
    if (isBinary) return ws.close(1003, 'só texto')
    onMessage(data.toString())
  })
  ws.on('close', (_code, reason) => onClose(reason.toString() || 'desconectou'))
  ws.on('error', () => onClose('erro de conexão'))
})

const shutdown = () => {
  for (const name of Array.from(rooms.keys())) closeRoom(name, 'servidor encerrado')
  wss.close()
  http.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

http.listen(port, () => {
  console.log('[helix] ' + game.name + ' · servidor autoritativo em ws://0.0.0.0:' + port + ' (protocolo ' + game.protocol + ', ' + game.server.tickRate + ' Hz, até ' + game.server.maxPlayers + ' por sala)')
})
`;
export const CLOUDFLARE_WORKER_SOURCE = String.raw `                             
                                                                                                    
                                                                                          

import { Room } from './${ROOM_RUNTIME_FILE}'
import manifest from './game/manifest.json'
import * as modules from './game/index.mjs'

const game = { ...manifest, scripts: manifest.scripts.map((entry) => ({ ...entry, code: entry.kind === 'module' ? modules[entry.module] : null })) }

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/health') return Response.json({ ok: true, game: game.name, protocol: game.protocol })
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Servidor Helix de ' + game.name + ': conecte por WebSocket.', { status: 426 })
    const name = (url.searchParams.get('room') || 'principal').slice(0, 64)
    const id = env.HELIX_ROOM.idFromName(name)
    return env.HELIX_ROOM.get(id).fetch(request)
  },
}

export class HelixRoom {
  constructor(state) {
    this.state = state
    this.room = null
    this.handlers = new Map()
  }

  ensureRoom(name) {
    if (this.room) return this.room
    this.room = new Room({ name, game, builtins: modules.builtins, tickRate: game.server.tickRate, maxPlayers: game.server.maxPlayers })
    this.room.start()
    this.lastTick = Date.now()
    this.state.storage.setAlarm(Date.now() + Math.round(1000 / this.room.tickRate))
    return this.room
  }

  async fetch(request) {
    const url = new URL(request.url)
    const room = this.ensureRoom((url.searchParams.get('room') || 'principal').slice(0, 64))
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.state.acceptWebSocket(server)
    const entry = { onMessage: () => undefined, onClose: () => undefined }
    this.handlers.set(server, entry)
    room.connect({
      send: (text) => server.send(text),
      close: (reason) => server.close(1000, String(reason || '').slice(0, 120)),
      onMessage: (handler) => {
        entry.onMessage = handler
      },
      onClose: (handler) => {
        entry.onClose = handler
      },
    })
    return new Response(null, { status: 101, webSocket: client })
  }

  webSocketMessage(ws, message) {
    const entry = this.handlers.get(ws)
    if (!entry) return
    if (typeof message !== 'string') return ws.close(1003, 'só texto')
    entry.onMessage(message)
  }

  webSocketClose(ws, _code, reason) {
    const entry = this.handlers.get(ws)
    this.handlers.delete(ws)
    entry?.onClose(reason || 'desconectou')
  }

  webSocketError(ws) {
    const entry = this.handlers.get(ws)
    this.handlers.delete(ws)
    entry?.onClose('erro de conexão')
  }

  async alarm() {
    if (!this.room) return
    const at = Date.now()
    this.room.tick((at - this.lastTick) / 1000)
    this.lastTick = at
                                                                         
    if (this.room.players.size > 0) this.state.storage.setAlarm(at + Math.round(1000 / this.room.tickRate))
  }
}
`;
export const WRANGLER_TOML = (slug: string) => `name = "${slug}-servidor"
main = "worker.mjs"
compatibility_date = "2025-01-01"

[[durable_objects.bindings]]
name = "HELIX_ROOM"
class_name = "HelixRoom"

[[migrations]]
tag = "v1"
new_classes = ["HelixRoom"]
`;
export const DOCKERFILE = `FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .
ENV PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http:                                 
CMD ["node", "server.mjs"]
`;
export const DOCKER_COMPOSE = (slug: string) => `services:
  ${slug}:
    build: .
    ports:
      - "8787:8787"
    restart: unless-stopped
    environment:
      - PORT=8787
`;
export const NODE_PACKAGE_JSON = (slug: string, name: string) => JSON.stringify({
    name: `${slug}-servidor`,
    private: true,
    type: 'module',
    description: `Servidor autoritativo de ${name} (Helix Engine)`,
    engines: { node: '>=20' },
    scripts: { start: 'node server.mjs' },
    dependencies: { ws: '^8.18.0' },
}, null, 2);
export function hostFiles(target: GameServerTarget, slug: string, name: string): Array<{
    path: string;
    content: string;
}> {
    switch (target) {
        case 'node':
            return [
                { path: 'server.mjs', content: NODE_SERVER_SOURCE },
                { path: 'package.json', content: NODE_PACKAGE_JSON(slug, name) },
            ];
        case 'docker':
            return [
                { path: 'server.mjs', content: NODE_SERVER_SOURCE },
                { path: 'package.json', content: NODE_PACKAGE_JSON(slug, name) },
                { path: 'Dockerfile', content: DOCKERFILE },
                { path: 'compose.yaml', content: DOCKER_COMPOSE(slug) },
                { path: '.dockerignore', content: 'node_modules\n*.zip\n' },
            ];
        case 'cloudflare':
            return [
                { path: 'worker.mjs', content: CLOUDFLARE_WORKER_SOURCE },
                { path: 'wrangler.toml', content: WRANGLER_TOML(slug) },
                { path: 'package.json', content: JSON.stringify({ name: `${slug}-servidor`, private: true, type: 'module', scripts: { deploy: 'wrangler deploy', dev: 'wrangler dev' }, devDependencies: { wrangler: '^3.90.0' } }, null, 2) },
            ];
    }
}
