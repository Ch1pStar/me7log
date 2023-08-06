import KLine from './KLine.js';
import ISO9141 from './ISO9141.js';
import KWP2000 from './KWP2000.js';

connectKWP();
// connectISO9141();

async function connectISO9141() {
	const diag = new ISO9141({isDebug: false});

	await diag.init();
	await diag.wakeupECU();

	while(true) {
		// console.time('rpm request');
		const rpm = await diag.getEngineSpeed();
		console.log(rpm)
		// console.timeEnd('rpm request');
	}
}

async function connectKWP() {
	const diag = new KWP2000({isDebug: false});

	await diag.init();
	await diag.wakeupECU();

	await diag.getECUId();

	// const res = await diag.sendCommand('686AF1010C', 'basic read');
	// console.log(res)

	await diag.readDTCs();
}