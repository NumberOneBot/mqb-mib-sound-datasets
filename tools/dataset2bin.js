const fs = require('fs');
const clc = require('cli-color');
const argv = require('minimist')(process.argv.slice(2));

if (!argv._.length) {
	console.log(clc.yellow('\nNo file name provided'));
	argv.help = true;
}

const {
	_: [filename],
	format = 'bin',
	help = false
} = argv;

if (help) {
	console.log(`
Usage:
	dataset2bin [file] [options]

Extracts all data blocks packed in MQB dataset as binary or hex files.

OPTIONS
	--format=[hex|bin]     format of the data, default value is 'bin'
`);
	return;
}

fs.readFile(filename, 'utf8', (err, data) => {
	if (err) return console.log(err);
	// <PARAMETER_DATA DIAGNOSTIC_ADDRESS="0x5F" START_ADDRESS="0x000240" PR_IDX="" ZDC_NAME="5G0CV1v____" ZDC_VERSION="0001" LOGIN="20103" LOGIN_IND="" DSD_TYPE="1" SESSIONNAME="" FILENAME="">
	const datasets = [
		...data.matchAll(
			/<PARAMETER_DATA.*?START_ADDRESS="(\S+)".*?ZDC_NAME="(\S*)".*?>(.*?)<\/PARAMETER_DATA>/gims
		)
	];
	const addr = datasets.map((val) => val[1]),
		zdcName = datasets[0][2] || '',
		hex = datasets.map((val) => val[3].replaceAll(/\s|\n|0x|,/gim, ''));
	addr.map((val, i) => {
		// console.log(`START_ADDRESS=${val} data length = %i`, hex[index].length);
		const parametersName = filename.replace('.xml', ''),
			addrFilename = (zdcName ? zdcName + '.' : '') + `${parametersName}.${val}.${format}`,
			bin = Uint8Array.from(hex[i].match(/(..)/g).map((val) => parseInt(val, 16)));

		fs.writeFile(addrFilename, bin, (err) => {
			if (err) return console.log(err);
			console.log(clc.cyan(`${addrFilename}`) + ' created');
		});
	});
});
