import { OutputBuffer } from './OutputBuffer.mjs';
import { _Event } from './_Event.mjs';
import { fsOps } from './fsOps.mjs';
import { resolveDependencies } from './resolveDependencies.mjs';

const importMeta = import.meta;

const STR = 'string';
const NUM = 'number';
const normalizeRuntimeModule = runtime => runtime && typeof runtime === 'object' && 'default' in runtime
	? runtime
	: {default: runtime};
const instantiateRuntimeModule = (Runtime, args) => /^class\s/.test(Function.prototype.toString.call(Runtime))
	? new Runtime(args)
	: Runtime(args);

   
                                                                        
   
export class PhpBase extends EventTarget
{
	                                                                                                    
	queue;
	                      
	_queueActive = false;
	                                      
	onerror;
	                                      
	onoutput;
	                                      
	onready;
	                          
	encoder;
	                                                                            
	buffers;
	                      
	autoTransaction;
	                                    
	transactionStarted;
	                               
	phpVersion;

	                                              
	shared;
	                             
	phpArgs;
	                     
	valueIndex;
	                              
	binary;

	   
                                                                        
                                                                                                                 
                                                                            
                                                                         
                                                                                                      
    
	constructor(phpBinLoader, args = {}, sapi = 'embed', phpSettings = globalThis.phpSettings ?? {})
	{
		super();

		this.queue  = [];

		this.onerror  = function () {};
		this.onoutput = function () {};
		this.onready  = function () {};

		Object.defineProperty(this, 'encoder', {value: new TextEncoder()});
		Object.defineProperty(this, 'buffers', {value: {
			stdin: []
			, stdout: new OutputBuffer(this, 'output', -1)
			, stderr: new OutputBuffer(this, 'error',  -1)
		} });

		Object.freeze(this.buffers);

		this.autoTransaction = ('autoTransaction' in args) ? args.autoTransaction : true;
		this.transactionStarted = false;

		this.phpVersion = args.version;
		if(args.variant !== undefined && args.variant !== '')
		{
			throw new TypeError('Runtime variants have moved to separate packages. Install php-sdl-wasm and import PhpSdl for SDL.');
		}

		args.ENV = {
			...(args.ENV ?? {}),
			...(this.phpVersion ? {PHP_VERSION: this.phpVersion} : {}),
		};

		this.shared = args.shared = ('shared' in args) ? args.shared : {};

		this.phpArgs = args;

		const defaults = {
			stdin:  () => this.buffers.stdin.shift() ?? null
			, stdout: byte => this.buffers.stdout.push(byte)
			, stderr: byte => this.buffers.stderr.push(byte)

			, postRun:  () => {
				const event = new _Event('ready');
				this.onready(event);
				this.dispatchEvent(event);
			}
		};

		const fixed = { onRefresh: new Set };
		const userLocateFile = args.locateFile || (() => undefined);

		const files = args.files || [];

		const {files: sharedLibFiles, libs: sharedlibs, urlLibs: sharedLibUrls} = resolveDependencies(args.sharedLibs, this);
		const {files: dynamicLibFiles, libs: dynamiclibs, urlLibs: dyamicLibUrls} = resolveDependencies(args.dynamicLibs, this);

		args.locateFile = (path, directory) => {
			args.debug && console.error('Loading %s',  path);
			let located = userLocateFile(path, directory);
			if(located !== undefined)
			{
				return located;
			}
			if(sharedLibUrls[path])
			{
				return sharedLibUrls[path];
			}
			if(dyamicLibUrls[path])
			{
				return dyamicLibUrls[path];
			}

			                                       
			                                        
			if(path === 'libxml2.so')
			{
				return 'data:,';
			}
		};

		this.valueIndex = 0;

		const phpArgs = Object.assign({}, defaults, phpSettings, args, fixed);

		this.binary = phpBinLoader.then(normalizeRuntimeModule).then(({default: PHP}) => instantiateRuntimeModule(PHP, phpArgs)).then(async php => {
			await php.ccall(
				'pib_storage_init'
				, NUM
				, []
				, []
				, {async: true}
			);

			if(!php.FS.analyzePath('/preload').exists)
			{
				php.FS.mkdir('/preload');
			}

			const allFiles = files.concat(sharedLibFiles, dynamicLibFiles);

			                                                            
			allFiles.forEach(fileDef => {
				const segments = fileDef.parent.split('/');
				let currentPath = '';
				for(const segment of segments)
				{
					if(!segment) continue;

					currentPath += segment + '/';
					if(!php.FS.analyzePath(currentPath).exists)
					{
						php.FS.mkdir(currentPath);
					}
				}
			});

			await Promise.all(allFiles.map(
				fileDef => new Promise(accept => php.FS.createPreloadedFile(
					fileDef.parent,
					fileDef.name,
					fileDef.url instanceof URL ? fileDef.url.href : fileDef.url,
					true,
					false,
					accept,
				))
			));

			const iniLines = sharedlibs.map(lib => {
				if(typeof lib === 'string' || lib instanceof URL)
				{
					return `extension=${lib}`;
				}
				else if(typeof lib === 'object' && lib.ini)
				{
					return `extension=${lib.name ?? String(lib.url).split('/').pop()}`;
				}
			});

			args.ini && iniLines.push(args.ini.replace(/\n\s+/g, '\n'));

			php.FS.writeFile('/php.ini', iniLines.join("\n") + "\n", {encoding: 'utf8'});

			await php.ccall(
				'pib_init'
				, NUM
				, [STR]
				, [sapi]
				, {async: true}
			);

			return php;
		});
	}

	   
                                                   
                                                                        
    
	inputString(byteString)
	{
		this.input(this.encoder.encode(byteString));
	}

	   
                                               
                                                                           
    
	input(items)
	{
		this.buffers.stdin.push(...items);
	}

	   
                                            
    
	flush()
	{
		this.buffers.stdout.flush();
		this.buffers.stderr.flush();
	}

	   
                                                 
                                                   
                                                                          
    
	tokenize(phpCode)
	{
		return this.binary.then(php => php.ccall(
			'pib_tokenize'
			, STR
			, [STR]
			, [phpCode]
		));
	}

	   
                                                                     
                                                                     
    
	startTransaction()
	{
		return Promise.resolve();
	}

	   
                                                                      
                                                                                     
                                                                              
    
	commitTransaction(readOnly = false)
	{
		return Promise.resolve();
	}

	   
                                                      
                                                                 
                                                                           
                                                                                            
                                                                                 
    
	_enqueue(callback, params = [], readOnly = false)
	{
		return new Promise((accept, reject) => {
			this.queue.push([callback, params, accept, reject, readOnly]);

			if(!this._queueActive)
			{
				this._queueActive = true;
				void this._drainQueue();
			}
		});
	}

	   
                                                                             
                                                                              
    
	async _drainQueue()
	{
		try
		{
			while(this.queue.length)
			{
				const [callback, params, accept, reject, readOnly = false] = this.queue.shift();
				let transactionStarted = false;
				let result, failure;
				let failed = false;

				try
				{
					if(this.autoTransaction)
					{
						                                                               
						await this.startTransaction();
						transactionStarted = true;
					}

					result = await callback(...params);
				}
				catch(error)
				{
					failure = error;
					failed = true;
				}

				if(transactionStarted)
				{
					try
					{
						await this.commitTransaction(readOnly);
					}
					catch(error)
					{
						failure = failed
							? new AggregateError([failure, error], 'PHP operation and transaction commit failed')
							: error;
						failed = true;
					}
				}

				if(failed) reject(failure);
				else accept(result);
			}
		}
		finally
		{
			this._queueActive = false;
		}
	}

	   
                                                    
                                                                
                                                                           
    
	run(phpCode)
	{
		return this._enqueue(
			   
                                 
                                                                   
                                                                                 
      
			phpCode => this._run(phpCode),
			[phpCode]
		);
	}

	   
                                                    
                                                                            
                                                                           
    
	_run(phpCode)
	{
		const source = `${phpCode}`;
		                                                                       
		                                                                           
		const code = /^<\?php(?=[ \t\r\n]|$)/i.test(source)
			? `     ${source.slice(5)}`
			: `?>${source}`;
		return this.binary.then(php => {
			return php.ccall(
				'pib_run'
				, NUM
				, [STR]
				, [code]
				, {async: true}
			);
		})
		.finally(() => this.flush());
	}

	   
                                                     
                                                                                         
                                                                           
    

	   
                                                     
                                                                             
                                                                           
    

	   
                                                                   
                                                                  
                                                                                                         
                                                                                        
    

	   
                                                                    
                                                                  
                                                                                                     
                                                                                  
    

	   
                                                 
                                                                                         
    

	   
                                              
                                                    
                                                                                 
    

	   
                                                
                                                
                                                                                  
                                                                       
    

	   
                                             
                                           
                                                                    
                                                                             
    

	   
                                                        
                                                 
                                                                   
    

	   
                                                  
                                                  
                                                                           
    

	   
                                                    
                                                  
                                                                                     
    

	   
                                      
                                                  
                                                        
                                                                                
    

	   
                                              
                                            
                                                    
                                                                     
                                                                                
    

	   
                                               
                                             
                                                                                
    
}
