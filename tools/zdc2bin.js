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
	pr = false, // filter pr codes
	any = false,
	extract = false, // extract some dataset
	help = false,
} = argv;

let {
	list = false, // do not generate binary files, just print names
	addr = '3000', // default address, 'any' dumps them all
} = argv;

if (any) {
	addr = 'any';
}
if (details) {
	list = true;
}

if (help) {
	console.log(`
Usage:
  zdc2bin [file] [options]

Dataset browser / extractor tool. Takes ZDC container and shows available
datasets in it, using provided options to filter them.

OPTIONS
  --list              show list of datasets matching filter rules
  --details           show full info about every dataset
  --extract=[index]   use it in a combo with 'list' / 'details' option to
                      extract on of the datasets in the printed output
  --zdc               use container name as prefix of the new files
  --format=[hex|bin]  format of the data extracted to files, default is 'bin'

FILTERING
  --pr=[8RM]          show datasets with provided PR-code only
  --addr=[3B00]       show datasets with provided address only, default
                      is '0x003000'
  --any               alias to addr=any
`);
	return;
}

if (!argv.addr && addr !== 'any') {
	console.log('\n' + clc.green(`Default address 0x00${addr} used`));
}
fs.readFile(filename, 'utf8', (err, data) => {
	if (err) return console.log(err);
	if (data.indexOf('<DATENBEREICH>') === -1) return console.log('File provided is not a ZDC container');

	const zdcName = [...data.matchAll(/<DATEIID>(.*?)<\/DATEIID>/gims)][0][1] || '';
	const datasets = [
		...data.matchAll(
			/<DATENBEREICH>.*?<DATEN-NAME>(.*?)<\/DATEN-NAME>.*?<START-ADR>(.*?)<\/START-ADR>.*?<DATEN>(.*?)<\/DATEN>.*?<\/DATENBEREICH>/gims
		),
	].filter((val) =>
		String(addr).toUpperCase() === 'ANY' ? true : val[2].indexOf(String(addr).toUpperCase()) !== -1
	);
	let info = [...data.matchAll(/<TEGUE>.*?<PRNR>(.*?)<\/PRNR>.*?<PRBEZ>(.*?)<\/PRBEZ>.*?<\/TEGUE>/gims)];

	let filteredData = [];
	datasets.map((val) => {
		const profileByName = info.filter((val2) => val2[0].indexOf(val[1]) !== -1);
		let foundFlag = false,
			foundIndex = [];
		if (pr) {
			profileByName.map((pval, index) => {
				if (
					val[1].indexOf(String(pr).toUpperCase()) !== -1 ||
					pval[1].indexOf(String(pr).toUpperCase()) !== -1 ||
					pval[2].indexOf(String(pr).toUpperCase()) !== -1
				) {
					foundFlag = true;
					foundIndex.push(index);
				}
			});
			if (!foundFlag) {
				return;
			}
		}
		filteredData.push(val);
		if (list) {
			console.log(clc.yellow(val[2]) + ' = ' + clc.green(val[1]));
			if (details) {
				profileByName.map((val, index) => {
					if (pr && !foundFlag) {
						return;
					}
					console.log(
						clc.magenta(
							String(val[1])
								.padEnd(20, ' ')
								.replace(String(pr).toUpperCase(), clc.inverse(String(pr).toUpperCase())) +
								'   ' +
								clc.cyan(
									String(val[2]).replace(
										String(pr).toUpperCase(),
										clc.inverse(String(pr).toUpperCase())
									)
								)
						)
					);
				});
			}
		}
	});
	console.log(' ');
	if (list && !extract) {
		return;
	}

	filteredData.map((val, index) => {
		const hex = val[3].replaceAll(/\s|\n|0x|,/gim, ''),
			bin = Uint8Array.from(hex.match(/(..)/g).map((val) => parseInt(val, 16))),
			filename = (zdc ? zdcName + '.' : '') + `${val[1]}.${val[2]}.${format}`;

		if ((!list && !extract) || (list && extract === index + 1)) {
			fs.writeFile(filename, bin, (err) => {
				if (err) return console.log(err);
				console.log(clc.green(`${filename}`) + ' created');
			});
		}
	});
});
