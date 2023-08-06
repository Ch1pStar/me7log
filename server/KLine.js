import { autoDetect } from '@serialport/bindings-cpp'
import { SerialPort } from 'serialport'
import P_CODES_TABLE from './pcodes.json' assert { type: "json" };

const DTC_STATUS_SYMPTOMS = [
	'no fault symptom available for this DTC',
	'above maximum threshold',
	'below minimum threshold',
	'no signal',
	'invalid signal',
];
const DTC_STORAGE_STATE = {
	0b00: '(noDTCDetected) no DTC stored in non−volatile memory',
	0b01: '(DTCNotPresent) A DTC was present. DTC stored in non−volatile memory.',
	0b10: '(DTCMaturing−Intermittent) Insufficient data to consider the error ready for storage in non−volatile memory.',
	0b11: '(DTCPresent) DTC stored in non−volatile memory',
};

const DTC_GROUPS = {
	0b00: 'P',
	0b01: 'C',
	0b10: 'B',
	0b11: 'U',
}

export default class KLine {

	constructor(options = {}) {

		this.isDebug = options.isDebug;
	}

	async init(portName) {
		const WindowsBinding = autoDetect()
		const ports = (await WindowsBinding.list()).filter((p)=>(p.path=='/dev/ttyUSB0'||p.path=='COM2'||p.path==portName));
		this.port = await WindowsBinding.open({
			path: ports[0].path,
			baudRate: 10400,
			// rtsMode: 'enable',
		});
	}

	async read(len = 1, offset = 0, timeout = 0) {
		let bytesRead = 0;
		let buffer = null;
		let readPromise = Promise.resolve();

		readPromise = this.port.read(Buffer.alloc(len+offset), offset, len)
			.then((data)=>{
				bytesRead = data.bytesRead;
				buffer = data.buffer;
				if(timeout) readByte = data.buffer;
			});

		const promiseRace = [readPromise];

		if(timeout > 0) promiseRace.push(new Promise((res)=>setTimeout(res, timeout)));

		await Promise.race(promiseRace);
		// console.log(buffer)

		return buffer;
	}

	async write(str) {
		return this.port.write(Buffer.from(str.replaceAll(' ', ''), 'hex'))
	}

	async sendCommand(command, requestName, skipLenPrepend = false, responseLen) {
		if(this.isDebug) {
			console.time(`${requestName} total time`);
		}
		const port = this.port;

		let commandBuffer = Buffer.from(command, 'hex');

		if(!skipLenPrepend) {
			const cmdLen = commandBuffer.length;

			// prepen the command length
			commandBuffer = Buffer.concat([Buffer.from([cmdLen]), commandBuffer]);
			command = cmdLen.toString(16).padStart(2, '0') + command;
		}

		// append the command checksum
		const csum = this.commandChecksum(commandBuffer);

		command = command + csum.toString(16).padStart(2, '0');
		commandBuffer = Buffer.concat([commandBuffer, Buffer.from([csum])]);

		if(this.isDebug) console.log(`Command:`, commandBuffer);

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

		// on, off, on, on, on, off, on, on, on, off
		// port.set({brk: true})
		// await new Promise((res)=>setTimeout(res, 200))
		// port.set({brk: false})
		// await new Promise((res)=>setTimeout(res, 200))
		// port.set({brk: true})
		// await new Promise((res)=>setTimeout(res, 200))
		// port.set({brk: true})
		// await new Promise((res)=>setTimeout(res, 200))
		// port.set({brk: true})
		// await new Promise((res)=>setTimeout(res, 200))
		// port.set({brk: false})
		// await new Promise((res)=>setTimeout(res, 200))
		// port.set({brk: true})
		// await new Promise((res)=>setTimeout(res, 200))
		// port.set({brk: true})
		// await new Promise((res)=>setTimeout(res, 200))
		// port.set({brk: true})
		// await new Promise((res)=>setTimeout(res, 200))
		// port.set({brk: false})

		console.timeEnd('brk_toggle');
	}

	async emptyReads() {
		const port = this.port;

		await port.drain();
		// console.log('waited')
		// console.log('empty reads -----------')
		await this.read();
		await this.read();
		await this.read();
		// console.log('-----------')
	}

	async readInitBytes() {
		const port = this.port;

		// read, expecting 55 ef 8f
		await new Promise((res)=>setTimeout(res, 20))
		await this.read()
		await new Promise((res)=>setTimeout(res, 20))
		await this.read()
		const lastByte = (await this.read()).readUInt8();

		// send complement to last byte
		const complement = (0xff - lastByte).toString(16)
		await new Promise((res)=>setTimeout(res, 20))
		if(this.isDebug) console.log('sending complement', complement)
		await this.write(complement);

		// read back complement
		await new Promise((res)=>setTimeout(res, 10))
		const readbackCompl = await this.read()
		if(this.isDebug) console.log('readback complement', readbackCompl);

		// read, expecting 0xee
		// console.log('expect 0xee')
		await new Promise((res)=>setTimeout(res, 20))
		const confirmationByte = (await this.read()).readUInt8();

		// if(confirmationByte != 0xee) {
		// 	console.log('Got different byte than expected(0xee)', confirmationByte.toString(16));
		// 	process.exit(1);
		// }

		this.ecuAddress = (0xff - confirmationByte).toString(16);

		if(this.isDebug) console.log('Confirmation byte: ', confirmationByte.toString(16));
		if(this.isDebug) console.log('ECU address: ', this.ecuAddress);
	}

	async wakeupECU() {
		// ECU wakeup procedure
		await this.breakToggle();
		await this.emptyReads();
		await this.readInitBytes();
	}

	commandChecksum(command) {
	    let csum = 0

	    for(let i=0;i<command.length;i++) {
	    	const val = command[i];
	        
	        csum = csum + val
	      	csum = (csum & 0xFF) % 0xFF
	    }

	    return csum
	}

	checkPositiveResponse(response, positiveResByte, requestName = 'unnamed') {
		if(response instanceof Buffer) {
			response = response[0];
		}

		if(response !== positiveResByte) {
			console.error(`Error on ${requestName} request, expected: ${positiveResByte.toString(16)}, got: ${response.toString(16)}`);

			return false;
		}

		return true;
	}

	parseDTCStatus(status) {
		// first 4 bits - dtc symptom 
		// { $x0 } 0000 no fault symptom available for this DTC
		// { $x0 } 0001 above maximum threshold
		// { $x0 } 0010 below minimum threshold
		// { $x0 } 0100 no signal
		// { $x0 } 1000 invalid signal
		// 5th bit - readinesss flag, prob ignore
		// 6th and 7th bit - storage state
		// 0 0 noDTCDetected at time of request
		// 0 1 DTCNotPresent at time of request
		// 1 0 DTCMaturing−Intermittent at time of request
		// 1 1 DTCPresent at time of request
		// 8th bit - DTCWarningLampCalibrationStatus, dash warning light, ignore

		const storageState = DTC_STORAGE_STATE[status>>5];
		let symptom;

		for(const [bit, str] of DTC_STATUS_SYMPTOMS.entries()) {
			if((status & (1<<bit))) {
				symptom = str;
				break;
			}
		}

		const statusStr = `${symptom}, ${storageState} (${status.toString(2).padStart(8, '0')})`;

		return statusStr;
	}

	async readDTCs() {
		const {response} = await this.sendCommand('1800ff00', 'ReadDiagnosticTroubleCodesByStatus')

		// console.log('DTCs raw response');
		// console.log(response.length)
		// const response = Buffer.from('08056222068564023861060068060064011362011862152364', 'hex');
		const numDTCs = response[0];
		const allDtcData = response.slice(1);

		console.log(`${numDTCs} Faults Found:`);

		for(let i=0;i<numDTCs;i++) {
			const dtcDataLen = 3;
			const startOffset = dtcDataLen*i;

			const dtcData = Buffer.from([allDtcData[startOffset], allDtcData[startOffset+1]]);
			const dtcStatus = this.parseDTCStatus(Buffer.from([allDtcData[startOffset+2]])[0]);
			const dtcVal = dtcData.readUInt16BE();

			const dtcNumber0 = dtcVal & 0b1111;
			const dtcNumber1 = dtcVal>>4 & 0b1111;
			const dtcNumber2 = dtcVal>>8 & 0b1111;
			const dtcNumber3 = (dtcVal>>12 & 0b1111);
			const dtcGroup = DTC_GROUPS[(dtcVal>>14 & 0b11)]; 

			const dtcNumber = [dtcNumber2, dtcNumber1, dtcNumber0].join('')
			const codeStr = `${dtcGroup}${dtcNumber3}${dtcNumber}`;

			console.log(`${codeStr} ${P_CODES_TABLE[codeStr]}`)
			// console.log(`\t${dtcStatus}`)
			console.log(`\t${dtcVal.toString(2).padStart(16, '0')}, ${dtcNumber2.toString(2).padStart(4, '0')} ${dtcNumber1.toString(2).padStart(4, '0')} ${dtcNumber0.toString(2).padStart(4, '0')}`)
		}

	}

	async clearDts() {
		const res = await this.sendCommand('14ff00', 'clearDiagnosticInformation');
	}

}