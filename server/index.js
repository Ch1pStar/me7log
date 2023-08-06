import KLine from './KLine.js';
import ISO9141 from './ISO9141.js';
import KWP2000 from './KWP2000.js';


// connectKWP();
connectISO9141();

async function connectISO9141() {
	const diag = new ISO9141({isDebug: false});

	await diag.init();
	await diag.wakeupECU();

	setInterval(async ()=>{
		console.time('rpm request');
		const rpm = await diag.getEngineSpeed();
		// console.log(rpm)
		console.timeEnd('rpm request');
	}, 60);
}

async function connectKWP() {
	const diag = new KWP2000();

	await diag.init();
	await diag.wakeupECU();

	await diag.getECUId();
	await diag.readDTCs();
}