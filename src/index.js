const btn  = document.querySelector('#open-port-btn')
const openPort = async () => {
	const port = await navigator.serial.requestPort({usbProductId: 29987, usbVendorId: 6790})

	await port.open({
		baudRate: 10400,
	});

	console.error(await port.getInfo())

	const write = async (val, size = 1) => {
		const writer = port.writable.getWriter();

		const sendData = new Uint8Array(size);
		sendData[0] = val

		await writer.write(sendData);
		writer.releaseLock()
	}

	const read = async () => {
		const reader = port.readable.getReader();
		console.error(reader)

      	let { value, done } = await reader.read();
      	console.log(value, done)
		await new Promise((res)=>setTimeout(res, 50))

		reader.releaseLock();
	}

	
	write(0xaa);
	await new Promise((res)=>setTimeout(res, 50))
	write(0x55);
	await new Promise((res)=>setTimeout(res, 50))
	write(0xaa);
	await new Promise((res)=>setTimeout(res, 50))
	write(0x55);
	await new Promise((res)=>setTimeout(res, 50))


	await read();
	// await new Promise((res)=>setTimeout(res, 50))
	// read();
	// await new Promise((res)=>setTimeout(res, 50))
	// read();
	// await new Promise((res)=>setTimeout(res, 50))
	// read();
	// await new Promise((res)=>setTimeout(res, 50))


	port.close()

	// while (port.readable) {
	//   const reader = port.readable.getReader();
	//   console.error(reader)
	//   try {
	//     while (true) {
	//       const { value, done } = await reader.read();
	//       console.error(value, done)
	//       if (done) {
	//         // |reader| has been canceled.
	//         break;
	//       }
	//       console.error(value)
	//       // Do something with |value|...
	//     }
	//   } catch (error) {
	//   	console.error(error)
	//     // Handle |error|...
	//   } finally {
	//     reader.releaseLock();
	//   }
	// }

}

btn.onclick = openPort