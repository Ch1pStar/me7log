import {
  readFile,
  writeFile,
  open,
} from 'node:fs/promises';

export async function readECUFile(path) {
    const varsConfig = {};
    const file = await open(path);
    let varsReached = false;
    let varNames = null;
    const numericalVars = ['size', 'a', 'b', 's', 'i'];

    for await (const line of file.readLines()) {
        if(!varsReached) {
        	if(line.includes(';Name')) {
        		varNames = line.split(',').map((s)=>s.trim().replace(/\{|\}|;/g, '').toLowerCase());
        		varsReached = true;
        	}

        	continue;
        }

    	const varData = line.split(',').map((s)=>s.trim());
    	const varInfo = varNames.reduce((acc, curr, i)=>{
    		let varVal = varData[i].replace(/\{|\}|;/g, '');

    		if(numericalVars.includes(curr)) {
    			varVal = Number(varVal);
    		}

    		acc[curr] = varVal

    		return acc;
    	}, {});

    	varsConfig[varData[0]] = varInfo;
    }

    return varsConfig;
}
