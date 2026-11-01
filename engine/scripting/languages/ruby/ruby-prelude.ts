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
`;
