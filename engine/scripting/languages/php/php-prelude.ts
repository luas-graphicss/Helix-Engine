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
                                                
`;
}
