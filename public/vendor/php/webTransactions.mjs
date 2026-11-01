   
                                         
                                                                                              
                                                                                                                                       
   

   
                                         
                                                                                                        
                                                                                                        
                                                                                                                   
   

const fallbackLocks = new Map();

   
                                                                            
                                                                                      
                                                                                                        
   
const clearTransaction = (wrapper, transactionStarted) => {
	if(wrapper.transactionStarted === transactionStarted)
	{
		wrapper.transactionStarted = false;
		wrapper.transactionRuntime = null;
	}
};

   
                                                                            
  
                                                                              
                                                                             
                                                
              
                                  
                                                                               
                                                                                    
   
export function requestWebLock(name, callback)
{
	const lockManager = globalThis.navigator?.locks;

	if(typeof lockManager?.request === 'function')
	{
		return lockManager.request(name, callback);
	}

	const previous = fallbackLocks.get(name) ?? Promise.resolve();
	const operation = previous.then(callback);
	const tail = operation.catch(() => undefined);

	fallbackLocks.set(name, tail);
	tail.then(() => {
		if(fallbackLocks.get(name) === tail)
		{
			fallbackLocks.delete(name);
		}
	});

	return operation;
}

   
                                                                   
                                                                                      
                                                                           
   
export async function startTransaction(wrapper)
{
	if(wrapper.transactionStarted)
	{
		await wrapper.transactionStarted;
		return;
	}

	const php = await wrapper.binary;

	if(!php.persist)
	{
		return;
	}

	if(wrapper.transactionStarted)
	{
		await wrapper.transactionStarted;
		return;
	}

	                                     
	let acceptStart;
	                                         
	let rejectStart;
	const transactionStarted = new Promise((accept, reject) => {
		acceptStart = accept;
		rejectStart = reject;
	});

	wrapper.transactionRuntime = php;
	wrapper.transactionStarted = transactionStarted;

	try
	{
		php.FS.syncfs(true, error => {
			if(error)
			{
				rejectStart(error);
			}
			else
			{
				acceptStart();
			}
		});
	}
	catch(error)
	{
		rejectStart(error);
	}

	try
	{
		return await transactionStarted;
	}
	catch(error)
	{
		clearTransaction(wrapper, transactionStarted);
		throw error;
	}
}

   
                                                                    
                                                                                      
                                                                                    
                                                                             
   
export async function commitTransaction(wrapper, readOnly = false)
{
	const transactionStarted = wrapper.transactionStarted;

	if(!transactionStarted)
	{
		const php = await wrapper.binary;

		if(!php.persist)
		{
			return;
		}

		throw new Error('No transaction initialized.');
	}

	const php = wrapper.transactionRuntime;

	if(!php)
	{
		clearTransaction(wrapper, transactionStarted);
		throw new Error('No transaction initialized.');
	}

	try
	{
		await transactionStarted;

		if(readOnly)
		{
			return;
		}

		return await new Promise((accept, reject) => {
			return php.FS.syncfs(false, error => {
				if(error)
				{
					reject(error);
				}
				else
				{
					accept();
				}
			});
		});
	}
	finally
	{
		clearTransaction(wrapper, transactionStarted);
	}
}
