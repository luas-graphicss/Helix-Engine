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

	   
                                                                        
                                                                                                                 
                                                                            
                                                                         
                                                                                                      
    

	   
                                                   
                                                                        
    

	   
                                               
                                                                           
    

	   
                                            
    

	   
                                                 
                                                   
                                                                          
    

	   
                                                                     
                                                                     
    

	   
                                                                      
                                                                                     
                                                                              
    

	   
                                                      
                                                                 
                                                                           
                                                                                            
                                                                                 
    

	   
                                                                             
                                                                              
    

	   
                                                    
                                                                
                                                                           
    

	   
                                                    
                                                                            
                                                                           
    

	   
                                                     
                                                                                         
                                                                           
    

	   
                                                     
                                                                             
                                                                           
    

	   
                                                                   
                                                                  
                                                                                                         
                                                                                        
    

	   
                                                                    
                                                                  
                                                                                                     
                                                                                  
    

	   
                                                 
                                                                                         
    

	   
                                              
                                                    
                                                                                 
    

	   
                                                
                                                
                                                                                  
                                                                       
    

	   
                                             
                                           
                                                                    
                                                                             
    

	   
                                                        
                                                 
                                                                   
    

	   
                                                  
                                                  
                                                                           
    

	   
                                                    
                                                  
                                                                                     
    

	   
                                      
                                                  
                                                        
                                                                                
    

	   
                                              
                                            
                                                    
                                                                     
                                                                                
    

	   
                                               
                                             
                                                                                
    
}
