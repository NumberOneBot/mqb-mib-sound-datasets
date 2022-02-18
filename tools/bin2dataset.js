const fs = require('fs');
const clc = require('cli-color');
const polycrc = require('polycrc');
const argv = require('minimist')(process.argv.slice(2));

const crc16Calculator = polycrc.crc(16, 0x1021, 0xffff, 0, false); // size, poly, init, xorout, refin/refout

if (!argv._.length) {
	console.log(clc.yellow('\nNo file name(s) provided'));
	argv.help = true;
}
const {
	_: files,
	format = 'bin', // not used
	zdc = true, // use ZDC prefixes
	caret = 16, // add CR every N bytes
	output = 'DATASET', // default name for output
	help = false,
} = argv;

if (help) {
	console.log(`
Usage:
  bin2dataset [files...] [options]

Packs one or several data blocks into dataset, using provided XML template.
Names of the files should contain address of the block as last suffix
before file extension.

OPTIONS
  --format=[hex|bin]  format of the input data, default value is 'bin'
  --zdc               use file name prefix as ZDC container name
  --caret=[N]         add CRLF symbol every N bytes, default is 16
  --output=[file]     use it as output dataset file name, default is 'DATASET'
`);
	return;
}

const template = `<?xml version="1.0" encoding="UTF-8"?>
<MESSAGE DTD="XMLMSG" VERSION="1.1">
<RESULT>
<RESPONSE NAME="GetParametrizeData" DTD="RepairHints" VERSION="1.4.7.1" ID="0">
<DATA>
<REQUEST_ID>000000000</REQUEST_ID><!--PARAMETERS-->
<COMPOUNDS>
<COMPOUND COMPOUND_ID="1">
<SW_NAME/>
<SW_VERSION/>
<SW_PART_NO/>
</COMPOUND>
<COMPOUND COMPOUND_ID="2">
<SW_NAME/>
<SW_VERSION/>
<SW_PART_NO/>
</COMPOUND>
<COMPOUND COMPOUND_ID="3">
<SW_NAME/>
<SW_VERSION/>
<SW_PART_NO/>
</COMPOUND>
<COMPOUND COMPOUND_ID="4">
<SW_NAME/>
<SW_VERSION/>
<SW_PART_NO/>
</COMPOUND>
<COMPOUND COMPOUND_ID="5">
<SW_NAME/>
<SW_VERSION/>
<SW_PART_NO/>
</COMPOUND>
</COMPOUNDS>
<INFORMATION>
<CODE/>
</INFORMATION>
<DSD_DATA>
<COMPRESSED_DATA CONTENT="DSD-Files" CONTENT_TYPE="application/tar" CONTENT_TRANSFER_ENCODING="base64" BYTES_UNCOMPRESSED="0" BYTES_COMPRESSED="0">

</COMPRESSED_DATA>
</DSD_DATA>
</DATA>
</RESPONSE>
</RESULT>
</MESSAGE>`;

const prettify = (value, length = 2) => value.toString(16).toUpperCase().padStart(length, '0');

let parameters = '';
let zdcName;

files.map((filename) => {
	try {
		zdcName = zdc ? filename.slice(0, filename.indexOf('.')) : '';
		const binaryData = fs.readFileSync(filename),
			hexArray = [...binaryData].map((char) => '0x' + prettify(char)),
			crcData = Uint8Array.from([...binaryData].slice(0, -2)),
			crc = prettify(crc16Calculator(crcData), 4);

		hexArray.splice(-2, 2, '0x' + crc.substr(0, 2), '0x' + crc.substr(2, 4));

		const hexData = hexArray.join(',').replace(new RegExp('(.{' + caret * 5 + '})', 'g'), '$1\n'),
			address = filename.split('.').slice(-2, -1)[0],
			parametersName = filename.slice(zdc ? filename.indexOf('.') + 1 : 0, filename.indexOf(address) - 1),
			parametersTemplate = `
<PARAMETER_DATA DIAGNOSTIC_ADDRESS="0x5F" START_ADDRESS="${address}" PR_IDX="" ZDC_NAME="${zdcName}" ZDC_VERSION="0001" LOGIN="20103" LOGIN_IND="" DSD_TYPE="1" SESSIONNAME="" FILENAME="${parametersName}">
${hexData}
</PARAMETER_DATA>`;
		parameters += parametersTemplate;
	} catch (err) {
		console.log('Error reading binary files', err);
		parameters = false;
	}
});
if (parameters) {
	const data = template.replace('<!--PARAMETERS-->', parameters),
		outName = zdcName || output;
	fs.writeFile(`${outName}.xml`, data, (err) => {
		if (err) return console.log(err);
		console.log(clc.cyan(`${outName}.xml`) + ' created');
	});
}
