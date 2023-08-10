import {
  readFile,
  writeFile,
} from 'node:fs/promises';


async function readHandlerParts() {
	const filesData = [];

	for(let i=1;i<=5;i++) {
		const data = await readFile(`./part_${i}`);
		const chunkData = data.slice(7, -1);

		filesData.push(chunkData);
	}

	const handlerData = Buffer.concat(filesData);

	await writeFile('handler.bin', handlerData)
}


readHandlerParts();