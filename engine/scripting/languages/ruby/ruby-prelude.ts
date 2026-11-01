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
      nil
    end

    def p(*args)
      location = Helix.script_location
      args.each { |arg| @__hx_game.console("info", arg.inspect, location) }
      args.size <= 1 ? args.first : args
    end
    alias pp p

    def warn(*args, **_options)
      @__hx_game.console("warn", args.map(&:to_s).join("\n"), Helix.script_location)
      nil
    end

    def to_s
      "#<Script #{@__hx_file}>"
    end
    alias inspect to_s

                                                                                                                                              
    def __hx_bind(instance)
      script_object = self
      klass = instance.class
      own = klass.instance_methods(false) + klass.private_instance_methods(false)
      %i[helix script actor puts print p pp warn require require_relative].each do |name|
        next if own.include?(name)
        if name == :actor
          instance.define_singleton_method(name) { script_object.helix.self }
        else
          instance.define_singleton_method(name) { |*args, **kwargs, &block| script_object.__send__(name, *args, **kwargs, &block) }
        end
      end
      instance
    end
  end

                                                                                              
  class Game
    attr_reader :id

    def initialize(id, host)
      @id = id
      @host = host
      @callbacks = {}
      @callback_ids = {}.compare_by_identity
      @next_callback = 1
      @fibers = {}
      @next_token = 1
      @active_fiber = nil
      @depth = 0
      @modules = {}
      @loading = []
      @root = nil
    end

                                                                                              

    def set_root(helix)
      entry do
        @root = decode(helix)
        [:done, nil]
      end
    end

                                                                                                                                     
    def instantiate(key, file, helix, script)
      entry do
        object = ScriptObject.new(self, key, file, decode(helix), decode(script))
        object.__hx_run(source_of(key))
        hooks = collect_hooks(object, object.singleton_methods)
        if hooks.empty?
          klass = script_class(object, file)
          if klass
            instance = object.__hx_bind(klass.instance_method(:initialize).arity.zero? ? klass.new : klass.allocate)
            hooks = collect_hooks(instance, klass.public_instance_methods)
          end
        end
        [:done, hooks]
      end
    end

    def load_module(key, file)
      entry { [:done, encode(require_module(key, file))] }
    end

    def unload_module(key)
      @modules.delete(key)
      [:done, nil]
    end

    def invoke(callback_id, args)
      entry do
        callable = @callbacks[callback_id]
        raise EngineError.new("callback ##{callback_id} não existe mais nesta execução.") unless callable
        arguments = decode(args)
        if @depth > 1
          [:done, encode(call_callable(callable, arguments))]
        else
          start_fiber(::Fiber.new { [:done, encode(call_callable(callable, arguments))] })
        end
      end
    end

    def resume(token, ok, payload)
      entry do
        fiber = @fibers.delete(token)
        raise EngineError.new("a espera ##{token} não existe mais nesta execução.") unless fiber
        previous = @active_fiber
        @active_fiber = fiber
        begin
          drive(fiber, fiber.resume([ok, payload]))
        ensure
          @active_fiber = previous
        end
      end
    end

    def drop(token)
      @fibers.delete(token)
      [:done, nil]
    end

    def dispose
      @callbacks.clear
      @callback_ids.clear
      @fibers.clear
      @modules.clear
    end

                                                                                               

    def ref_get(id, key)
      host_result(@host.call(:get, id, key_argument(key)))
    end

    def ref_set(id, key, value)
      host_result(@host.call(:set, id, key_argument(key), ::JSON.generate(encode(value))))
      value
    end

    def ref_invoke(id, key, args)
      host_result(@host.call(:invoke, id, key, ::JSON.generate(args.map { |arg| encode(arg) })))
    end

    def fn_call(fn_id, args)
      host_result(@host.call(:call, fn_id, ::JSON.generate(args.map { |arg| encode(arg) })))
    end

    def ref_str(id)
      @host.call(:str, id).to_s
    end

    def ref_len(id)
      @host.call(:len, id).to_s.to_i
    end

    def ref_keys(id)
      ::JSON.parse(@host.call(:keys, id).to_s)
    end

    def ref_has?(id, key)
      @host.call(:has, id, key).to_s == "true"
    end

    def console(level, message, location)
      @host.call(:console, level, message.to_s, location&.path, location&.lineno)
      nil
    end

                                                                                                                      
                                                                                                                      
                                                                                                                
    def require_from(requirer, name)
      envelope = ::JSON.parse(@host.call(:resolve, requirer.__hx_key, name).to_s)
      raise EngineError.new(envelope["e"].to_s) if envelope.key?("e")
      info = envelope["v"]
      if ::Hash === info && info[KIND] == "module"
        value = require_module(info["key"], info["file"])
        share_constants(@modules[info["key"]][:object], requirer)
        return value
      end
      if ::Hash === info && info[KIND] == "missing"
        begin
          return ::Kernel.require(name)
        rescue ::LoadError
          raise EngineError.new(info["message"].to_s)
        end
      end
      value = decode(info)
      base = ::File.basename(name, ".*")
      define_constant(requirer, base, value) if base.match?(/\A[A-Z]\w*\z/)
      value
    end

    def share_constants(source, target)
      return if source.equal?(target)
      namespace = source.singleton_class
      namespace.constants(false).each { |constant| define_constant(target, constant, namespace.const_get(constant, false)) }
    end

    def define_constant(object, name, value)
      namespace = object.singleton_class
      namespace.const_set(name, value) unless namespace.const_defined?(name, false)
    end

                                                                                             

    def encode(value)
      case value
      when nil, true, false, ::String, ::Integer then value
      when ::Float then value.finite? ? value : nil
      when ::Symbol then value.to_s
      when Ref then value.__hx_descriptor
      when ::Proc, ::Method then { KIND => "cb", "id" => callback_id(value) }
      when ::Array then value.map { |entry| encode(entry) }
      when ::Hash then value.each_with_object({}) { |(key, entry), out| out[key.to_s] = encode(entry) }
      when ScriptObject then encode_exports(value.singleton_class, value.singleton_methods) { |name| value.method(name) }
      when ::Module then encode_exports(value, value.singleton_methods(false)) { |name| value.method(name) }
      else
        if defined?(::Set) && ::Set === value then value.to_a.map { |entry| encode(entry) }
        elsif value.respond_to?(:to_h) then encode(value.to_h)
        else value.to_s
        end
      end
    end

                                                                                                                                       
    def encode_exports(namespace, method_names)
      out = {}
      method_names.each { |name| out[name.to_s] = encode(yield(name)) }
      namespace.constants(false).each { |name| out[name.to_s] = encode(namespace.const_get(name, false)) }
      out
    end

    def decode(value)
      case value
      when ::Array then value.map { |entry| decode(entry) }
      when ::Hash
        kind = value[KIND]
        return decode_descriptor(kind, value) unless kind.nil?
        record = Record.new
        value.each { |key, entry| record.store(key, decode(entry)) }
        record
      else value
      end
    end

    private

    def decode_descriptor(kind, record)
      case kind
      when ::Integer then Ref.new(self, kind)
      when "ref" then Ref.new(self, record["id"].to_i)
      when "fn" then FnRef.new(self, record["id"].to_i)
      when "cb" then @callbacks[record["id"].to_i]
      when "vec" then Vec.new(record["value"] || [])
      when "data" then decode(record["value"])
      when "err" then raise EngineError.new(record["message"].to_s, record["name"].to_s.empty? ? "HelixError" : record["name"].to_s)
      when "await" then suspend!
      else raise EngineError.new("descritor de protocolo desconhecido (#{kind}).")
      end
    end

    def suspend!
      current = ::Fiber.current
      if @depth != 1 || @active_fiber.nil? || !current.equal?(@active_fiber)
        @host.call(:discard)
        where = @depth > 1 ? "dentro de um callback chamado de forma síncrona pela engine, enquanto outro código Ruby ainda roda" : "no nível superior do script"
        raise EngineError.new("não é possível esperar pela engine #{where}: mova a espera para um hook (on_start, on_update…) ou para helix.task.spawn { … }.")
      end
      token = @next_token
      @next_token += 1
      ok, payload = ::Fiber.yield([:await, token])
      raise EngineError.new(payload.to_s) unless ok
      decode(payload)
    end

    def entry
      @depth += 1
      Helix.activate(self)
      begin
        yield
      rescue ::Exception => e
        [:error, failure(e)]
      end
    ensure
      Helix.deactivate
      @depth -= 1
    end

    def start_fiber(fiber)
      previous = @active_fiber
      @active_fiber = fiber
      drive(fiber, fiber.resume)
    ensure
      @active_fiber = previous
    end

    def drive(fiber, result)
      if ::Array === result && result[0] == :await
        @fibers[result[1]] = fiber
        [:await, result[1]]
      else
        result
      end
    end

    def host_result(js_value)
      envelope = ::JSON.parse(js_value.to_s)
      decode(envelope["v"])
    end

    def key_argument(key)
      ::Symbol === key ? key.to_s : key
    end

    def callback_id(callable)
      @callback_ids[callable] ||= begin
        id = @next_callback
        @next_callback += 1
        @callbacks[id] = callable
        id
      end
    end

    def call_callable(callable, args)
      arity = callable.arity
      if arity >= 0
        args = args.first(arity)
        args += [nil] * (arity - args.size) if args.size < arity
      else
        required = -arity - 1
        args += [nil] * (required - args.size) if args.size < required
      end
      callable.call(*args)
    end

    def source_of(key)
      envelope = ::JSON.parse(@host.call(:code, key).to_s)
      raise EngineError.new(envelope["e"].to_s) if envelope.key?("e")
      envelope["v"].to_s
    end

    def require_module(key, file)
      return @modules[key][:value] if @modules.key?(key)
      if @loading.any? { |entry| entry[:key] == key }
        chain = (@loading.map { |entry| entry[:file] } + [file]).join(" -> ")
        raise EngineError.new("require circular: #{chain}.")
      end
      @loading.push({ key: key, file: file })
      begin
        object = ScriptObject.new(self, key, file, @root, nil)
        object.__hx_run(source_of(key))
        value = module_value(object, file)
        @modules[key] = { value: value, file: file, object: object }
        value
      ensure
        @loading.pop
      end
    end

                                                                                                                                              
    def module_value(object, file)
      constant = named_constant(object, file)
      constant.nil? ? object : constant
    end

                                                                                              
    def script_class(object, file)
      constant = named_constant(object, file)
      ::Class === constant ? constant : nil
    end

    def named_constant(object, file)
      base = ::File.basename(file, ".*")
      singleton = object.singleton_class
      return nil unless base.match?(/\A[A-Z]\w*\z/) && singleton.const_defined?(base, false)
      singleton.const_get(base, false)
    end

                                                                                             
    def collect_hooks(target, method_names)
      names = method_names.map(&:to_s)
      hooks = {}
      HOOKS.each do |hook|
        name = [hook, Helix.camelize(hook)].find { |candidate| names.include?(candidate) }
        hooks[hook] = callback_id(target.method(name.to_sym)) if name
      end
      hooks
    end

                                                                                                  
    def failure(error)
      frames = []
      (error.backtrace || []).each do |entry|
        next unless entry =~ /\A(.+?):(\d+):in [\x60'](.*)'\z/
        file = ::Regexp.last_match(1)
        next unless Helix.project_file?(file)
        frames << [file, ::Regexp.last_match(2).to_i, Helix.clean_label(::Regexp.last_match(3))]
      end
      name = EngineError === error ? error.kind : error.class.name.to_s
      { "message" => error.message.to_s, "name" => name, "frames" => frames }
    end
  end

  def self.clean_label(label)
    label = label.sub(/\Ablock (\(\d+ levels\) )?in /, "")
    label = label.split("#").last.to_s if label.include?("#")
    label = label.split(".").last.to_s if label.include?(".")
    label.start_with?("<") ? "" : label
  end

                                                                                               

  def self.create_game(id, host)
    GAMES[id.to_s] = Game.new(id.to_s, host)
    "ok"
  end

  def self.dispose_game(id)
    game = GAMES.delete(id.to_s)
    game&.dispose
    "ok"
  end

                                                                                              
  def self.dispatch(payload)
    request = ::JSON.parse(payload.to_s)
    game = GAMES[request["id"].to_s]
    op = request["op"].to_s
    return ::JSON.generate([:error, { "message" => "o jogo ##{request["id"]} não existe mais.", "name" => "HelixError", "frames" => [] }]) unless game
    return ::JSON.generate([:error, { "message" => "operação desconhecida (#{op}).", "name" => "HelixError", "frames" => [] }]) unless OPERATIONS.include?(op)
    ::JSON.generate(game.public_send(op, *request["args"]))
  rescue ::Exception => e
    ::JSON.generate([:error, { "message" => e.message.to_s, "name" => e.class.name.to_s, "frames" => [] }])
  end

                                                                                                                        
  def self.where
    location = script_location
    return "" unless location
    ::JSON.generate([location.path, location.lineno, clean_label(location.label.to_s)])
  rescue ::Exception
    ""
  end

                                                                                                                         
  def self.compile_script(source, file)
    source = source.to_s
    file = file.to_s
    diagnostics = []
    begin
      ::RubyVM::InstructionSequence.compile(source, file, file, 1)
    rescue ::SyntaxError => e
      diagnostics.concat(syntax_diagnostics(e.message))
      diagnostics << { "severity" => "error", "message" => e.message.lines.first.to_s.strip, "line" => 1, "column" => 1, "code" => "syntax" } if diagnostics.empty?
    rescue ::Exception => e
      diagnostics << { "severity" => "error", "message" => e.message.to_s, "line" => 1, "column" => 1 }
    end
    ::JSON.generate({ "diagnostics" => diagnostics, "dependencies" => scan_requires(source) })
  rescue ::Exception => e
    ::JSON.generate({ "diagnostics" => [{ "severity" => "error", "message" => e.message.to_s, "line" => 1, "column" => 1 }], "dependencies" => [] })
  end

                                                                                                    
  def self.syntax_diagnostics(message)
    out = []
    line = 1
    message.each_line do |text|
      text = text.chomp
      if text =~ /\A>?\s*(\d+) \| /
        line = ::Regexp.last_match(1).to_i
      elsif text =~ /\A\s*\|( *)\^[\^~]* ?(.*)\z/
        detail = ::Regexp.last_match(2).strip
        next if detail.empty?
        out << { "severity" => "error", "message" => detail, "line" => line, "column" => [::Regexp.last_match(1).length, 1].max, "code" => "syntax" }
      end
    end
    out.uniq { |entry| [entry["line"], entry["message"]] }.first(6)
  end

  def self.scan_requires(source)
    dependencies = []
    source.each_line do |line|
      next if line.lstrip.start_with?("#")
      next unless line =~ /\A\s*(?:helix_)?require(_relative)?\s*\(?\s*["']([^"']+)["']/
      name = ::Regexp.last_match(2)
      name = ::File.basename(name, ".*") if ::Regexp.last_match(1)
      next if stdlib?(name) || dependencies.include?(name)
      dependencies << name
    end
    dependencies
  end

  def self.stdlib?(name)
    return true if %w[js json set fiber].include?(name)
    return true if $LOADED_FEATURES.any? { |feature| feature.end_with?("/#{name}.rb", "/#{name}.so") }
    $LOAD_PATH.any? { |dir| ::File.exist?(::File.join(dir, "#{name}.rb")) || ::File.exist?(::File.join(dir, "#{name}.so")) }
  rescue ::Exception
    false
  end
end
`;
