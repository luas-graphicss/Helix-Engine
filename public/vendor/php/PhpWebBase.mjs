import { PhpBase } from './PhpBase.mjs';
import { commitTransaction, requestWebLock, startTransaction } from './webTransactions.mjs';

                                                                                 
export class PhpWebBase extends PhpBase
{
	   
                                                           
                                                                                  
    
	startTransaction()
	{
		return startTransaction(this);
	}

	   
                                                            
                                                                                     
                                                                              
    
	commitTransaction(readOnly = false)
	{
		return commitTransaction(this, readOnly);
	}

	   
                                                                  
                                                                                   
    
	async refresh()
	{
		await super.refresh();
		const php = await this.binary;
		await requestWebLock('php-wasm-fs-lock', () => {
			return new Promise((accept, reject) => {
				php.FS.syncfs(true, error => {
					if(error) reject(error);
					else accept();
				});
			});
		});
	}

	   
                                                                   
                                                                 
                                                                           
                                                                                   
                                                                                 
    
	async _enqueue(callback, params = [], readOnly = false)
	{
		await this.binary;

		let accept, reject;

		const coordinator = new Promise((a,r) => [accept, reject] = [a, r]);

		const _accept = result => accept(result);
		const _reject = reason => reject(reason);

		this.queue.push([callback, params, _accept, _reject]);

		requestWebLock('php-wasm-fs-lock', async () => {
			if(!this.queue.length)
			{
				return;
			}

			await ((this.autoTransaction && !readOnly) ? this.startTransaction() : Promise.resolve());

			do
			{
				const [callback, params, accept, reject] = this.queue.shift();
				const run = callback(...params);
				run.then(accept).catch(reject);
				await run;
				let lockChecks = 25;
				while(!this.queue.length && lockChecks--)
				{
					await new Promise(a => setTimeout(a, 5));
				}
			} while(this.queue.length);

			await (this.autoTransaction ? this.commitTransaction(readOnly) : Promise.resolve());
		});

		return coordinator;
	}
}
