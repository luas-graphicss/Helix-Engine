import { HOOK_NAMES, hookAliases } from '../foreign-values';
export const LUA_PRELUDE_CHUNK = '[helix]';
export const LUA_KIND_KEY = '@hx';
export function luaPreludeSource(): string {
    const hooks = HOOK_NAMES.map((name) => `{ "${name}", "${hookAliases(name)[0]}" }`).join(', ');
    return `
local hx = ...
local M = {}
local KIND = "${LUA_KIND_KEY}"
local HOOKS = { ${hooks} }
local MAX_DEPTH = 8
local AWAIT = {}

local rawget, rawset, setmetatable, getmetatable, type, tostring, select, error, pcall, xpcall, next, ipairs = rawget, rawset, setmetatable, getmetatable, type, tostring, select, error, pcall, xpcall, next, ipairs
local cocreate, coresume, costatus, coyield, corunning, coisyieldable, coclose = coroutine.create, coroutine.resume, coroutine.status, coroutine.yield, coroutine.running, coroutine.isyieldable, coroutine.close
local unpack = table.unpack or unpack
local concat, remove = table.concat, table.remove
local getinfo, info, traceback = debug.getinfo, debug.info, debug.traceback

local refs = setmetatable({}, { __mode = "v" })
local fnCache = setmetatable({}, { __mode = "v" })
local callbacks = {}
local callbackIds = setmetatable({}, { __mode = "k" })
local nextCallback = 0
local pending = {}
local nextToken = 0
local current = nil
local modules = {}
local loadingKeys, loadingFiles = {}, {}
local rootHelix = nil

local RefMeta = {}
local materialize, pack, callHost, requireModule

local function isRef(value)
  return type(value) == "table" and type(rawget(value, KIND)) == "number"
end

                                                                                                                                                                        
local AXIS = { x = 1, y = 2, z = 3, w = 4, r = 1, g = 2, b = 3 }
local VecMeta = {}
VecMeta.__index = function(v, key)
  local index = AXIS[key]
  if index then return rawget(v, index) end
  return nil
end
VecMeta.__newindex = function(v, key, value)
  rawset(v, AXIS[key] or key, value)
end
VecMeta.__tostring = function(v)
  local parts = {}
  for i = 1, #v do parts[i] = tostring(rawget(v, i)) end
  return "(" .. concat(parts, ", ") .. ")"
end
VecMeta.__metatable = "helix vector"

local function newVec(numbers)
  return setmetatable(numbers, VecMeta)
end

local function newRef(id)
  local ref = setmetatable({}, RefMeta)
  rawset(ref, KIND, id)
  refs[id] = ref
  return ref
end

local function registerCallback(fn)
  local id = callbackIds[fn]
  if not id then
    nextCallback = nextCallback + 1
    id = nextCallback
    callbacks[id] = fn
    callbackIds[fn] = id
  end
  return id
end

local function newFunction(fnId)
  local fn = function(...)
    return callHost(fnId, ...)
  end
  fnCache[fnId] = fn
  return fn
end

                                                                                                     
local function walk(t, depth)
  if depth > MAX_DEPTH then return t end
  for key, child in next, t do
    if type(child) == "table" then
      local kind = rawget(child, KIND)
      if kind ~= nil then
        t[key] = materialize(child, depth + 1)
      else
        walk(child, depth + 1)
      end
    end
  end
  return t
end

materialize = function(value, depth)
  if type(value) ~= "table" then return value end
  local kind = rawget(value, KIND)
  if kind == nil then return value end
  if type(kind) == "number" then return refs[kind] or newRef(kind) end
  if kind == "ref" then return refs[value.id] or newRef(value.id) end
  if kind == "fn" then return fnCache[value.id] or newFunction(value.id) end
  if kind == "vec" then return newVec(value.value) end
  if kind == "data" then
    local inner = value.value
                                                                                           
    if type(inner) == "table" and rawget(inner, KIND) ~= nil then return materialize(inner, depth) end
    return walk(inner, depth or 0)
  end
  return value
end

                                                                                       
                                                                                               
local function packTable(t, depth)
  if depth > MAX_DEPTH then return t end
  local copy = nil
  for key, child in next, t do
    local kind = type(child)
    if kind == "table" or kind == "function" then
      local packed = pack(child, depth + 1)
      if packed ~= child then
        if not copy then
          copy = {}
          for k, v in next, t do copy[k] = v end
        end
        copy[key] = packed
      end
    end
  end
  return copy or t
end

pack = function(value, depth)
  local kind = type(value)
  if kind == "table" then
    if isRef(value) then return value end
    return packTable(value, depth or 0)
  elseif kind == "function" then
    return { [KIND] = "cb", id = registerCallback(value) }
  elseif kind == "thread" or kind == "userdata" then
    return nil
  end
  return value
end

                                                                                                            
local function finish(result, level)
  if type(result) ~= "table" then return result end
  local kind = rawget(result, KIND)
  if kind == "err" then error(result.message, level) end
  if kind == "await" then
    if current == nil or corunning() ~= current or not coisyieldable() then
      error("esta chamada devolve uma promessa e precisa esperar; chame-a dentro de um hook (onStart, onUpdate…) ou de helix.task.spawn.", level)
    end
    local ok, value = coyield(AWAIT)
    if not ok then error(value, level) end
    return materialize(value)
  end
  return materialize(result)
end

callHost = function(fnId, ...)
  local n = select("#", ...)
  local args = { ... }
  for i = 1, n do args[i] = pack(args[i]) end
  return finish(hx.call(fnId, unpack(args, 1, n)), 4)
end

RefMeta.__index = function(ref, key)
  return finish(hx.get(rawget(ref, KIND), key), 3)
end
RefMeta.__newindex = function(ref, key, value)
  local result = hx.set(rawget(ref, KIND), key, pack(value))
  if type(result) == "table" and rawget(result, KIND) == "err" then error(result.message, 2) end
end
RefMeta.__call = function(ref)
  error(hx.str(rawget(ref, KIND)) .. " não é uma função; chame um de seus métodos.", 2)
end
RefMeta.__tostring = function(ref)
  return hx.str(rawget(ref, KIND))
end
RefMeta.__len = function(ref)
  return hx.len(rawget(ref, KIND))
end
RefMeta.__concat = function(a, b)
  return tostring(a) .. tostring(b)
end
local function iterate(ref)
  local keys = hx.keys(rawget(ref, KIND))
  local index = 0
  return function()
    index = index + 1
    local key = keys[index]
    if key == nil then return nil end
    return key, ref[key]
  end
end
RefMeta.__pairs = function(ref)
  return iterate(ref), ref, nil
end
RefMeta.__iter = function(ref)
  return iterate(ref)
end
RefMeta.__metatable = "helix reference"

                                                                                     

local function handler(err)
  local message = type(err) == "table" and err.message or tostring(err)
  return { message = message, trace = traceback("", 2) }
end

local function settle(co, token, ok, status, ...)
  if not ok then return { "error", tostring(status), "" } end
  if costatus(co) == "dead" then
    if status == true then return { "done", (...) } end
    local failure = ...
    return { "error", failure.message, failure.trace }
  end
  if status == AWAIT then
    if not token then
      nextToken = nextToken + 1
      token = nextToken
    end
    pending[token] = co
    return { "await", token }
  end
  coclose(co)
  return { "error", "coroutine.yield fora de uma espera da engine; use helix.task.wait ou helix.task.spawn.", "" }
end

local function drive(co, token, ...)
  local previous = current
  current = co
  local results = { coresume(co, ...) }
  current = previous
  return settle(co, token, unpack(results, 1, select("#", ...) > 0 and #results or #results))
end

local function run(fn, ...)
  local co = cocreate(function(...) return xpcall(fn, handler, ...) end)
  return drive(co, nil, ...)
end

function M.resume(token, ok, value)
  local co = pending[token]
  if not co then return { "error", "a corrotina desta espera já foi encerrada", "" } end
  pending[token] = nil
  return drive(co, token, ok, materialize(value))
end

function M.drop(token)
  local co = pending[token]
  if co then
    pending[token] = nil
    pcall(coclose, co)
  end
end

function M.invoke(id, ...)
  local fn = callbacks[id]
  if not fn then return { "error", "callback desconhecido (" .. tostring(id) .. ")", "" } end
  local n = select("#", ...)
  local args = { ... }
  for i = 1, n do args[i] = materialize(args[i]) end
  return run(fn, unpack(args, 1, n))
end

                                                                                                                    
function M.where()
  local co = current
  if not co then return nil end
  for level = 0, 60 do
    local source, line
    if info then
      source, line = info(co, level, "sl")
    else
      local frame = getinfo(co, level, "Sl")
      if frame then source, line = frame.short_src, frame.currentline end
    end
    if source == nil then break end
    if source ~= "[C]" and source ~= "${LUA_PRELUDE_CHUNK}" and source ~= "=${LUA_PRELUDE_CHUNK}" and line and line > 0 then
      return { source, line }
    end
  end
  return nil
end

                                                                                      

local G = {}
for _, name in ipairs({ "assert", "error", "ipairs", "pairs", "next", "pcall", "xpcall", "select", "tonumber", "tostring", "type", "rawequal", "rawget", "rawset", "rawlen", "setmetatable", "getmetatable", "unpack", "string", "table", "math", "utf8", "coroutine", "bit32", "typeof", "buffer", "vector", "_VERSION" }) do
  G[name] = _G[name]
end
G.os = { clock = os.clock, time = os.time, date = os.date, difftime = os.difftime }
G.debug = { traceback = debug.traceback }

local function format(...)
  local n = select("#", ...)
  local parts = {}
  for i = 1, n do parts[i] = tostring((select(i, ...))) end
  return concat(parts, " ")
end

local function requireFrom(fromKey, spec)
  if type(spec) ~= "string" or spec == "" then error("require() precisa do nome de um script da biblioteca, em texto.", 3) end
  if spec == "helix" or spec == "@helix/engine" then return rootHelix end
  local result = hx.resolve(fromKey, spec)
  if type(result) ~= "table" then return result end
  local kind = rawget(result, KIND)
  if kind == "err" then error(result.message, 3) end
  if kind == "module" then return requireModule(result.key, result.file, 3) end
  return materialize(result)
end

local function newEnv(file, helixValue, scriptValue, key)
  local env = setmetatable({}, { __index = G })
  env._G = env
  env.helix = materialize(helixValue)
  env.script = materialize(scriptValue)
  env.print = function(...) hx.console("info", format(...)) end
  env.warn = function(...) hx.console("warn", format(...)) end
  env.require = function(spec) return requireFrom(key, spec) end
  return env
end

local function loadChunk(key, env)
  local result = hx.loadChunk(key, env)
  if type(result) == "function" then return result end
  if type(result) == "table" then
    local kind = rawget(result, KIND)
    if kind == "err" then return nil, result.message end
    if kind == "source" then
      local fn, err = load(result.source, result.name, "t", env)
      if not fn then return nil, tostring(err) end
      return fn
    end
  end
  return nil, "o runtime não conseguiu carregar o script"
end

requireModule = function(key, file, level)
  local cached = modules[key]
  if cached ~= nil then return cached end
  for i = 1, #loadingKeys do
    if loadingKeys[i] == key then
      local chain = {}
      for j = i, #loadingFiles do chain[#chain + 1] = loadingFiles[j] end
      chain[#chain + 1] = file
      error("Importação circular: " .. concat(chain, " → ") .. ". Quebre o ciclo movendo o que os dois usam para um terceiro módulo.", level + 1)
    end
  end
  local env = newEnv(file, rootHelix, nil, key)
  local fn, err = loadChunk(key, env)
  if not fn then error(err, level + 1) end
  loadingKeys[#loadingKeys + 1] = key
  loadingFiles[#loadingFiles + 1] = file
  local result = run(fn)
  remove(loadingKeys)
  remove(loadingFiles)
  if result[1] == "await" then
    M.drop(result[2])
    error(file .. ": o nível superior de um módulo não pode esperar (await); mova a espera para uma função.", level + 1)
  end
  if result[1] == "error" then
    error({ message = file .. " falhou ao carregar: " .. tostring(result[2]), trace = result[3] }, level + 1)
  end
  local exports = result[2]
  if exports == nil then exports = env end
  modules[key] = exports
  return exports
end

                                                                                          

function M.setRoot(helixValue)
  rootHelix = materialize(helixValue)
end

function M.instantiate(key, file, helixValue, scriptValue)
  local env = newEnv(file, helixValue, scriptValue, key)
  local fn, err = loadChunk(key, env)
  if not fn then return { "error", err, "" } end
  local result = run(fn)
  if result[1] == "await" then
    M.drop(result[2])
    return { "error", file .. ": o nível superior do script não pode esperar (await); mova a espera para onStart ou helix.task.spawn.", "" }
  end
  if result[1] ~= "done" then return result end
  local returned = result[2]
  local hooks = {}
  for _, hook in ipairs(HOOKS) do
    local name, alias = hook[1], hook[2]
    local fn = nil
    if type(returned) == "table" then fn = returned[name] or returned[alias] end
    if fn == nil then fn = rawget(env, name) or rawget(env, alias) end
    if type(fn) == "function" then hooks[name] = registerCallback(fn) end
  end
  return { "done", hooks }
end

function M.loadModule(key, file)
  local ok, result = pcall(requireModule, key, file, 1)
  if ok then return { "done", pack(result) } end
  if type(result) == "table" then return { "error", tostring(result.message), tostring(result.trace or "") } end
  return { "error", tostring(result), "" }
end

function M.unloadModule(key)
  modules[key] = nil
end

return M
`;
}
