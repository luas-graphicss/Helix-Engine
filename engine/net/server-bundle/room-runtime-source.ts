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
`;
