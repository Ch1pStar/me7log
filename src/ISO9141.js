import KLine from './KLine.js';

export default class ISO9141 extends KLine {

	async getEngineSpeed() {
		const resLen = 7;
		const { response } = await this.sendCommand('686AF1010C', resLen);
		const highByte = response[resLen-2];
		const lowByte = response[resLen-1];
		const speed = ((256*highByte) + lowByte)/4;

		return speed;
	}

	async readDTCs() {
		const resLen = 7;
		const { response } = await this.sendCommand('03000703', resLen);

		console.log(response)
	}

	async breakToggle() {
		const port = this.port;

		await new Promise((res)=>setTimeout(res, 320))

		console.time('brk_toggle');

		port.set({brk: true})
		await new Promise((res)=>setTimeout(res, 200))

		port.set({brk: false})
		await new Promise((res)=>setTimeout(res, 400))
		port.set({brk: true})
		await new Promise((res)=>setTimeout(res, 400))
		port.set({brk: false})
		await new Promise((res)=>setTimeout(res, 400))
		port.set({brk: true})
		await new Promise((res)=>setTimeout(res, 400))

		port.set({brk: false})
		// await new Promise((res)=>setTimeout(res, 230))

		console.timeEnd('brk_toggle');
	}

	async sendCommand(command, responseLen, requestName) {
		const port = this.port;
		let commandBuffer = Buffer.from(command, 'hex');

		// append the command checksum
		const csum = this.commandChecksum(commandBuffer);

		command = command + csum.toString(16).padStart(2, '0');
		commandBuffer = Buffer.concat([commandBuffer, Buffer.from([csum])]);

		if(this.isDebug) {
			console.log(`Command:`, commandBuffer);
		}

		await this.write(command);

		let data = [];
		// the command should be echoed back
		for(let i=0;i<commandBuffer.length;i++) {
			data.push(await this.read());
		}

		let response = Buffer.concat(data);

		if(this.isDebug) {
			console.log(`Echo:`, response);
		}

		if(!commandBuffer.equals(response)) {
			console.error('Command echo does not equal sent command', commandBuffer, response);
			// process.exit(1);
		}


		data.length = 0;
		// read the command response
		for(let i=0;i<responseLen;i++) {
			data.push(await this.read());
		}

		// what does the last byte mean?
		const responseChecksum = await this.read();

		if(this.isDebug) {
			console.log('Response checksum', responseChecksum);
		}

		response = Buffer.concat(data);

		const responseStr = response.toString().replace(/[\u{0080}-\u{FFFF}]/gu,"");
		const resObj = {
			command: commandBuffer,
			responseStr,
			response,
		}

		return resObj;
	}
}