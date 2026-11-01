export const RUBY_KIND_KEY = '@hx';
export const RUBY_PRELUDE_FILE = '<helix-prelude>';
export function rubyPreludeSource(): string {
    return RUBY_PRELUDE;
}
const RUBY_PRELUDE = String.raw `
                             
require "js"
require "json"

module Helix
  KIND = "@hx"
  PRELUDE_FILE = "<helix-prelude>"
  HOOKS = %w[
    on_load on_start on_update on_fixed_update on_late_update on_render on_enable on_disable on_stop on_destroy
    on_before_hot_reload on_hot_reload on_collision_begin on_collision_stay on_collision_end on_trigger_enter
    on_trigger_stay on_trigger_exit
  ].freeze
  OPERATIONS = %w[set_root instantiate load_module unload_module invoke resume drop].freeze
  GAMES = {}
  ACTIVE = []
  OUTPUTS = []

  def self.camelize(name)
    name.gsub(/_([a-z0-9])/) { ::Regexp.last_match(1).upcase }
  end

                                                                                                                                   
  def self.project_file?(path)
    path.is_a?(::String) && path.end_with?(".rb") && !path.include?("/")
  end

                                                                        
  def self.script_location
    (caller_locations(1, 80) || []).find { |entry| project_file?(entry.path) }
  end

  def self.activate(game)
    ACTIVE.push(game)
  end

  def self.deactivate
    ACTIVE.pop
    OUTPUTS.each(&:flush) if ACTIVE.empty?
  rescue ::Exception
    nil
  end

  def self.active
    ACTIVE.last
  end

                                                                                                                                  
  def self.emit(level, text)
    game = active
    if game
      game.console(level, text, script_location)
    else
      ::JS.global[:console].call(level == "warn" ? :warn : :log, text)
    end
    nil
  end

                                                                                                         
  class Output
    def initialize(level)
      @level = level
      @buffer = +""
      OUTPUTS << self
    end

    def write(*strings)
      text = strings.map(&:to_s).join
      @buffer << text
      while (index = @buffer.index("\n"))
        line = @buffer.slice!(0..index).chomp
        Helix.emit(@level, line)
      end
      text.bytesize
    end

    def <<(text)
      write(text)
      self
    end

    def print(*args)
      write(*args)
      nil
    end

    def puts(*args)
      if args.empty?
        write("\n")
      else
        args.flatten.each do |arg|
          text = arg.to_s
          write(text.end_with?("\n") ? text : "#{text}\n")
        end
      end
      nil
    end

    def printf(format, *args)
      write(::Kernel.format(format, *args))
      nil
    end

    def flush
      return self if @buffer.empty?
      text = @buffer
      @buffer = +""
      Helix.emit(@level, text)
      self
    end

    def sync
      true
    end

    def sync=(_value); end

    def tty?
      false
    end
    alias isatty tty?

    def fileno
      @level == "warn" ? 2 : 1
    end

    def external_encoding
      ::Encoding::UTF_8
    end

    def set_encoding(*); self; end
    def binmode; self; end
    def close; nil; end
    def closed?; false; end
  end

  $stdout = Output.new("info")
  $stderr = Output.new("warn")

                                                                                                                         
                                                                                                                  
                                                                                                                 
                                                                                                                         
  module EnumerableShim
    def self.unpack(values)
      values.size <= 1 ? values[0] : values
    end

    def first(*args)
      if args.empty?
        each { |*values| return EnumerableShim.unpack(values) }
        nil
      else
        take(args[0])
      end
    end

    def take(count)
      count = Integer(count)
      raise ::ArgumentError, "attempt to take negative size" if count.negative?
      result = []
      return result if count.zero?
      each do |*values|
        result << EnumerableShim.unpack(values)
        break if result.size >= count
      end
      result
    end

    def take_while
      return to_enum(:take_while) unless block_given?
      result = []
      each do |*values|
        value = EnumerableShim.unpack(values)
        break unless yield(value)
        result << value
      end
      result
    end

    def find(ifnone = nil)
      return to_enum(:find, ifnone) unless block_given?
      each do |*values|
        value = EnumerableShim.unpack(values)
        return value if yield(value)
      end
      ifnone&.call
    end
    alias detect find

    def find_index(*args)
      return to_enum(:find_index) if args.empty? && !block_given?
      index = 0
      each do |*values|
        value = EnumerableShim.unpack(values)
        return index if args.empty? ? yield(value) : value == args[0]
        index += 1
      end
      nil
    end

    def include?(target)
      each { |*values| return true if EnumerableShim.unpack(values) == target }
      false
    end
    alias member? include?

    def all?(*pattern, &block)
      each { |*values| return false unless EnumerableShim.test(pattern, block, values) }
      true
    end

    def any?(*pattern, &block)
      each { |*values| return true if EnumerableShim.test(pattern, block, values) }
      false
    end

    def none?(*pattern, &block)
      each { |*values| return false if EnumerableShim.test(pattern, block, values) }
      true
    end

    def one?(*pattern, &block)
      count = 0
      each do |*values|
        count += 1 if EnumerableShim.test(pattern, block, values)
        return false if count > 1
      end
      count == 1
    end

    def self.test(pattern, block, values)
      value = unpack(values)
      return pattern[0] === value unless pattern.empty?
      block ? block.call(*values) : value
    end
  end
  ::Enumerable.prepend(EnumerableShim)

  module RangeShim
    def first(*args)
      args.empty? ? super : take(args[0])
    end
  end
  ::Range.prepend(RangeShim)

                                                                                                              
  class EngineError < ::StandardError
    attr_reader :kind

    def initialize(message, kind = "HelixError")
      super(message)
      @kind = kind
    end
  end

                                                                                                                                          
  class Vec < ::Array
    AXES = { x: 0, y: 1, z: 2, w: 3, r: 0, g: 1, b: 2 }.freeze

    AXES.each do |axis, index|
      define_method(axis) { self[index] }
      define_method(:"#{axis}=") { |value| self[index] = value }
    end

    def to_s
      "(#{join(', ')})"
    end
    alias inspect to_s
  end

                                                                                                         
  class Record < ::Hash
    def self.from(hash)
      record = new
      hash.each { |key, value| record.store(key.to_s, value) }
      record
    end

    def [](key)
      super(normalize_key(key))
    end

    def []=(key, value)
      super(normalize_key(key), value)
    end

    def fetch(key, *rest, &block)
      super(normalize_key(key), *rest, &block)
    end

    def key?(key)
      super(normalize_key(key))
    end
    alias has_key? key?
    alias include? key?
    alias member? key?

    def dig(key, *rest)
      value = self[key]
      rest.empty? || value.nil? ? value : value.dig(*rest)
    end

    def method_missing(name, *args, &block)
      key = name.to_s
      if key.end_with?("=") && args.size == 1
        self[key.chomp("=")] = args[0]
      elsif key?(key) || key?(camel = Helix.camelize(key))
        value = key?(key) ? self[key] : self[camel]
                                                                                               
        return value.call(*args, &block) if FnRef === value || ::Proc === value || ::Method === value
        args.empty? ? value : super
      elsif args.empty? && key.end_with?("?")
        !!(self[key.chomp("?")] || self[Helix.camelize(key.chomp("?"))])
      else
        super
      end
    end

    def respond_to_missing?(name, include_private = false)
      key = name.to_s
      key.end_with?("=", "?") || key?(key) || key?(Helix.camelize(key)) || super
    end

    private

    def normalize_key(key)
      ::Symbol === key ? key.to_s : key
    end
  end

                                                                                 
                                                                                
  class Ref < ::BasicObject
    def initialize(game, id)
      @game = game
      @id = id
    end

    def __hx_id
      @id
    end

    def __hx_descriptor
      { KIND => @id }
    end

    def ==(other)
      Ref === other && other.__hx_id == @id
    end

    def !=(other)
      !(self == other)
    end

    def eql?(other)
      self == other
    end

    def equal?(other)
      self == other
    end

    def hash
      @id.hash ^ 0x4858
    end

    def nil?
      false
    end

    def is_a?(klass)
      klass === self
    end
    alias kind_of? is_a?

    def instance_of?(klass)
      klass.equal?(self.class)
    end

    def class
      FnRef === self ? FnRef : Ref
    end

                                                                                                                                                    
    IMPLICIT = %i[to_ary to_str to_hash to_proc to_io to_path to_int to_sym to_regexp to_open coerce marshal_dump _dump begin end exclude_end? each_pair].freeze

    def respond_to?(name, _include_all = false)
      !IMPLICIT.include?(name.to_sym)
    end

    def to_s
      @game.ref_str(@id)
    end

    def inspect
      to_s
    end

    def to_json(*args)
      ::JSON.generate(__hx_descriptor, *args)
    end

    def [](key)
      @game.ref_get(@id, key)
    end

    def []=(key, value)
      @game.ref_set(@id, key, value)
    end

                                                                                                                    
                                                                                                                         
    def length(*args, &block)
      return __hx_dispatch("length", args, &block) if __hx_member?("length")
      @game.ref_len(@id)
    end

    def size(*args, &block)
      return __hx_dispatch("size", args, &block) if __hx_member?("size")
      @game.ref_len(@id)
    end

    def count(*args, &block)
      return __hx_dispatch("count", args, &block) if __hx_member?("count")
      @game.ref_len(@id)
    end

    def keys(*args, &block)
      return __hx_dispatch("keys", args, &block) if __hx_member?("keys")
      @game.ref_keys(@id)
    end

    def each(*args, &block)
      return __hx_dispatch("each", args, &block) if __hx_member?("each")
      to_a.each(&block)
      self
    end

    def map(*args, &block)
      return __hx_dispatch("map", args, &block) if __hx_member?("map")
      to_a.map(&block)
    end

    def empty?
      @game.ref_len(@id) == 0
    end

    def to_a
      @game.ref_keys(@id).map { |key| @game.ref_get(@id, key) }
    end

    def to_h
      @game.ref_keys(@id).each_with_object(Record.new) { |key, record| record[key.to_s] = @game.ref_get(@id, key) }
    end

    def tap
      yield self
      self
    end

    def method_missing(name, *args, **kwargs, &block)
      return super if IMPLICIT.include?(name)
      __hx_dispatch(name.to_s, args, kwargs, &block)
    end

    def __hx_member?(key)
      @game.ref_has?(@id, key)
    end

                                                                                                                    
                                                                
    def __hx_dispatch(key, args, kwargs = {}, &block)
      if key.end_with?("=") && args.size == 1 && kwargs.empty? && block.nil?
        @game.ref_set(@id, key.chomp("="), args[0])
        return args[0]
      end
      args = args.dup
      args << kwargs unless kwargs.empty?
      args << block if block
      if key.end_with?("?") && args.empty?
        value = @game.ref_get(@id, key.chomp("?"))
        return value ? true : false
      end
      @game.ref_invoke(@id, key, args)
    end
  end

                                                                                                                            
  class FnRef < Ref
    def __hx_descriptor
      { KIND => "fn", "id" => @id }
    end

    def call(*args, **kwargs, &block)
      args = args.dup
      args << kwargs unless kwargs.empty?
      args << block if block
      @game.fn_call(@id, args)
    end

    def [](*args)
      call(*args)
    end

    def to_proc
      ::Proc.new { |*args, &block| call(*args, &block) }
    end

    def arity
      -1
    end

    def lambda?
      false
    end
  end

                                                                                                                 
  class ScriptObject
    def initialize(game, key, file, helix, script)
      @__hx_game = game
      @__hx_key = key
      @__hx_file = file
      @__hx_helix = helix
      @__hx_script = script
    end

    def helix
      @__hx_helix
    end

    def script
      @__hx_script
    end

    def __hx_run(source)
      instance_eval(source, @__hx_file, 1)
    end

    def require(name)
      @__hx_game.require_from(self, name.to_s)
    end
    alias helix_require require

    def __hx_key
      @__hx_key
    end

    def require_relative(name)
      require(::File.basename(name.to_s, ".*"))
    end

    def puts(*args)
      text = args.empty? ? "" : args.flatten.map(&:to_s).join("\n")
      @__hx_game.console("info", text, Helix.script_location)
      nil
    end

    def print(*args)
      @__hx_game.console("info", args.map(&:to_s).join, Helix.script_location)
`;
