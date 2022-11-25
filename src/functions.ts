

const separator = "=".repeat(process.stdout.columns)

// Log a separator with a text
const separatorTextLog = (text: string) => {
    const textLength = text.length;
    const separatorLength = separator.length - (textLength + 2);
    console.log(separator.substring(0, (separatorLength / 2)) + " " + text + " " + separator.substring(0, (separatorLength % 2) + (separatorLength / 2)));
};

// Log a separator
const separatorLog = () => {
	console.log(separator);
};

// Log text, welle displayed text
const textLog = (t: string, space: number) => {
	let text = t;
	//Log text then go to the next line if > separator length
	while (text.length > separator.length) {
		//Get the first part of the text that fit in the word
		const toLog = text.substring(0, separator.length - space * 2);
		//Get the last space in the text
		let lastSpace = toLog.lastIndexOf(' ');

		// If there is no space in the text
		// Then log the text and go to the next line
		if (lastSpace === -1) {
			lastSpace = separator.length - space * 2;
		}

		//Log the text
		console.log(" ".repeat(space) + text.substring(0, lastSpace));

		//Remove the text that has been logged
		text = text.substring(lastSpace + 1);
	}
	console.log(" ".repeat(space) + text);
}

const functions = {
	separatorTextLog,
	separatorLog,
	textLog
}

export default functions;