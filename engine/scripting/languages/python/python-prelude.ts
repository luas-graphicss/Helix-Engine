import { HOOK_NAMES, hookAliases } from '../foreign-values';
export const PYTHON_PRELUDE_FILE = '<helix>';
export const PYTHON_KIND_KEY = '@hx';
const BLOCKED_MODULES = ['os', 'sys', 'js', 'pyodide', '_pyodide', '__main__', 'subprocess', 'importlib', 'ctypes', 'socket', 'threading', 'multiprocessing', 'signal', 'micropip', 'pathlib', 'shutil', 'tempfile', 'webbrowser', 'builtins', 'gc', 'code', 'codeop', 'pdb', 'runpy', 'pkgutil', 'zipimport', 'sysconfig', 'site'];
const BLOCKED_BUILTINS = ['input', 'open', 'exit', 'quit', 'help', 'breakpoint', 'copyright', 'credits', 'license'];
export function pythonPreludeSource(): string {
    const hooks = HOOK_NAMES.map((name) => `("${name}", (${hookAliases(name)
        .map((alias) => `"${alias}"`)
        .join(', ')}))`).join(', ');
    const blockedModules = BLOCKED_MODULES.map((name) => `"${name}"`).join(', ');
    const blockedBuiltins = BLOCKED_BUILTINS.map((name) => `"${name}"`).join(', ');
    return String.raw `
import ast, builtins, inspect, marshal, re, sys, traceback, types, unicodedata, warnings, weakref
import js
from pyodide.ffi import JsProxy, to_js

KIND = "${PYTHON_KIND_KEY}"
PRELUDE_FILE = "${PYTHON_PRELUDE_FILE}"
HOOKS = (${hooks},)
BLOCKED_MODULES = frozenset((${blockedModules}))
BLOCKED_BUILTINS = (${blockedBuiltins})
MAX_DEPTH = 8
_real_import = builtins.__import__


class HelixError(Exception):
    """Erro da engine relançado no ponto da chamada, com o nome do tipo original em engine_name."""

    def __init__(self, message, engine_name="Error"):
        super().__init__(message)
        self.engine_name = engine_name


def _jsobj(value):
    return to_js(value, dict_converter=js.Object.fromEntries, create_pyproxies=False)


class Data(dict):
    """Dado copiado da engine: um dict que também aceita acesso por atributo (v.x além de v["x"]), como o objeto JS original."""

    __slots__ = ()

    def __getattr__(self, name):
        try:
            return self[name]
        except KeyError:
            raise AttributeError(name) from None

    def __setattr__(self, name, value):
        self[name] = value

    def __delattr__(self, name):
        try:
            del self[name]
        except KeyError:
            raise AttributeError(name) from None


_AXES = {"x": 0, "y": 1, "z": 2, "w": 3, "r": 0, "g": 1, "b": 2}


class Vec(list):
    """Vetor da engine copiado (posição, cor, quaternion): lista de 3 ou 4 números que também aceita v.x, v.y, v.z, v.w (e r, g, b em cores)."""

    __slots__ = ()

    def __getattr__(self, name):
        index = _AXES.get(name)
        if index is None or index >= len(self):
            raise AttributeError(name)
        return self[index]

    def __setattr__(self, name, value):
        index = _AXES.get(name)
        if index is None or index >= len(self):
            raise AttributeError(name)
        self[index] = value

    def __repr__(self):
        return "(" + ", ".join(repr(item) for item in self) + ")"


class Pending:
    """
    Resultado de uma chamada que devolveu uma promessa. Ao ser aguardado, entrega-se
    ao driver da corrotina (yield), que devolve a promessa ao host; quando ela
    resolve, o host retoma a corrotina com o valor já materializado.
    """

    __slots__ = ("_promise",)

    def __init__(self, promise):
        self._promise = promise

    def __await__(self):
        value = yield self
        return value

    def __repr__(self):
        return "<espera pela engine; use await dentro de um hook async>"


async def _as_coroutine(awaitable):
    return await awaitable


AWAIT_OUTSIDE_ENGINE = "a espera (await) nos scripts só funciona com chamadas da engine, como helix.task.wait; aguardáveis do asyncio (asyncio.sleep, Future) não rodam aqui."


class Ref:
    """Objeto vivo da engine. Atributos e itens vão ao host; escritas atravessam."""

    __slots__ = ("_game", "_id", "__weakref__")

    def __init__(self, game, id):
        object.__setattr__(self, "_game", game)
        object.__setattr__(self, "_id", id)

    def __getattr__(self, name):
        if name.startswith("__") and name.endswith("__"):
            raise AttributeError(name)
        return self._game.get(self._id, name)

    def __setattr__(self, name, value):
        self._game.set(self._id, name, value)

    def __delattr__(self, name):
        self._game.set(self._id, name, None)

    def __getitem__(self, key):
        return self._game.get(self._id, _key(key))

    def __setitem__(self, key, value):
        self._game.set(self._id, _key(key), value)

    def __len__(self):
        return int(self._game.host.len(self._id))

    def __iter__(self):
        keys = self._game.keys(self._id)
        if keys and isinstance(keys[0], (int, float)):
            for key in keys:
                yield self._game.get(self._id, key)
        else:
            yield from keys

    def __contains__(self, key):
        return _key(key) in self._game.keys(self._id)

    def __dir__(self):
        return [str(key) for key in self._game.keys(self._id)]

    def __call__(self, *args, **kwargs):
        raise TypeError(repr(self) + " não é uma função; chame um de seus métodos.")

    def __bool__(self):
        return True

    def __eq__(self, other):
        return isinstance(other, Ref) and other._id == self._id

    def __hash__(self):
        return hash(self._id)

    def __repr__(self):
        return str(self._game.host.str(self._id))

    __str__ = __repr__


class Fn:
    """Função da engine. Argumentos nomeados viram um dicionário de opções no fim da chamada."""

    __slots__ = ("_game", "_id", "__weakref__")

    def __init__(self, game, id):
        self._game = game
        self._id = id

    def __call__(self, *args, **kwargs):
        if kwargs:
            args = (*args, kwargs)
        return self._game.call(self._id, args)

    def __repr__(self):
        return "<função da engine #%d>" % self._id


def _key(key):
    if isinstance(key, bool):
        return str(key).lower()
    if isinstance(key, (int, float, str)):
        return key
    raise TypeError("chave inválida (%r): objetos da engine só aceitam nomes (texto) ou índices (número)." % (key,))


def _max_positional(fn):
    """Quantos argumentos posicionais fn aceita; None quando aceita qualquer número (*args) ou a assinatura não é inspecionável."""
    try:
        parameters = inspect.signature(fn).parameters.values()
    except (TypeError, ValueError):
        return None
    count = 0
    for parameter in parameters:
        if parameter.kind is inspect.Parameter.VAR_POSITIONAL:
            return None
        if parameter.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD):
            count += 1
    return count


def _hook_methods(cls):
    """Hooks que uma classe define, pelo nome canônico → nome do método (on_start ou onStart)."""
    found = {}
    for hook, aliases in HOOKS:
        for alias in aliases:
            if callable(getattr(cls, alias, None)):
                found[hook] = alias
                break
    return found


def _identifier(name):
    """Identificador que o editor dá a um script pelo nome do arquivo (sem acentos, em PascalCase), para achar a classe principal."""
    plain = "".join(ch for ch in unicodedata.normalize("NFD", name) if unicodedata.category(ch) != "Mn")
    safe = "".join(part[:1].upper() + part[1:] for part in re.split(r"[^a-zA-Z0-9]+", plain) if part) or "Script"
    return "S" + safe if safe[0].isdigit() else safe


class Game:
    def __init__(self, host):
        self.host = host
        self.refs = weakref.WeakValueDictionary()
        self.fns = weakref.WeakValueDictionary()
        self.callbacks = {}
        self.callback_ids = {}
                                                                                                                                                  
        self.arities = {}
        self.next_callback = 0
        self.modules = {}
        self.loading = []
        self.files = set()
        self.pending = {}
        self.next_token = 0
        self.root_helix = None
        self.disposed = False
        self.builtins = self._make_builtins()

                                                                                       

    def ref(self, id):
        ref = self.refs.get(id)
        if ref is None:
            ref = Ref(self, id)
            self.refs[id] = ref
        return ref

    def fn(self, id):
        fn = self.fns.get(id)
        if fn is None:
            fn = Fn(self, id)
            self.fns[id] = fn
        return fn

    def materialize(self, value):
        if isinstance(value, JsProxy):
            value = value.to_py()
        return self._walk(value, 0)

    def _walk(self, value, depth):
        kind_of = type(value)
        if kind_of is dict:
            kind = value.get(KIND)
            if kind is None:
                if depth > MAX_DEPTH:
                    return Data(value)
                return Data((key, self._walk(item, depth + 1)) for key, item in value.items())
            if isinstance(kind, (int, float)):
                return self.ref(int(kind))
            if kind == "ref":
                return self.ref(int(value["id"]))
            if kind == "fn":
                return self.fn(int(value["id"]))
            if kind == "vec":
                return Vec(value.get("value") or ())
            if kind == "data":
                return self._walk(value.get("value"), depth)
            if kind == "err":
                raise HelixError(str(value.get("message", "erro na engine")), str(value.get("name", "Error")))
            if kind == "await":
                return Pending(value.get("promise"))
            if kind == "cb":
                return self.callbacks.get(int(value["id"]))
            return value
        if kind_of is list:
            if depth > MAX_DEPTH:
                return value
            return [self._walk(item, depth + 1) for item in value]
        return value

    def pack(self, value):
        return _jsobj(self._pack(value, 0))

    def _pack(self, value, depth):
        if value is None or isinstance(value, (bool, int, float, str)):
            return value
        if isinstance(value, Ref):
            return {KIND: value._id}
        if isinstance(value, Fn):
            return {KIND: "fn", "id": value._id}
        if isinstance(value, Pending):
            return None
        if depth > MAX_DEPTH:
            return str(value)
        if isinstance(value, dict):
            return {str(key): self._pack(item, depth + 1) for key, item in value.items() if item is not None}
        if isinstance(value, (list, tuple, set, frozenset)):
            return [self._pack(item, depth + 1) for item in value]
        if callable(value):
            return {KIND: "cb", "id": self.register_callback(value)}
        if isinstance(value, (bytes, bytearray, memoryview)):
            return list(bytes(value))
        fields = getattr(value, "__dict__", None)
        if isinstance(fields, dict):
            return {key: self._pack(item, depth + 1) for key, item in fields.items() if not key.startswith("_") and item is not None}
        return str(value)

    def register_callback(self, fn):
        id = self.callback_ids.get(fn)
        if id is None:
            self.next_callback += 1
            id = self.next_callback
            self.callbacks[id] = fn
            self.callback_ids[fn] = id
            self.arities[id] = _max_positional(fn)
        return id

                                                                                         

    def get(self, id, key):
        return self.materialize(self.host.get(id, key))

    def set(self, id, key, value):
        result = self.host.set(id, key, self.pack(value))
        if result is not None:
            self.materialize(result)

    def call(self, id, args):
        return self.materialize(self.host.call(id, *[self.pack(arg) for arg in args]))

    def keys(self, id):
        keys = self.host.keys(id)
        return keys.to_py() if isinstance(keys, JsProxy) else list(keys)

                                                                                        

    def _make_builtins(self):
        safe = dict(vars(builtins))
        for name in BLOCKED_BUILTINS:
            safe.pop(name, None)
        safe["__import__"] = self._import
        safe["print"] = self._print
        safe["HelixError"] = HelixError
        return safe

    def _env(self, file, key, helix, script):
        self.files.add(file)
        return {
            "__name__": file.rsplit(".", 1)[0],
            "__file__": file,
            "__builtins__": self.builtins,
            "__helix_key__": key,
            "helix": helix,
            "script": script,
            "print": self._print,
        }

    def _print(self, *args, sep=" ", end="\n", file=None, flush=False):
        text = sep.join(str(arg) for arg in args)
        if end != "\n":
            text = (text + end).rstrip("\n")
        level = "warn" if file is not None and file is sys.stderr else "info"
        location = self._frame_location(sys._getframe(1))
        self.host.console(level, text, location[0] if location else None, location[1] if location else None)

    def _frame_location(self, frame):
        while frame is not None:
            name = frame.f_code.co_filename
            if name in self.files:
                return (name, frame.f_lineno, frame.f_code.co_name)
            frame = frame.f_back
        return None

    def where(self):
        location = self._frame_location(sys._getframe(1))
        return _jsobj(list(location)) if location else None

    def _code(self, key):
        artifact = self.materialize(self.host.code(key))
        if isinstance(artifact, JsProxy):
            artifact = artifact.to_bytes()
        return marshal.loads(bytes(artifact))

                                                                                          

    def _import(self, name, globals=None, locals=None, fromlist=(), level=0):
        top = name.partition(".")[0]
        if level == 0:
            if top == "helix":
                                                                                                      
                return self.root_helix
            if top in BLOCKED_MODULES:
                raise ImportError("o módulo %s não está disponível para scripts da engine." % top)
            from_key = globals.get("__helix_key__") if isinstance(globals, dict) else None
            resolved = self.materialize(self.host.resolve(from_key, name))
            if isinstance(resolved, dict) and resolved.get(KIND) == "module":
                return self.require_module(resolved["key"], resolved["file"])
            missing = resolved.get("message") if isinstance(resolved, dict) and resolved.get(KIND) == "missing" else None
            if missing is None and resolved is not None:
                return self._foreign_module(name, resolved)
            try:
                return _real_import(name, globals, locals, fromlist, level)
            except ModuleNotFoundError as exc:
                if missing and exc.name == top:
                    raise ImportError(missing) from None
                raise
        return _real_import(name, globals, locals, fromlist, level)

    def _foreign_module(self, name, exports):
        """Exportações de um script JS/TS ou Lua: um dict vira módulo com atributos; um objeto vivo é importado como está."""
        if not isinstance(exports, dict):
            return exports
        module = types.ModuleType(name)
        for key, value in exports.items():
            if isinstance(key, str) and key.isidentifier():
                setattr(module, key, value)
        module.default = exports
        return module

    def require_module(self, key, file):
        module = self.modules.get(key)
        if module is not None:
            return module
        for index, (loading_key, loading_file) in enumerate(self.loading):
            if loading_key == key:
                chain = [entry[1] for entry in self.loading[index:]] + [file]
                raise ImportError("Importação circular: " + " → ".join(chain) + ". Quebre o ciclo movendo o que os dois usam para um terceiro módulo.")
        code = self._code(key)
        module = types.ModuleType(file.rsplit(".", 1)[0])
        module.__dict__.update(self._env(file, key, self.root_helix, None))
        self.loading.append((key, file))
        try:
            exec(code, module.__dict__)
        finally:
            self.loading.pop()
        self.modules[key] = module
        return module

    def _exports(self, module):
        return {key: value for key, value in vars(module).items() if not key.startswith("_") and key not in ("helix", "script", "print") and not isinstance(value, types.ModuleType)}

                                                                                           

    def _failure(self, exc):
        frames = []
        for frame in traceback.extract_tb(exc.__traceback__):
            if frame.filename in self.files:
                frames.append([frame.filename, frame.lineno or 0, frame.name])
        name = exc.engine_name if isinstance(exc, HelixError) else type(exc).__name__
        return {KIND: "err", "message": str(exc) or name, "name": name, "frames": frames}

    def _error(self, exc):
        return _jsobj(["error", self._failure(exc)])

                                                                                                

    def set_root(self, helix_value):
        self.root_helix = self.materialize(helix_value)

    def instantiate(self, key, file, helix_value, script_value):
        try:
            helix = self.materialize(helix_value)
            script = self.materialize(script_value)
            env = self._env(file, key, helix, script)
            exec(self._code(key), env)
            hooks = self._module_hooks(env) or self._class_hooks(env, file, helix, script)
            return _jsobj(["done", {hook: self.register_callback(fn) for hook, fn in hooks.items()}])
        except BaseException as exc:
            return self._error(exc)

    def _module_hooks(self, env):
        """Hooks como funções do nível do módulo (on_start, on_update…)."""
        hooks = {}
        for hook, aliases in HOOKS:
            for alias in aliases:
                fn = env.get(alias)
                if callable(fn) and not isinstance(fn, type):
                    hooks[hook] = fn
                    break
        return hooks

    def _class_hooks(self, env, file, helix, script):
        """
        Hooks como métodos de uma classe do arquivo (o equivalente ao "export default class"
        do JS): a classe com o nome do arquivo, ou a única que define hooks. Uma instância
        por ator, com actor, entity, helix e script preenchidos antes de qualquer hook.
        """
        module_name = env["__name__"]
        candidates = [value for value in env.values() if isinstance(value, type) and value.__module__ == module_name and _hook_methods(value)]
        if not candidates:
            return {}
        wanted = _identifier(module_name).lower()
        named = [cls for cls in candidates if cls.__name__.lower() == wanted]
        if len(named) == 1:
            cls = named[0]
        elif len(candidates) == 1:
            cls = candidates[0]
        else:
            raise TypeError("%s define várias classes com hooks (%s); nomeie uma como o arquivo ou deixe só uma." % (file, ", ".join(cls.__name__ for cls in candidates)))
        instance = cls()
        entity = helix.self
        for name, value in (("actor", entity), ("entity", entity), ("helix", helix), ("script", script)):
            if getattr(instance, name, None) is None:
                try:
                    setattr(instance, name, value)
                except AttributeError:
                    pass
        return {hook: getattr(instance, alias) for hook, alias in _hook_methods(cls).items()}

    def load_module(self, key, file):
        try:
            module = self.require_module(key, file)
            return _jsobj(["done", self._pack(self._exports(module), 0)])
        except BaseException as exc:
            return self._error(exc)

    def unload_module(self, key):
        self.modules.pop(key, None)

    def invoke(self, id, *args):
        fn = self.callbacks.get(id)
        if fn is None:
            return _jsobj(["error", {KIND: "err", "message": "callback desconhecido (%r)" % (id,), "name": "Error", "frames": []}])
        materialized = [self.materialize(arg) for arg in args]
        limit = self.arities.get(id)
        if limit is not None and len(materialized) > limit:
            del materialized[limit:]
        try:
            result = fn(*materialized)
        except BaseException as exc:
            return self._error(exc)
        if inspect.iscoroutine(result):
            return self._drive(None, result, True, None)
        if inspect.isawaitable(result):
            return self._drive(None, _as_coroutine(result), True, None)
        return _jsobj(["done", self._pack(result, 0)])

                                                                                                         
    def _drive(self, token, coro, ok, value):
        try:
            yielded = coro.send(value) if ok else coro.throw(HelixError(str(value)))
        except StopIteration as stop:
            self._forget(token)
            return _jsobj(["done", self._pack(stop.value, 0)])
        except BaseException as exc:
            self._forget(token)
            return self._error(exc)
        if isinstance(yielded, Pending):
            if token is None:
                self.next_token += 1
                token = self.next_token
            self.pending[token] = coro
            return _jsobj(["await", token, yielded._promise])
        self._forget(token)
        coro.close()
        return _jsobj(["error", {KIND: "err", "message": AWAIT_OUTSIDE_ENGINE, "name": "RuntimeError", "frames": []}])

    def _forget(self, token):
        if token is not None:
            self.pending.pop(token, None)

    def resume(self, token, ok, value):
        coro = self.pending.pop(token, None)
        if coro is None:
            return _jsobj(["error", {KIND: "err", "message": "a corrotina desta espera já foi encerrada", "name": "RuntimeError", "frames": []}])
        return self._drive(token, coro, ok, self.materialize(value) if ok else value)

    def drop(self, token):
        coro = self.pending.pop(token, None)
        if coro is not None:
            try:
                coro.close()
            except BaseException:
                pass

    def dispose(self):
        self.disposed = True
        for coro in list(self.pending.values()):
            try:
                coro.close()
            except BaseException:
                pass
        self.pending.clear()
        self.callbacks.clear()
        self.callback_ids.clear()
        self.arities.clear()
        self.modules.clear()
        self.root_helix = None


def create_game(host):
    return Game(host)


def compile_script(source, file):
    """
    Verifica a sintaxe, serializa o código compilado e lista os imports que
    apontam para scripts da biblioteca (a biblioteca padrão fica de fora; os
    módulos bloqueados viram erro já aqui, com a linha).
    """
    diagnostics = []
    dependencies = []
    artifact = None
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        try:
            tree = ast.parse(source, file)
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        _note_import(alias.name, node, diagnostics, dependencies)
                elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                    _note_import(node.module, node, diagnostics, dependencies)
            artifact = to_js(marshal.dumps(compile(tree, file, "exec", dont_inherit=True)))
        except SyntaxError as exc:
            diagnostics.append({
                "severity": "error",
                "message": exc.msg or "sintaxe inválida",
                "line": exc.lineno or 1,
                "column": exc.offset or 1,
                "endLine": exc.end_lineno or exc.lineno or 1,
                "endColumn": exc.end_offset or (exc.offset or 1),
                "code": type(exc).__name__,
            })
        except (ValueError, RecursionError, MemoryError) as exc:
            diagnostics.append({"severity": "error", "message": str(exc), "line": 1, "column": 1, "code": type(exc).__name__})
    for warning in caught:
        diagnostics.append({
            "severity": "warning",
            "message": str(warning.message),
            "line": getattr(warning, "lineno", 1) or 1,
            "column": 1,
            "code": warning.category.__name__,
        })
    return _jsobj({"artifact": artifact, "diagnostics": diagnostics, "dependencies": dependencies})


def _note_import(dotted, node, diagnostics, dependencies):
    name = dotted.partition(".")[0]
    if not name or name == "helix":
        return
    if name in BLOCKED_MODULES:
        diagnostics.append({
            "severity": "error",
            "message": "O módulo %s não está disponível para scripts da engine." % name,
            "line": node.lineno,
            "column": node.col_offset + 1,
            "endLine": node.end_lineno or node.lineno,
            "endColumn": (node.end_col_offset or node.col_offset) + 1,
            "code": "blocked-module",
        })
        return
    if name in sys.stdlib_module_names or name in dependencies:
        return
    dependencies.append(name)
`;
}
