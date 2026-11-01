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
`;
}
