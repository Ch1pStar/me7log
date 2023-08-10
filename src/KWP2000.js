import KLine from './KLine.js';
import { readECUFile } from './utils.js';
import {
  readFile,
  writeFile,
} from 'node:fs/promises';

export default class KWP2000 extends KLine {

	async init() {
		await super.init();

		// this.loggedVars = ['lamsoni_w', 'lbz', 'mshfm_w', 'nmot', 'plsol', 'tans', 'tats_w', 'tmot', 'ub'].reverse();
		// this.loggedVarsAddress = '0300F89A40F9A43809913809F6780A31781B2C384851784B12';
		// this.loggingHandlerCrc = 0x64;

		// plsol, tats_w
		// this.loggedVars = ['plsol', 'tats_w'];
		// this.loggedVarsAddress = '033809f6784b12';

		// nmot, ub, tmot
		// this.loggedVars = ['nmot', 'ub', 'tmot'];
		// this.loggedVarsAddress = '0300f89a380991380a32';

		// nmot, ub, tmot
		this.loggedVars = ['nmot', 'ub', 'wped', 'plsol', 'tmot'];
		this.loggedVarsAddress = '0300f89a38099138099d3809f6380a32';

		this.varsConfig = await readECUFile('./ecu_files/8N0906018BP 0002.ecu');
		this.latestData = new Array(this.loggedVars.length);
	}

	async breakToggle() {
		const port = this.port;

		await new Promise((res)=>setTimeout(res, 500))

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
		const {responseStr} = await this.sendCommand('1A9b', {requestName: 'readEcuIdentification'});

		console.log(`ECU ID: ${responseStr}`);
	}

	async startDiagS() {
		// 0x10 - start diagnostic session
		// 0x86 - development session
		// 0x64 - ???
		const {response} = await this.sendCommand('108664', {requestName: 'startDiagnosticSession'});

		await this.port.update({baudRate: 57600});
	}

	async setTimingParams() {
		const res = await this.sendCommand('83030001001400');

		// console.log(res)
	}

	async readMemoryByAddress(address, len = '04') {
		const command = `23${address}${len}`;
		const { response } = await this.sendCommand(command, {requestName: 'read mem'});

		return response;
	}

	async readPointerLoc() {
		return this.readMemoryByAddress('00e228', '04');
	}

	async loadHandler() {
		const maxChunkSize = 0x80;
		const handlerData = await readFile('./handler/handler.bin');
		const chunksCount = handlerData.length/maxChunkSize << 0;

		for(let i=0;i<chunksCount+1;i++) {
			const chunkStart = i*maxChunkSize;
			const chunkEnd = chunkStart + maxChunkSize;
			const chunk = handlerData.subarray(chunkStart, chunkEnd);
			const chunkStr = chunk.length.toString(16) + chunk.toString('hex');
			const baseAddress = 0x387a00;
			const targetAddress = (baseAddress+chunkStart).toString('16');

			await this.sendCommand(`3d${targetAddress}${chunkStr}`, {
				requestName: 'write mem',
				prependBytes: '00',
			});
		}

	}

	async verifyHandler() {

	}

	async redirectHandlerPointer() {
		const command = `3d00e22804003ae100`;
		const { response } = await this.sendCommand(command, {
			requestName: 'write mem',
			// prependBytes: '00',
		});
		// console.log('Redirect', response);

		return response;
	}

	async setLoggingVars(varsList = this.loggedVarsAddress) {
		const { response } = await this.sendCommand(`b7${varsList}`, {
			requestName: 'set which vars to log in custom handler',
			overWriteCrc: this.loggingHandlerCrc,
		});

		return response;
	}

	async keepAlive() {
		const { response } = await this.sendCommand('3e', {
			requestName: 'keep alive'
		});

		return response;
	}

	async readLogData() {
		const { response: data } = await this.sendCommand('b7', {
			requestName: 'custom handler data log'
		});
		// const data = Buffer.from('5e00e8', 'hex');
		let offset = 0;

		console.log(data)

		this.loggedVars.forEach((varName, i)=>{
			const varConfig = this.varsConfig[varName];
			// console.log(varName, offset)
			const internalVal = data.readUIntLE(offset, varConfig.size)
			const physVal = this.calcPhysValue(internalVal, varConfig);

			this.latestData[i] = physVal;
			offset += varConfig.size;

			// console.log(`${varConfig.alias}: ${internalVal.toString(16)}, ${physVal}${varConfig.unit}`);
			console.log(`${varConfig.alias}: ${physVal}${varConfig.unit}`);
		});

		// console.log('---------------------------------------------------')
	}

	parseLoggedData() {

	}

	calcPhysValue(internal, {a, b, i = false, s = false} = {}) {
		return i ? a/(internal-b) : (a*internal)-b;
	}

	async closeLoggingSession() {
		return this.sendCommand('82', {
			requestName: 'closeLoggingSession',
		});
	}

	async sendCommand(command, {
		requestName,
		skipLenPrepend = false,
		responseLen,
		prependBytes = '',
		overWriteCrc,
	} = {}) {
		if(this.isDebug) {
			console.time(`${requestName} total time`);
		}
		const port = this.port;

		let commandBuffer = Buffer.from(command, 'hex');

		if(!skipLenPrepend) {
			const cmdLen = commandBuffer.length;

			// prepen the command length
			commandBuffer = Buffer.concat([Buffer.from(prependBytes, 'hex'), Buffer.from([cmdLen]), commandBuffer]);
			command = prependBytes + cmdLen.toString(16).padStart(2, '0') + command;
		}

		// append the command checksum
		const csum = overWriteCrc ? overWriteCrc : this.commandChecksum(commandBuffer);

		command = command + csum.toString(16).padStart(2, '0');
		commandBuffer = Buffer.concat([commandBuffer, Buffer.from([csum])]);

		if(this.isDebug) console.log(`Command:`, commandBuffer);

		// await writeFile(`test_chunk_${Date.now()}`, commandBuffer);
		// console.log(commandBuffer)
		// return;

		await this.write(command);

		let data = [];
		// the command should be echoed back
		for(let i=0;i<commandBuffer.length;i++) {
			data.push(await this.read());
		}

		let response = Buffer.concat(data);

		if(this.isDebug) console.log(`Echo:`, response);

		if(!commandBuffer.equals(response)) {
			console.error('Command echo does not equal sent command', commandBuffer, response);
			process.exit(1);
		}

		// next byte after the command echo is the length of the response
		if(!responseLen) responseLen = (await this.read())[0];
		const responseStatus = (await this.read())[0];
		const positiveResByte = commandBuffer[1] + 0x40;

		if(this.isDebug) console.log(`Response len: ${responseLen}, positive response byte: ${positiveResByte.toString(16)}`)

		// if(!this.checkPositiveResponse(responseStatus, positiveResByte, requestName)) return;

		data.length = 0;
		// read the command response
		for(let i=0;i<responseLen-1;i++) {
			data.push(await this.read());
		}

		// what does the last byte mean?
		const responseChecksum = await this.read();

		response = Buffer.concat(data);

		const responseStr = response.toString().replace(/[\u{0080}-\u{FFFF}]/gu,"");
		const resObj = {
			command: commandBuffer,
			responseStr,
			response,
		}

		if(this.isDebug) {
			console.timeEnd(`${requestName} total time`);
		}

		return resObj;
	}

}