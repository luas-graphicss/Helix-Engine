export const ROOM_RUNTIME_FILE = 'helix-room.mjs';
export const ROOM_RUNTIME_SOURCE = String.raw `                                 
                                                                                                               
                                                                                          

export const PROTOCOL = 1
const MAX_MESSAGE_BYTES = 256 * 1024
const MAX_NAME = 32

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function isJson(value, depth = 0) {
  if (depth > 32) return false
  if (value === null) return true
  const type = typeof value
  if (type === 'string' || type === 'boolean') return true
  if (type === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every((item) => isJson(item, depth + 1))
  if (type === 'object') {
    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) return false
    return Object.values(value).every((item) => isJson(item, depth + 1))
  }
  return false
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function describe(cause) {
  if (cause instanceof Error) return cause.message || cause.name
  return typeof cause === 'string' ? cause : JSON.stringify(cause)
}

function readField(target, path) {
  let value = target
  for (const part of path.split('.')) {
    if (value === null || typeof value !== 'object') return undefined
    value = value[part]
  }
  if (value && typeof value === 'object' && typeof value.length === 'number' && !Array.isArray(value)) value = Array.from(value)
  return isJson(value) ? value : undefined
}

class Listeners {
  constructor() {
    this.map = new Map()
  }
  add(name, fn) {
    let set = this.map.get(name)
    if (!set) {
      set = new Set()
      this.map.set(name, set)
    }
    set.add(fn)
    return () => set.delete(fn)
  }
  emit(name, args, report) {
    const set = this.map.get(name)
    if (!set) return 0
    for (const fn of Array.from(set)) {
      try {
        const result = fn(...args)
        if (result && typeof result.then === 'function') result.catch((cause) => report(name, cause))
      } catch (cause) {
        report(name, cause)
      }
    }
    return set.size
  }
  clear() {
    this.map.clear()
  }
}

                                                                                             
class Clock {
  constructor(log) {
    this.log = log
    this.startedAt = now()
    this.now = 0
    this.delta = 0
    this.frame = 0
    this.timers = new Set()
  }
  advance(deltaSeconds) {
    this.delta = deltaSeconds
    this.now += deltaSeconds
    this.frame++
    for (const timer of Array.from(this.timers)) {
      if (this.now < timer.due) continue
      if (timer.every > 0) timer.due += timer.every
      else this.timers.delete(timer)
      try {
        const result = timer.fn()
        if (timer.every <= 0 && timer.resolve) timer.resolve(result)
      } catch (cause) {
        this.log('error', 'helix.task: ' + describe(cause))
      }
    }
  }
  schedule(seconds, fn, every = 0) {
    const timer = { due: this.now + Math.max(0, seconds), fn, every, resolve: null }
    this.timers.add(timer)
    return () => this.timers.delete(timer)
  }
  wait(seconds) {
    return new Promise((resolve) => {
      const timer = { due: this.now + Math.max(0, seconds), fn: () => undefined, every: 0, resolve }
      this.timers.add(timer)
    })
  }
}

   
                                                                          
                                                                       
                                                                               
                                                                         
   
export class Room {
  constructor(options) {
    this.name = options.name || 'principal'
    this.tickRate = Math.max(1, options.tickRate || 20)
    this.maxPlayers = Math.max(1, options.maxPlayers || 16)
    this.onLog = options.onLog || ((level, message) => console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log']('[helix:' + this.name + '] ' + message))
    this.builtins = new Map(Object.entries(options.builtins || {}))
    this.builtinInstances = new Map()
    this.players = new Map()
    this.nextPlayerId = 1
    this.nextCallId = 1
    this.pending = new Map()
    this.rpcs = new Map()
    this.listeners = new Listeners()
    this.bus = new Listeners()
    this.state = new Map()
    this.dirty = new Set()
    this.removed = new Set()
    this.replicated = new Map()
    this.lastReplicated = new Map()
    this.gate = null
    this.clock = new Clock((level, message) => this.onLog(level, message))
    this.modules = new Map()
    this.hooks = []
    this.started = false
    this.closed = false
    this.helix = this.createHelix()
    this.loadGame(options.game)
  }

                                                                                    

  loadGame(game) {
    this.game = game
    for (const script of game.scripts) this.modules.set(script.name, { script, exports: null, state: 'idle' })
                                                                          
    const order = [...game.scripts].sort((a, b) => Number(b.entry) - Number(a.entry))
    for (const script of order) {
      if (script.kind !== 'module') {
        this.onLog('warn', script.file + ' está em ' + script.language + ': este pacote executa as linguagens que compilam para JavaScript; o fonte foi incluído para referência.')
        continue
      }
      try {
        const exports = this.require(script.name)
        if (exports && typeof exports === 'object') this.hooks.push({ name: script.name, exports })
      } catch (cause) {
        this.onLog('error', script.file + ' falhou ao carregar: ' + describe(cause))
      }
    }
  }

  start() {
    if (this.started) return
    this.started = true
    this.call('onLoad')
    this.call('onStart')
    this.onLog('info', 'sala "' + this.name + '" aberta: ' + this.hooks.length + ' módulo(s), ' + this.tickRate + ' Hz, até ' + this.maxPlayers + ' jogador(es).')
  }

                                                                                                                 
  tick(deltaSeconds = 1 / this.tickRate) {
    if (!this.started || this.closed) return
    this.clock.advance(deltaSeconds)
    this.call('onUpdate', deltaSeconds)
    this.flushState()
    this.flushReplication()
  }

  close(reason = 'servidor encerrado') {
    if (this.closed) return
    this.closed = true
    this.call('onStop')
    for (const player of Array.from(this.players.values())) {
      this.send(player, { t: 'kick', reason })
      player.socket.close(reason)
    }
    this.players.clear()
    for (const call of this.pending.values()) call.reject(new Error('o servidor encerrou'))
    this.pending.clear()
  }

  call(hook, ...args) {
    for (const { name, exports } of this.hooks) {
      const fn = exports[hook]
      if (typeof fn !== 'function') continue
      try {
        const result = fn(...args)
        if (result && typeof result.then === 'function') result.catch((cause) => this.onLog('error', name + '.' + hook + ': ' + describe(cause)))
      } catch (cause) {
        this.onLog('error', name + '.' + hook + ': ' + describe(cause))
      }
    }
  }

                                                                                     

  require(specifier) {
    if (specifier === 'helix') return this.helix
    if (this.builtins.has(specifier)) return this.builtin(specifier)
    const name = String(specifier).replace(/^\.\//, '').replace(/\.(js|ts|mjs|cjs)$/, '')
    const entry = this.modules.get(name)
    if (!entry) throw new Error('módulo "' + specifier + '" não existe no pacote de servidor (só scripts de Servidor e Ambos entram nele).')
    if (entry.state === 'loaded') return entry.exports
    if (entry.state === 'loading') throw new Error('importação circular em ' + name)
    if (entry.script.kind !== 'module') throw new Error(name + ' está em ' + entry.script.language + ' e este pacote executa só as linguagens que compilam para JavaScript.')
    entry.state = 'loading'
    const module = { exports: {}, id: name, filename: entry.script.file, loaded: false }
    const console = this.createConsole(name)
    const factory = new Function('require', 'module', 'exports', 'helix', 'console', entry.script.code + '\n//# sourceURL=helix://' + entry.script.file)
    factory((inner) => this.require(inner), module, module.exports, this.helix, console)
    entry.exports = module.exports
    entry.state = 'loaded'
    return entry.exports
  }

                                                                                                             
  builtin(specifier) {
    let instance = this.builtinInstances.get(specifier)
    if (instance === undefined) {
      instance = this.builtins.get(specifier)()
      this.builtinInstances.set(specifier, instance)
    }
    return instance
  }

  createConsole(name) {
    const write = (level) => (...args) => this.onLog(level, name + ': ' + args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '))
    return { log: write('info'), info: write('info'), warn: write('warn'), error: write('error'), debug: write('info') }
  }

                                                                                     

                                                                                                   
  connect(socket) {
    let player = null
    let greeted = false
    socket.onMessage((text) => {
      if (typeof text !== 'string' || text.length > MAX_MESSAGE_BYTES) {
        socket.close('mensagem inválida')
        return
      }
      let message
      try {
        message = JSON.parse(text)
      } catch {
        socket.close('JSON inválido')
        return
      }
      if (!message || typeof message.t !== 'string') return
      if (!player) {
        if (message.t !== 'hello' || greeted) return
        greeted = true
        this.handleHello(socket, message, (admitted) => {
          player = admitted
        })
        return
      }
      this.handleMessage(player, message)
    })
    socket.onClose((reason) => {
      if (player) this.removePlayer(player, reason || 'desconectou')
    })
  }

  send(player, message) {
    try {
      player.socket.send(JSON.stringify(message))
    } catch (cause) {
      this.onLog('warn', 'envio para ' + player.info.name + ' falhou: ' + describe(cause))
    }
  }

  broadcast(message, except = null) {
    for (const player of this.players.values()) if (player !== except) this.send(player, message)
  }

  handleHello(socket, hello, admit) {
    const reject = (reason) => {
      socket.send(JSON.stringify({ t: 'reject', reason }))
      socket.close(reason)
    }
    if (hello.protocol !== PROTOCOL) return reject('protocolo ' + hello.protocol + ' não é o ' + PROTOCOL + ' deste servidor')
    if (this.players.size >= this.maxPlayers) return reject('sala cheia')
    const requested = String(hello.name || '').trim().slice(0, MAX_NAME) || 'Jogador ' + this.nextPlayerId
    const settle = (verdict) => {
      const reason = verdict === false ? 'entrada recusada' : typeof verdict === 'string' ? verdict : null
      if (reason) {
        this.onLog('info', 'conexão de "' + requested + '" recusada: ' + reason)
        return reject(reason)
      }
      if (this.players.size >= this.maxPlayers) return reject('sala cheia')
      const renamed = verdict && typeof verdict === 'object' && typeof verdict.name === 'string' ? verdict.name.trim().slice(0, MAX_NAME) : ''
      admit(this.admit(socket, renamed || requested))
    }
    if (!this.gate) return settle(true)
    let verdict
    try {
      verdict = this.gate(hello.ticket ?? null, { name: requested, protocol: hello.protocol })
    } catch (cause) {
      this.onLog('error', 'helix.net.authenticate: ' + describe(cause))
      verdict = false
    }
    if (verdict && typeof verdict.then === 'function') {
      verdict.then(settle, (cause) => {
        this.onLog('error', 'helix.net.authenticate: ' + describe(cause))
        settle(false)
      })
      return
    }
    settle(verdict)
  }

  admit(socket, name) {
    const info = { id: this.nextPlayerId++, name, joinedAt: Math.round(this.serverTime()) }
    const player = { info, socket, calls: new Map() }
    this.players.set(info.id, player)
    this.send(player, { t: 'welcome', player: info, players: Array.from(this.players.values(), (entry) => entry.info), state: this.snapshot(), tickRate: this.tickRate, serverTime: Math.round(this.serverTime()) })
    this.broadcast({ t: 'playerJoined', player: info }, player)
    this.bus.emit('net.playerJoined', [this.toPlayer(info)], (name, cause) => this.onLog('error', name + ': ' + describe(cause)))
    this.onLog('info', info.name + ' entrou (' + this.players.size + ' de ' + this.maxPlayers + ').')
    return player
  }

  removePlayer(player, reason) {
    if (!this.players.delete(player.info.id)) return
    this.broadcast({ t: 'playerLeft', player: player.info, reason })
    this.bus.emit('net.playerLeft', [{ ...this.toPlayer(player.info), reason }], (name, cause) => this.onLog('error', name + ': ' + describe(cause)))
    this.onLog('info', player.info.name + ' saiu (' + reason + ').')
  }

  handleMessage(player, message) {
    switch (message.t) {
      case 'call':
        void this.serveCall(player, message)
        return
      case 'result': {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        if (message.ok) pending.resolve(message.value)
        else pending.reject(new Error(message.error))
        return
      }
      case 'event':
        if (typeof message.name !== 'string' || !Array.isArray(message.args)) return
        this.listeners.emit(message.name, [this.toPlayer(player.info), ...message.args], (name, cause) => this.onLog('error', 'helix.net.on(' + name + '): ' + describe(cause)))
        return
      case 'pong':
        if (typeof message.at === 'number') player.latency = Math.max(0, now() - message.at)
        return
      default:
        return
    }
  }

  async serveCall(player, message) {
    const reply = (body) => this.send(player, { t: 'result', id: message.id, ...body })
    if (typeof message.name !== 'string' || !Array.isArray(message.args)) return reply({ ok: false, error: 'chamada malformada' })
    const rpc = this.rpcs.get(message.name)
    if (!rpc) return reply({ ok: false, error: 'o servidor não tem um procedimento "' + message.name + '"' })
    if (rpc.perSecond > 0) {
      const stamps = (player.calls.get(message.name) || []).filter((at) => now() - at < 1000)
      if (stamps.length >= rpc.perSecond) {
        player.calls.set(message.name, stamps)
        return reply({ ok: false, error: '"' + message.name + '" limitado a ' + rpc.perSecond + ' chamada(s) por segundo' })
      }
      stamps.push(now())
      player.calls.set(message.name, stamps)
    }
    try {
      const value = await rpc.fn(this.toPlayer(player.info), ...message.args)
      const result = value === undefined ? null : value
      if (!isJson(result)) return reply({ ok: false, error: 'o resultado de "' + message.name + '" não é serializável em JSON' })
      reply({ ok: true, value: result })
    } catch (cause) {
      reply({ ok: false, error: describe(cause) })
    }
  }

  callClient(player, name, args) {
    const id = this.nextCallId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.send(player, { t: 'call', id, name, args })
    })
  }

                                                                                        

  serverTime() {
    return now() - this.clock.startedAt
  }

  snapshot() {
    const out = {}
    for (const [key, value] of this.state) out[key] = clone(value)
    return out
  }

  setState(key, value) {
    this.state.set(key, clone(value))
    this.dirty.add(key)
    this.removed.delete(key)
    this.bus.emit('net.stateChanged', [{ key, value: clone(value) }], (name, cause) => this.onLog('error', name + ': ' + describe(cause)))
  }

  removeState(key) {
    if (!this.state.delete(key)) return false
    this.dirty.delete(key)
    this.removed.add(key)
    return true
  }

  flushState() {
    if (this.dirty.size === 0 && this.removed.size === 0) return
    const set = {}
    for (const key of this.dirty) if (this.state.has(key)) set[key] = clone(this.state.get(key))
    const removed = Array.from(this.removed)
    this.dirty.clear()
    this.removed.clear()
    this.broadcast({ t: 'state', set, removed })
  }

  flushReplication() {
    if (this.replicated.size === 0) return
    const entities = []
    for (const [target, fields] of this.replicated) {
      const current = {}
      let changed = false
      const previous = this.lastReplicated.get(target) || {}
      for (const field of fields) {
        const value = readField(target, field)
        if (value === undefined) continue
        current[field] = value
        if (!changed && JSON.stringify(previous[field]) !== JSON.stringify(value)) changed = true
      }
      if (!changed) continue
      this.lastReplicated.set(target, current)
      entities.push({ id: Number(target.id) || 0, name: String(target.name || ''), fields: current })
    }
    if (entities.length > 0) this.broadcast({ t: 'replicate', entities })
  }

                                                                                    

  toPlayer(info) {
    const player = this.players.get(info.id)
    return { id: info.id, name: info.name, local: false, isHost: false, joinedAt: info.joinedAt, latency: player ? Math.round(player.latency || 0) : 0 }
  }

  requirePlayer(value, member) {
    const id = typeof value === 'number' ? value : value && typeof value === 'object' ? value.id : NaN
    const player = this.players.get(id)
    if (!player) throw new Error(member + ': jogador ' + String(id) + ' não está na sala.')
    return player
  }

  requireJsonArgs(member, args) {
    for (const arg of args) if (!isJson(arg)) throw new Error(member + ': os argumentos precisam ser JSON (números, textos, listas, objetos simples).')
    return args
  }

  createHelix() {
    const room = this
    const report = (name, cause) => room.onLog('error', name + ': ' + describe(cause))
    const requireFn = (value, member) => {
      if (typeof value !== 'function') throw new Error(member + ': esperava uma função.')
      return value
    }
    const requireKey = (value, member) => {
      if (typeof value !== 'string' || !value) throw new Error(member + ': esperava um nome não vazio.')
      return value
    }
    const state = {
      get: (key, fallback) => {
        const value = room.state.get(requireKey(key, 'helix.net.state.get'))
        return value === undefined ? (fallback === undefined ? null : fallback) : clone(value)
      },
      has: (key) => room.state.has(requireKey(key, 'helix.net.state.has')),
      set: (key, value) => {
        if (!isJson(value)) throw new Error('helix.net.state.set: o valor de "' + key + '" não é serializável em JSON.')
        room.setState(requireKey(key, 'helix.net.state.set'), value)
      },
      remove: (key) => room.removeState(requireKey(key, 'helix.net.state.remove')),
      keys: () => Array.from(room.state.keys()),
      snapshot: () => room.snapshot(),
      onChanged: (key, handler) => {
        const name = requireKey(key, 'helix.net.state.onChanged')
        const fn = requireFn(handler, 'helix.net.state.onChanged')
        return room.bus.add('net.stateChanged', ({ key: changed, value }) => {
          if (name === '*') fn(changed, value)
          else if (changed === name) fn(value, changed)
        })
      },
    }
    const net = {
      get isServer() {
        return true
      },
      get isClient() {
        return false
      },
      get mode() {
        return 'authoritative'
      },
      get connected() {
        return !room.closed
      },
      get transport() {
        return 'websocket'
      },
      get tickRate() {
        return room.tickRate
      },
      get latency() {
        return 0
      },
      get localPlayer() {
        return null
      },
      players: () => Array.from(room.players.values(), (player) => room.toPlayer(player.info)),
      player: (id) => (room.players.has(id) ? room.toPlayer(room.players.get(id).info) : null),
      rpc: (name, handler, options) => {
        const key = requireKey(name, 'helix.net.rpc')
        const fn = requireFn(handler, 'helix.net.rpc')
        const perSecond = options && typeof options.perSecond === 'number' ? options.perSecond : 0
        const entry = { fn, perSecond }
        room.rpcs.set(key, entry)
        return () => {
          if (room.rpcs.get(key) === entry) room.rpcs.delete(key)
        }
      },
      hasRpc: (name) => room.rpcs.has(name),
      rpcs: () => Array.from(room.rpcs.keys()),
      call: (first, ...rest) => {
        if (typeof first === 'string') throw new Error('helix.net.call(nome) só existe no cliente; no servidor use call(jogador, nome, …), send ou broadcast.')
        const player = room.requirePlayer(first, 'helix.net.call')
        return room.callClient(player, requireKey(rest[0], 'helix.net.call'), room.requireJsonArgs('helix.net.call', rest.slice(1)))
      },
      emit: () => {
        throw new Error('helix.net.emit só existe no cliente: o servidor fala com os jogadores por send e broadcast.')
`;
