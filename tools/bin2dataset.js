const fs = require("fs");
const clc = require("cli-color");
const polycrc = require("polycrc");
const argv = require("minimist")(process.argv.slice(2));

const crc16Calculator = polycrc.crc(16, 0x1021, 0xffff, 0, false); // size, poly, init, xorout, refin/refout

if (!argv._.length) {
	console.log(clc.yellow("\nNo file name(s) provided"));
	argv.help = true;
}

const {
	_: files,
	zdc = true, // use ZDC prefixes
	caret = 16, // add CR every N bytes
	output = "DATASET", // default name for output
	container = "odis",
	crc16 = "yes",
	help = false
} = argv;

if (help) {
	console.log(`
Usage:
  bin2dataset [files...] [options]

Packs one or several data blocks into dataset. Names of the files should contain
address of the block as last suffix before file extension.

OPTIONS
  --container=[odis|vcp] format of the resulting container, default is 'odis'
  --zdc                  use file name prefix as ZDC container name
  --caret=[N]            add CRLF symbol every N bytes, default is 16
  --crc16=[yes|no]       update CRC16 at the end of the dataset, default is 'yes'
  --output=[file]        use it as output dataset file name, default is 'DATASET'
`);
	return;
}

const odisTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<MESSAGE DTD="XMLMSG" VERSION="1.1">
<RESULT>
<RESPONSE NAME="GetParametrizeData" DTD="RepairHints" VERSION="1.4.7.1" ID="0">
<DATA>
<REQUEST_ID>000000000</REQUEST_ID>
<!--PARAMETERS-->
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

const vcpTemplate = `<?xml version="1.0" encoding="ISO-8859-1"?>
<!DOCTYPE ZDC PUBLIC "ZDC0205.dtd"
                     "ZDC0205.dtd">
<?xml-stylesheet href="ZDC0205.xsl" type="text/xsl"?>
<ZDC>
<IDENT>
<DATEINAME>ASAM_ODX</DATEINAME>
<DATEIID><!--ZDC--></DATEIID>
<VERSION-TYP>020401</VERSION-TYP>
<VERSION-INHALT>0049</VERSION-INHALT>
<LOGIN>20103</LOGIN>
<ALFID>24</ALFID>
</IDENT>
<VORSCHRIFT>
<DIREKT>
<DIAGN>
<BUS>MOST-Infotainment</BUS>
<ADR>5F</ADR>
</DIAGN>
<DATENBEREICHE><!--PARAMETERS-->
</DATENBEREICHE>
</DIREKT>
</VORSCHRIFT>
</ZDC>`;

const prettify = (value, length = 2) => value.toString(16).padStart(length, "0");

let parameters = "";
let zdcName;

files.map((filename) => {
	try {
		zdcName = zdc ? filename.slice(0, filename.indexOf(".")) : "";
		const binaryData = fs.readFileSync(filename),
			hexArray = [...binaryData].map((char) => "0x" + prettify(char)),
			crcData = Uint8Array.from([...binaryData].slice(0, -2)),
			crc = prettify(crc16Calculator(crcData), 4);

		if (crc16 === "yes") {
			hexArray.splice(-2, 2, "0x" + crc.substr(0, 2), "0x" + crc.substr(2, 4));
		}

		const hexData = hexArray
				.join(",")
				.replace(new RegExp("(.{" + caret * 5 + "})", "g"), "$1\n"),
			address = filename.split(".").slice(-2, -1)[0],
			dataSize = "0x" + binaryData.length.toString(16),
			parametersName = filename.slice(
				zdc ? filename.indexOf(".") + 1 : 0,
				filename.indexOf(address) - 1
			),
			parametersVcpTemplate = `
<DATENBEREICH>
<DATEN-NAME>${parametersName}</DATEN-NAME>
<DATEN-FORMAT-NAME>DFN_HEX</DATEN-FORMAT-NAME>
<START-ADR>${address}</START-ADR>
<GROESSE-DEKOMPRIMIERT>${dataSize}</GROESSE-DEKOMPRIMIERT>
<DATEN>
${hexData}
</DATEN>
</DATENBEREICH>`,
			parametersOdisTemplate = `
<PARAMETER_DATA DIAGNOSTIC_ADDRESS="0x5F" START_ADDRESS="${address}" PR_IDX="" ZDC_NAME="${zdcName}" ZDC_VERSION="0003" LOGIN="20103" LOGIN_IND="" DSD_TYPE="1" SESSIONNAME="" FILENAME="">
${hexData}
</PARAMETER_DATA>`;
		if (container === "odis") {
			parameters += parametersOdisTemplate;
		} else {
			parameters += parametersVcpTemplate;
		}
	} catch (err) {
		console.log("Error reading binary files", err);
		parameters = false;
	}
});
if (parameters) {
	const data = (container === "odis" ? odisTemplate : vcpTemplate)
			.replace("<!--PARAMETERS-->", parameters)
			.replace("<!--ZDC-->", zdcName),
		outName = (zdcName ? zdcName + "." : "") + output + "." + container.toUpperCase();
	fs.writeFile(`${outName}.xml`, data, (err) => {
		if (err) return console.log(err);
		console.log(clc.cyan(`${outName}.xml`) + " created");
	});
}
