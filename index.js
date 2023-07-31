import { autoDetect, } from '@serialport/bindings-cpp'
import { SerialPort } from 'serialport'

const WindowsBinding = autoDetect()
const ports = (await WindowsBinding.list()).filter((p)=>[p.path=='COM2']);
const port = await WindowsBinding.open({
	path: ports[0].path,
	baudRate: 10400,
	// rtsMode: 'enable',
});


const write = (str) => port.write(Buffer.from(str.replaceAll(' ', ''), 'hex'));
const read = async (len = 1, offset = 0, timeout = 0) => {
	let bytesRead = 0;
	let buffer = null;
	let readPromise = Promise.resolve();

	readPromise = port.read(Buffer.alloc(len+offset), offset, len)
		.then((data)=>{
			bytesRead = data.bytesRead;
			buffer = data.buffer;
			if(timeout) readByte = data.buffer;
		});

	const promiseRace = [readPromise];

	if(timeout > 0) promiseRace.push(new Promise((res)=>setTimeout(res, timeout)));

	await Promise.race(promiseRace);

	return buffer;
};

const bigbang = async () => {
	// bitbang data
	write('aa');
	await read()
	write('55');
	await read()
	write('aa');
	await read()
	write('55');
	await read()

	await port.update({baudRate: 10400});
}

const breakToggle = async () => {
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
}

const emptyReads = async () => {
	await port.drain();
	// console.log('waited')
	// console.log('empty reads -----------')
	await read();
	await read();
	await read();
	// console.log('-----------')
}

const readInitBytes = async () => {
	// read, expecting 55 ef 8f
	await new Promise((res)=>setTimeout(res, 20))
	await read()
	await new Promise((res)=>setTimeout(res, 20))
	await read()
	const lastByte = (await read()).readUInt8();

	// send complement to last byte
	const complement = (0xff - lastByte).toString(16)
	await new Promise((res)=>setTimeout(res, 20))
	// console.log('sending complement', complement)
	await write(complement);

	// read back complement
	await new Promise((res)=>setTimeout(res, 10))
	await read()

	// read, expecting 0xee
	// console.log('expect 0xee')
	await new Promise((res)=>setTimeout(res, 20))
	const confirmationByte = (await read()).readUInt8();

	if(confirmationByte != 0xee) {
		console.log('Got different byte than expected(0xee)', confirmationByte.toString(16));
		process.exit(1);
	}

}

const wakeupECU = async () => {
	// ECU wakeup procedure
	await bigbang();
	await breakToggle();
	await emptyReads();
	await readInitBytes();
}

const commandChecksum = (command) => {
    let csum = 0

    for(let i=0;i<command.length;i++) {
    	const val = command[i];
        
        csum = csum + val
      	csum = (csum & 0xFF) % 0xFF
    }

    return csum
}

const sendCommand = async (command) => {
	let commandBuffer = Buffer.from(command, 'hex');
	const cmdLen = commandBuffer.length;

	// prepen the command length
	commandBuffer = Buffer.concat([Buffer.from([cmdLen]), commandBuffer]);
	command = cmdLen.toString(16).padStart(2, '0') + command;

	// append the command checksum
	const csum = commandChecksum(commandBuffer);

	command = command + csum.toString(16).padStart(2, '0');
	commandBuffer = Buffer.concat([commandBuffer, Buffer.from([csum])]);

	await write(command);

	let data = [];
	// the command should be echoed back
	for(let i=0;i<commandBuffer.length;i++) {
		data.push(await read());
	}

	let res = Buffer.concat(data);

	if(!commandBuffer.equals(res)) {
		console.error('Command echo does not equal sent command', commandBuffer, resConfirmation);
		process.exit(1);
	}

	// next byte after the command echo is the length of the response
	const responseLen = (await read())[0];

	data.length = 0;
	// read the command response
	for(let i=0;i<responseLen;i++) {
		data.push(await read());
	}

	// what does the last byte mean?
	const responseChecksum = await read();

	res = Buffer.concat(data);

	const resStr = res.toString().replace(/[\u{0080}-\u{FFFF}]/gu,"");
	const resObj = {
		command: commandBuffer,
		result: resStr,
		raw: res,
	}

	console.log(resObj)

	return res;
}

await wakeupECU();

// reports the ECU part number and engine type
await sendCommand('1A9B');

// 0x10 - start diagnostic session
// 0x86 set baudrate
// 0x64 - 57600
const startDiagS = await sendCommand('108664');
if(startDiagS[0] !== 0x50) {
	console.log('Error on startDiagnosticSession request')
}
await port.update({baudRate: 57600});

