import { setTimeout as delay } from 'node:timers/promises';
import * as readline from 'node:readline';
import KLine from './KLine.js';
import ISO9141 from './ISO9141.js';
import KWP2000 from './KWP2000.js';

// connectKWP();
connectISO9141();

async function connectISO9141() {
	const diag = new ISO9141({isDebug: false});

	await diag.init();
	await diag.wakeupECU();
	await diag.readDTCs();

	// while(true) {
	// 	// console.time('rpm request');
	// 	const rpm = await diag.getEngineSpeed();
	// 	console.log(rpm)
	// 	// console.timeEnd('rpm request');
	// }
}

async function connectKWP() {
	const diag = new KWP2000({isDebug: false});

	// process.on('exit', ()=>onExit(diag));
	// process.on('SIGINT', ()=>onExit(diag)); 

	// if (process.platform === 'win32') {
	// 	const rl = readline.createInterface({
	// 		input: process.stdin,
	// 		output: process.stdout
	// 	});

	// 	rl.on("SIGINT", ()=>process.emit("SIGINT"));
	// }

	await diag.init();
	await diag.wakeupECU();

	await diag.startDiagS();
	await diag.getECUId();
	await diag.setTimingParams();
	await diag.readDTCs();

	const pointerAddress = await diag.readPointerLoc();

	// console.log(pointerAddress)

	await diag.loadHandler();
	await diag.verifyHandler();
	await diag.readPointerLoc();
	await diag.redirectHandlerPointer();
	await diag.keepAlive();
	await diag.setLoggingVars();

	// while(true) {
		console.log('--------------------------')
		console.time('read vars');
		await diag.readLogData();
		diag.parseLoggedData();
		console.timeEnd('read vars');

		// console.log(data);
	// 	await delay(500);
	// }
}

async function onExit(diag) {
	// TODO
	// await diag.port.flush();
	// await diag.port.drain();
	// await diag.closeLoggingSession();
	console.log('Exiting')
}