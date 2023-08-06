import KLine from './KLine.js';


export default class KWP2000 extends KLine {

	async breakToggle() {
		const port = this.port;

		await new Promise((res)=>setTimeout(res, 320))

		console.time('brk_toggle');

		// port.set({brk: true})
		// await new Promise((res)=>setTimeout(res, 200))

		// port.set({brk: false})
		// await new Promise((res)=>setTimeout(res, 400))
		// port.set({brk: true})
		// await new Promise((res)=>setTimeout(res, 400))
		// port.set({brk: false})
		// await new Promise((res)=>setTimeout(res, 400))
		// port.set({brk: true})
		// await new Promise((res)=>setTimeout(res, 400))

		// port.set({brk: false})
		// await new Promise((res)=>setTimeout(res, 230))

		// on, off, on, on, on, off, on, on, on, off
		port.set({brk: true})
		await new Promise((res)=>setTimeout(res, 200))
		port.set({brk: false})
		await new Promise((res)=>setTimeout(res, 200))
		port.set({brk: true})
		await new Promise((res)=>setTimeout(res, 200))
		port.set({brk: true})
		await new Promise((res)=>setTimeout(res, 200))
		port.set({brk: true})
		await new Promise((res)=>setTimeout(res, 200))
		port.set({brk: false})
		await new Promise((res)=>setTimeout(res, 200))
		port.set({brk: true})
		await new Promise((res)=>setTimeout(res, 200))
		port.set({brk: true})
		await new Promise((res)=>setTimeout(res, 200))
		port.set({brk: true})
		await new Promise((res)=>setTimeout(res, 200))
		port.set({brk: false})

		console.timeEnd('brk_toggle');
	}

	async getECUId() {
		// reports the ECU part number and engine type
		// 0x1A - readEcuIdentification, 0x9B - return all info in one response
		const {responseStr} = await this.sendCommand('1A9b', 'readEcuIdentification');

		console.log(`ECU ID: ${responseStr}`);
	}


}