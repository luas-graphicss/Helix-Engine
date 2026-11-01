import { HOOK_NAMES, hookAliases } from '../foreign-values';
export const PHP_KIND_KEY = '@hx';
export const PHP_SCRIPT_DIR = '/helix/scripts/';
export const PHP_PRELUDE_FILE = 'php-wasm run script';
const PHP_HOST_NAME = 'shared';
export const PHP_INI = ['display_errors=stderr', 'log_errors=0', 'html_errors=0', 'error_reporting=E_ALL', 'memory_limit=256M', 'max_execution_time=0', 'serialize_precision=-1', 'precision=17', 'zend.assertions=1', 'assert.exception=1'].join('\n');
export function phpPreludeSource(): string {
    const hooks = HOOK_NAMES.map((name) => `'${name}' => [${hookAliases(name)
        .map((alias) => `'${alias}'`)
        .join(', ')}]`).join(', ');
    return String.raw `<?php
declare(strict_types=1);

namespace Helix {

const KIND = '${PHP_KIND_KEY}';
const SCRIPT_DIR = '${PHP_SCRIPT_DIR}';
const HOOKS = [${hooks}];
const MAX_DEPTH = 8;
const JSON_OUT = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION;
const PENDING_MESSAGE = 'esta chamada devolveu uma espera da engine: dentro de um hook gerador, escreva "yield" antes dela (yield $this->helix->task->wait(1)) para receber o resultado.';

                                                                                                
final class EngineError extends \RuntimeException
{
    public function __construct(string $message, public readonly string $engineName = 'Error')
    {
        parent::__construct($message);
    }
}

                                                                                                             
final class Pending
{
    public function __construct(public readonly int $token)
    {
    }

    public function __get(string $name): mixed
    {
        throw new EngineError(PENDING_MESSAGE);
    }

    public function __call(string $name, array $args): mixed
    {
        throw new EngineError(PENDING_MESSAGE);
    }

    public function __toString(): string
    {
        return '<espera pela engine; use yield dentro de um hook gerador>';
    }
}

                                                                                         
final class Data extends \ArrayObject implements \JsonSerializable
{
    public function __construct(array $fields = [])
    {
        parent::__construct($fields, \ArrayObject::ARRAY_AS_PROPS);
    }

    public function jsonSerialize(): array
    {
        return $this->getArrayCopy();
    }
}

                                                                                                                                              
final class Vec extends \ArrayObject implements \JsonSerializable, \Stringable
{
    private const AXES = ['x' => 0, 'y' => 1, 'z' => 2, 'w' => 3, 'r' => 0, 'g' => 1, 'b' => 2];

    public function __construct(array $numbers)
    {
        parent::__construct(array_values($numbers));
    }

    private static function index(mixed $offset): mixed
    {
        return is_string($offset) ? (self::AXES[$offset] ?? $offset) : $offset;
    }

    public function offsetGet(mixed $offset): mixed
    {
        return parent::offsetGet(self::index($offset));
    }

    public function offsetSet(mixed $offset, mixed $value): void
    {
        parent::offsetSet(self::index($offset), $value);
    }

    public function offsetExists(mixed $offset): bool
    {
        return parent::offsetExists(self::index($offset));
    }

    public function offsetUnset(mixed $offset): void
    {
        parent::offsetUnset(self::index($offset));
    }

    public function __get(string $name): mixed
    {
        return $this->offsetGet($name);
    }

    public function __set(string $name, mixed $value): void
    {
        $this->offsetSet($name, $value);
    }

    public function __isset(string $name): bool
    {
        return $this->offsetExists($name);
    }

    public function jsonSerialize(): array
    {
        return $this->getArrayCopy();
    }

    public function __toString(): string
    {
        return '(' . implode(', ', $this->getArrayCopy()) . ')';
    }
}

                                                                                                  
final class Ref implements \ArrayAccess, \Countable, \IteratorAggregate, \JsonSerializable, \Stringable
{
    public function __construct(private readonly Game $game, public readonly int $id)
    {
    }

    public function __get(string $name): mixed
    {
        return $this->game->read($this->id, $name);
    }

    public function __set(string $name, mixed $value): void
    {
        $this->game->write($this->id, $name, $value);
    }

    public function __isset(string $name): bool
    {
        return $this->game->read($this->id, $name) !== null;
    }

    public function __unset(string $name): void
    {
        $this->game->write($this->id, $name, null);
    }

    public function __call(string $name, array $args): mixed
    {
        $member = $this->game->read($this->id, $name);
        if (!$member instanceof Func) {
            throw new EngineError(sprintf('%s não é uma função de %s (é %s).', $name, $this->game->describe($this->id), get_debug_type($member)));
        }
        return $member(...$args);
    }

    public function offsetGet(mixed $offset): mixed
    {
        return $this->game->read($this->id, Game::key($offset));
    }

    public function offsetSet(mixed $offset, mixed $value): void
    {
        $this->game->write($this->id, Game::key($offset), $value);
    }

    public function offsetExists(mixed $offset): bool
    {
        return $this->game->read($this->id, Game::key($offset)) !== null;
    }

    public function offsetUnset(mixed $offset): void
    {
        $this->game->write($this->id, Game::key($offset), null);
    }

                                                                                                                                           
    public function count(): int
    {
        $member = $this->game->read($this->id, 'count');
        if ($member instanceof Func) {
            return (int) $member();
        }
        return $this->game->length($this->id);
    }

    public function getIterator(): \Generator
    {
        foreach ($this->game->keys($this->id) as $key) {
            yield $key => $this->game->read($this->id, $key);
        }
    }

    public function jsonSerialize(): array
    {
        return [KIND => $this->id];
    }

    public function __toString(): string
    {
        return $this->game->describe($this->id);
    }

    public function __invoke(mixed ...$args): mixed
    {
        throw new EngineError($this->game->describe($this->id) . ' não é uma função; chame um de seus métodos.');
    }
}

                                                                                            
final class Func
{
    public function __construct(private readonly Game $game, public readonly int $id)
    {
    }

    public function __invoke(mixed ...$args): mixed
    {
        $positional = [];
        $named = [];
        foreach ($args as $key => $value) {
            if (is_int($key)) {
                $positional[] = $value;
            } else {
                $named[$key] = $value;
            }
        }
        if ($named !== []) {
            $positional[] = $named;
        }
        return $this->game->invoke($this->id, $positional);
    }

    public function __toString(): string
    {
        return '<função da engine #' . $this->id . '>';
    }
}

   
                                                                             
                                                                            
                                                                             
                                                                               
   
abstract class Script
{
                        
    public mixed $helix = null;
                        
    public mixed $self = null;
                        
    public mixed $actor = null;
                        
    public mixed $entity = null;
                             
    public mixed $script = null;
}

                                                                                
final class Included
{
    public function __construct(
        public readonly string $version,
                                                                                                       
        public readonly bool $declared,
                                                                              
        public readonly array $classes,
                                                                                            
        public readonly array $functions,
        public readonly mixed $returned,
    ) {
    }
}

final class Game
{
    public static ?Game $instance = null;

                                               
    private array $refs = [];
                                                
    private array $fns = [];
                                    
    private array $callbacks = [];
    private \SplObjectStorage $callbackIds;
    private int $nextCallback = 0;
                                                                      
    private array $modules = [];
                                       
    private array $included = [];
                                                                                                
    private array $keysByPath = [];
                                                                                            
    private array $loading = [];
                                      
    private array $generators = [];
    private int $nextToken = 0;
    private ?Ref $root = null;
    private bool $disposed = false;
    private string $pendingOutput = '';
    private ?array $pendingOutputAt = null;

    public function __construct(private readonly object $host)
    {
        $this->callbackIds = new \SplObjectStorage();
        self::$instance = $this;
    }

                                                                                              

    public function ref(int $id): Ref
    {
        $ref = isset($this->refs[$id]) ? $this->refs[$id]->get() : null;
        if ($ref === null) {
            $ref = new Ref($this, $id);
            $this->refs[$id] = \WeakReference::create($ref);
        }
        return $ref;
    }

    public function func(int $id): Func
    {
        $fn = isset($this->fns[$id]) ? $this->fns[$id]->get() : null;
        if ($fn === null) {
            $fn = new Func($this, $id);
            $this->fns[$id] = \WeakReference::create($fn);
        }
        return $fn;
    }

                                                                                                                                     
    public function materialize(mixed $json): mixed
    {
        if ($json === null || $json === '') {
            return null;
        }
        return $this->walk(json_decode((string) $json, true, 512, JSON_THROW_ON_ERROR), 0);
    }

    private function walk(mixed $value, int $depth): mixed
    {
        if (!is_array($value)) {
            return $value;
        }
        if (array_is_list($value)) {
            if ($depth > MAX_DEPTH) {
                return $value;
            }
            return array_map(fn (mixed $item) => $this->walk($item, $depth + 1), $value);
        }
        $kind = $value[KIND] ?? null;
        if ($kind === null) {
            if ($depth > MAX_DEPTH) {
                return new Data($value);
            }
            $fields = [];
            foreach ($value as $key => $item) {
                $fields[$key] = $this->walk($item, $depth + 1);
            }
            return new Data($fields);
        }
        if (is_int($kind) || is_float($kind)) {
            return $this->ref((int) $kind);
        }
        return match ($kind) {
            'ref' => $this->ref((int) $value['id']),
            'fn' => $this->func((int) $value['id']),
            'vec' => new Vec($value['value'] ?? []),
            'data' => $this->walk($value['value'] ?? null, $depth),
            'err' => throw new EngineError((string) ($value['message'] ?? 'erro na engine'), (string) ($value['name'] ?? 'Error')),
            'await' => new Pending((int) ($value['token'] ?? 0)),
            'cb' => $this->callbacks[(int) $value['id']] ?? null,
                                                                                                                                     
            default => new Data($value),
        };
    }

                                                                                                                                             
    public function pack(mixed $value): string
    {
        $encoded = json_encode($this->packValue($value, 0), JSON_OUT);
        return $encoded === false ? 'null' : $encoded;
    }

    private function packValue(mixed $value, int $depth): mixed
    {
        if ($value === null || is_scalar($value)) {
            return $value;
        }
        if ($value instanceof Ref) {
            return [KIND => $value->id];
        }
        if ($value instanceof Func) {
            return [KIND => 'fn', 'id' => $value->id];
        }
        if ($value instanceof Pending) {
            return null;
        }
        if ($value instanceof \Closure) {
            return [KIND => 'cb', 'id' => $this->registerCallback($value)];
        }
        if ($depth > MAX_DEPTH) {
            return is_object($value) && method_exists($value, '__toString') ? (string) $value : get_debug_type($value);
        }
        if ($value instanceof Data) {
            $value = $value->getArrayCopy();
        } elseif ($value instanceof \Traversable) {
            $value = iterator_to_array($value);
        } elseif (is_object($value)) {
            if ($value instanceof \Stringable && !$value instanceof \ArrayObject) {
                return (string) $value;
            }
            $value = get_object_vars($value);
        }
        if (is_array($value)) {
            if (array_is_list($value)) {
                return array_map(fn (mixed $item) => $this->packValue($item, $depth + 1), $value);
            }
            $out = new \stdClass();
            foreach ($value as $key => $item) {
                if ($item !== null) {
                    $out->{(string) $key} = $this->packValue($item, $depth + 1);
                }
            }
            return $out;
        }
        return get_debug_type($value);
    }

    public function registerCallback(callable $callback): int
    {
        $closure = $callback instanceof \Closure ? $callback : \Closure::fromCallable($callback);
        if ($this->callbackIds->contains($closure)) {
            return $this->callbackIds[$closure];
        }
        $id = ++$this->nextCallback;
        $this->callbacks[$id] = $closure;
        $this->callbackIds[$closure] = $id;
        return $id;
    }

    public static function key(mixed $offset): string|int
    {
        if (is_int($offset) || is_string($offset)) {
            return $offset;
        }
        if (is_bool($offset)) {
            return $offset ? 'true' : 'false';
        }
        if (is_float($offset)) {
            return (int) $offset;
        }
        throw new EngineError(sprintf('chave inv��lida (%s): objetos da engine só aceitam nomes (texto) ou índices (número).', get_debug_type($offset)));
    }

                                                                                                  

    public function read(int $id, string|int $key): mixed
    {
        return $this->materialize($this->host->get($id, $key));
    }

    public function write(int $id, string|int $key, mixed $value): void
    {
        $this->materialize($this->host->set($id, $key, $this->pack($value)));
    }

    public function invoke(int $fnId, array $args): mixed
    {
        return $this->materialize($this->host->call($fnId, $this->pack($args)));
    }

    public function describe(int $id): string
    {
        return (string) $this->host->str($id);
    }

    public function length(int $id): int
    {
        return (int) $this->host->len($id);
    }

                                   
    public function keys(int $id): array
    {
        $keys = json_decode((string) $this->host->keys($id), true);
        return is_array($keys) ? array_values($keys) : [];
    }

                                                                                                   

                                                                                                   
    public function attach(): void
    {
        ob_start($this->output(...), 1);
        set_error_handler($this->warning(...));
    }

       
                                                                         
                                                                            
                                                                           
                       
       
    public function recover(): void
    {
        $this->loading = [];
        $this->pendingOutput = '';
        $this->pendingOutputAt = null;
        if (ob_get_level() === 0) {
            ob_start($this->output(...), 1);
        }
        set_error_handler($this->warning(...));
    }

       
                                                                               
                                                                            
                                                                       
                                                                          
       
    private function output(string $chunk, int $phase): string
    {
        if ($chunk === '') {
            return '';
        }
        if ($this->pendingOutput === '' && preg_match('/^\s*(?:PHP )?(Fatal error|Parse error|Compile error|Warning|Notice|Deprecated): (.*) in (.+?) on line (\d+)\s*$/s', $chunk, $match) === 1) {
            [, $kind, $text, $file, $line] = $match;
                                                                                                                          
            if (preg_match('/^(.+?)\((\d+)\) : eval\(\)\'d code$/', $file, $evalMatch) === 1) {
                [, $file, $line] = $evalMatch;
            }
            $message = preg_replace('/ in \S+:\d+$/', '', strtok($text, "\n") ?: $text) ?? $text;
            $message = str_replace(SCRIPT_DIR, '', preg_replace('/^Uncaught /', '', $message) ?? $message);
            if ($kind === 'Fatal error' || $kind === 'Parse error' || $kind === 'Compile error') {
                $this->host->fatal($message, $file, (int) $line);
            } else {
                $this->host->console($kind === 'Warning' ? 'warn' : 'debug', $kind . ': ' . $message, $file, (int) $line);
            }
            return '';
        }
        $at = $this->scriptFrame(debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS));
        if ($this->pendingOutput !== '' && $at != $this->pendingOutputAt) {
            $this->flushOutput();
        }
        $this->pendingOutputAt = $at;
        $this->pendingOutput .= $chunk;
        if (str_ends_with($chunk, "\n")) {
            $this->flushOutput();
        }
        return '';
    }

    public function flushOutput(): void
    {
        if ($this->pendingOutput === '') {
            return;
        }
        $text = rtrim($this->pendingOutput, "\n");
        $at = $this->pendingOutputAt;
        $this->pendingOutput = '';
        $this->pendingOutputAt = null;
        $this->host->console('info', $text, $at[0] ?? null, $at[1] ?? 0);
    }

    private function warning(int $level, string $message, string $file, int $line): bool
    {
        if ((error_reporting() & $level) === 0) {
            return true;
        }
        $severity = match ($level) {
            E_USER_ERROR, E_RECOVERABLE_ERROR => 'error',
            E_DEPRECATED, E_USER_DEPRECATED, E_NOTICE, E_USER_NOTICE => 'debug',
            default => 'warn',
        };
        $label = match ($level) {
            E_DEPRECATED, E_USER_DEPRECATED => 'Deprecated',
            E_NOTICE, E_USER_NOTICE => 'Notice',
            E_USER_ERROR, E_RECOVERABLE_ERROR => 'Error',
            default => 'Warning',
        };
        $at = str_starts_with($file, SCRIPT_DIR) ? [$file, $line] : $this->scriptFrame(debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS));
        $this->host->console($severity, $label . ': ' . $message, $at[0] ?? null, $at[1] ?? 0);
        return true;
    }

                                                                                                    
    private function scriptFrame(array $trace): ?array
    {
        foreach ($trace as $index => $frame) {
            $file = $frame['file'] ?? '';
            if (str_starts_with($file, SCRIPT_DIR)) {
                $function = $trace[$index + 1]['function'] ?? null;
                return [$file, (int) ($frame['line'] ?? 0), is_string($function) ? $function : ''];
            }
        }
        return null;
    }

    public function where(): ?string
    {
        $at = $this->scriptFrame(debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS));
        return $at === null ? null : json_encode($at, JSON_OUT);
    }

                                                                                                   

       
                                                                                
                                                                              
                                                                               
                                                               
       
    private function include(string $key, string $file, string $path, string $version, ?Ref $helix, mixed $script): Included
    {
        $existing = $this->included[$key] ?? null;
        if ($existing !== null && $existing->declared) {
            if ($existing->version !== $version) {
                throw new EngineError(sprintf('%s mudou durante o playtest, mas declara funções ou classes e o PHP não as recarrega a quente. Reinicie o playtest para aplicar a alteração.', $file));
            }
            return $existing;
        }
        $classesBefore = count(get_declared_classes());
        $functionsBefore = count(get_defined_functions()['user']);
        $this->keysByPath[$path] = $key;
        $returned = (static function (string $__path, ?Ref $helix, mixed $script): mixed {
            return require $__path;
        })($path, $helix, $script);
        $classes = array_values(array_filter(array_slice(get_declared_classes(), $classesBefore), fn (string $class) => (new \ReflectionClass($class))->getFileName() === $path));
        $functions = array_values(array_filter(array_slice(get_defined_functions()['user'], $functionsBefore), fn (string $function) => (new \ReflectionFunction($function))->getFileName() === $path));
        $declared = $classes !== [] || $functions !== [];
        $included = new Included($version, $declared, $classes, $functions, $returned);
        $this->included[$key] = $included;
        return $included;
    }

                                                                                                                               
    private function hooksFromValue(mixed $value): array
    {
        $hooks = [];
        if ($value instanceof Data) {
            $value = $value->getArrayCopy();
        }
        if (is_array($value)) {
            foreach (HOOKS as $hook => $aliases) {
                foreach ($aliases as $alias) {
                    $candidate = $value[$alias] ?? null;
                    if ($candidate instanceof \Closure) {
                        $hooks[$hook] = $candidate;
                        break;
                    }
                }
            }
        } elseif (is_object($value) && !$value instanceof Ref && !$value instanceof Func) {
            $hooks = $this->hooksFromInstance($value);
        }
        return $hooks;
    }

    private function hooksFromInstance(object $instance): array
    {
        $hooks = [];
        foreach (HOOKS as $hook => $aliases) {
            foreach ($aliases as $alias) {
                if (method_exists($instance, $alias)) {
                    $hooks[$hook] = \Closure::fromCallable([$instance, $alias]);
                    break;
                }
            }
        }
        return $hooks;
    }

    private static function declaresHooks(string $class): bool
    {
        foreach (HOOKS as $aliases) {
            foreach ($aliases as $alias) {
                if (method_exists($class, $alias)) {
                    return true;
                }
            }
        }
        return false;
    }

       
                                                                             
                                                                        
                                                                             
                                                                              
                                                 
       
    private function hooksFromClass(Included $included, string $file, string $classId, ?Ref $helix, mixed $script): array
    {
        $candidates = array_values(array_filter($included->classes, fn (string $class) => self::declaresHooks($class) && !(new \ReflectionClass($class))->isAbstract()));
        if ($candidates === []) {
            return [];
        }
        $wanted = strtolower($classId);
        $named = array_values(array_filter($candidates, fn (string $class) => strtolower((new \ReflectionClass($class))->getShortName()) === $wanted));
        if (count($named) === 1) {
            $class = $named[0];
        } elseif (count($candidates) === 1) {
            $class = $candidates[0];
        } else {
            throw new EngineError(sprintf('%s define várias classes com hooks (%s); nomeie uma como o arquivo ou deixe só uma.', $file, implode(', ', array_map(fn (string $class) => (new \ReflectionClass($class))->getShortName(), $candidates))));
        }
        $reflection = new \ReflectionClass($class);
        $constructor = $reflection->getConstructor();
        if ($constructor !== null && $constructor->getNumberOfRequiredParameters() > 0) {
            throw new EngineError(sprintf('a classe %s precisa de um construtor sem parâmetros obrigatórios para a engine instanciá-la por ator.', $reflection->getShortName()));
        }
        $instance = $reflection->newInstance();
        $entity = $helix?->self;
        foreach (['helix' => $helix, 'self' => $entity, 'actor' => $entity, 'entity' => $entity, 'script' => $script] as $name => $value) {
            if ($instance instanceof Script || property_exists($instance, $name)) {
                $instance->{$name} = $value;
            }
        }
        return $this->hooksFromInstance($instance);
    }

    private function exportsOf(Included $included): mixed
    {
        if ($included->returned !== null && $included->returned !== 1) {
            return $included->returned;
        }
        $exports = [];
        foreach ($included->functions as $function) {
            $exports[(new \ReflectionFunction($function))->getShortName()] = \Closure::fromCallable($function);
        }
        return $exports;
    }

                                                                                                                                                        
    public function requireScript(string $name, ?string $fromPath): mixed
    {
        if ($name === 'helix') {
            return $this->root;
        }
        $fromKey = $fromPath !== null ? ($this->keysByPath[$fromPath] ?? null) : null;
        $resolved = $this->materialize($this->host->resolve($fromKey, $name));
        if ($resolved instanceof Data && ($resolved[KIND] ?? null) === 'module') {
            return $this->requireModule((string) $resolved['key'], (string) $resolved['file'], (string) $resolved['path'], (string) $resolved['version']);
        }
        if ($resolved instanceof Data && ($resolved[KIND] ?? null) === 'missing') {
            throw new EngineError((string) $resolved['message']);
        }
        return $resolved;
    }

    public function requireModule(string $key, string $file, string $path, string $version): mixed
    {
        if (array_key_exists($key, $this->modules)) {
            return $this->modules[$key];
        }
        foreach ($this->loading as $index => [$loadingKey]) {
            if ($loadingKey === $key) {
                $chain = array_map(fn (array $entry) => $entry[1], array_slice($this->loading, $index));
                $chain[] = $file;
                throw new EngineError('Importação circular: ' . implode(' → ', $chain) . '. Quebre o ciclo movendo o que os dois usam para um terceiro módulo.');
            }
        }
        $this->loading[] = [$key, $file];
        try {
            $included = $this->include($key, $file, $path, $version, $this->root, null);
        } finally {
            array_pop($this->loading);
        }
        $exports = $this->exportsOf($included);
        $this->modules[$key] = $exports;
        return $exports;
    }

                                                                                                  

       
                                                                            
                                                                                   
                                                                                  
                                                                             
       
    private function failure(\Throwable $exception): array
    {
        $frames = [];
        $location = [$exception->getFile(), $exception->getLine()];
        foreach ($exception->getTrace() as $frame) {
            if (str_starts_with($location[0], SCRIPT_DIR)) {
                $frames[] = [$location[0], $location[1], self::frameName($frame)];
            }
            $location = [(string) ($frame['file'] ?? ''), (int) ($frame['line'] ?? 0)];
        }
        if (str_starts_with($location[0], SCRIPT_DIR)) {
            $frames[] = [$location[0], $location[1], ''];
        }
        $name = $exception instanceof EngineError ? $exception->engineName : (new \ReflectionClass($exception))->getShortName();
        return [KIND => 'err', 'message' => $exception->getMessage() !== '' ? $exception->getMessage() : $name, 'name' => $name, 'frames' => array_reverse($frames)];
    }

    private static function frameName(array $frame): string
    {
        $function = (string) ($frame['function'] ?? '');
        if ($function === '' || in_array($function, ['require', 'require_once', 'include', 'include_once'], true)) {
            return '';
        }
        if (str_starts_with($function, '{closure')) {
            return 'closure';
        }
        return (string) ($frame['class'] ?? '') . (string) ($frame['type'] ?? '') . $function;
    }

    private function reply(array $result): string
    {
        $this->flushOutput();
        $encoded = json_encode($result, JSON_OUT);
        return $encoded === false ? '["error",{"' . KIND . '":"err","message":"resposta do prelúdio não serializável","name":"Error","frames":[]}]' : $encoded;
    }

    private function error(\Throwable $exception): string
    {
        return $this->reply(['error', $this->failure($exception)]);
    }

                                                                                                        

    public function setRoot(string $json): void
    {
        $this->root = $this->materialize($json);
    }

    public function instantiate(string $key, string $file, string $path, string $version, string $classId, string $helixJson, string $scriptJson): string
    {
        try {
            $helix = $this->materialize($helixJson);
            $script = $this->materialize($scriptJson);
            $included = $this->include($key, $file, $path, $version, $helix, $script);
                                                                                                                                    
            $hooks = $this->hooksFromClass($included, $file, $classId, $helix, $script);
            if ($hooks === [] && !$included->declared) {
                $hooks = $this->hooksFromValue($included->returned);
            }
`;
}
