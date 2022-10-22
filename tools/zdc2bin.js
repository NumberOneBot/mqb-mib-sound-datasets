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
	zdc = true, // use ZDC prefixes for file names
	details = false, // show full info about every dataset found
	list = details ? true : false, // do not generate binary files, just print names
	pr = false, // filter PR codes
	addr = 'any', // default address, 'any' dumps them all
	extract = false, // extract some dataset
	help = false
} = argv;

// helpers
const PR = String(pr).toUpperCase(),
	ADDR = String(addr).toUpperCase();

if (help) {
	console.log(`
Usage:
  zdc2bin [file] [options]

Dataset browser / extractor tool. Takes ZDC container and shows available
datasets inside it, using provided options to filter them.

OPTIONS
  --list              show list of datasets matching filter rules
  --details           show full info about every dataset
  --extract=[index]   use it in the combination with 'list' / 'details' option
                      to extract one of the datasets in the printed output
  --zdc               use container name as prefix of the new files
  --format=[hex|bin]  format of the data extracted to files, default is 'bin'

FILTERING
  --pr=[8RM]          show datasets with provided PR-code only
  --addr=[0x003B00]   show datasets with provided address only, could be
                      shortened value like '3B00', default is '0x003000'
`);
	return;
}

fs.readFile(filename, 'utf8', (err, data) => {
	if (err) return console.log(err);
	const odisZdc = data.indexOf('<DATENBEREICH>') !== -1,
		vcpZdc = data.indexOf('<DATABLOCK>') !== -1;
	if (!odisZdc && !vcpZdc) return console.log('File provided is not a ZDC container');

	const containerName =
		[...data.matchAll(/<DATEIID>(.*?)<\/DATEIID>/gims)][0]?.[1] || // ZDC
		filename.slice(0, filename.lastIndexOf('.')); // FILE
	let info = [
		...data.matchAll(/<TEGUE>.*?<PRNR>(.*?)<\/PRNR>.*?<PRBEZ>(.*?)<\/PRBEZ>.*?<\/TEGUE>/gims)
	];
	let parsedData = [];
	if (odisZdc) {
		// German XML notation
		parsedData = [
			...data.matchAll(
				/<DATENBEREICH>.*?<DATEN-NAME>(.*?)<\/DATEN-NAME>.*?<START-ADR>(.*?)<\/START-ADR>.*?<DATEN>(.*?)<\/DATEN>.*?<\/DATENBEREICH>/gims
			)
		];
	} else {
		// vcpZdc
		// English XML notation
		parsedData = [
			...data.matchAll(
				/<DATABLOCK>.*?<DATABLOCKNAME>(.*?)<\/DATABLOCKNAME>.*?<UPLOADADDR>(.*?)<\/UPLOADADDR>.*?<BYTEDATA>(.*?)<\/BYTEDATA>.*?<\/DATABLOCK>/gims
			)
		];
	}
	const datasets = parsedData.filter(([, , addr]) =>
		ADDR === 'ANY' ? true : addr.indexOf(ADDR) !== -1
	);

	let filteredData = [];
	datasets.map(([, name, addr, hex]) => {
		const profileByName = info.filter(([val]) => val.indexOf(name) !== -1);
		let foundFlag = false;
		if (pr) {
			profileByName.map(([, prCodes, modelName]) => {
				if (
					// search for PR code in several places
					[name, prCodes, modelName].reduce(
						(prev, cur) => cur.indexOf(PR) !== -1 || prev,
						false
					)
				) {
					foundFlag = true;
				}
			});
			if (!foundFlag) return;
		}
		filteredData.push({ name, addr, hex });
		if (list) {
			console.log(clc.yellow(addr) + ' = ' + clc.green(name));
			if (details) {
				profileByName.map(([, prCodes, modelName]) => {
					if (pr && !foundFlag) return;
					console.log(
						clc.magenta(String(prCodes).padEnd(20, ' ').replace(PR, clc.inverse(PR))) +
							'   ' +
							clc.cyan(String(modelName).replace(PR, clc.inverse(PR)))
					);
				});
			}
		}
	});
	console.log(' '); // new line
	if (list && !extract) return;

	filteredData.map(({ name, addr, hex }, index) => {
		const hexPairs = hex.replaceAll(/\s|\n|0x|,/gim, ''), // cleanup
			bin = Uint8Array.from(hexPairs.match(/(..)/g).map((val) => parseInt(val, 16))),
			filename = (zdc ? containerName + '.' : '') + `${name}.${addr}.${format}`;

		if ((!list && !extract) || (list && extract === index + 1)) {
			fs.writeFile(filename, bin, (err) => {
				if (err) return console.log(err);
				console.log(clc.green(`${filename}`) + ' created');
			});
		}
	});
});
