var errorHandler = {
	errorCount: 0,
	errorMessage: [],
	addError: function (message) {
		this.errorMessage.push(message);
		this.errorCount++;
	},
	showErrors: function () {
		$('.alert-container').html('<div class="alert alert-danger alert-dismissible fade" role="alert"><div class="message"></div><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>')
		for (var i = 0; this.errorMessage.length > i; i++) {
			$('.message').append("<p class='mb-0'>" + this.errorMessage[i] + "</p>")
			$('.alert').alert();
			$('.alert').addClass('show');
		}
		this.errorMessage = [];
		this.errorCount = 0;
	},
	hideAlert: function () {
		if ($('.alert')) {
			$('.alert').remove();
		}
	}
};

var config = {
	questionScore: 1,
	difficultyScore: 1,
	removeEnumeration: false
};

function ConvertQuiz() {
	Format();
	//Get the text from the plainText input. 
	var plaintextInput = formatPlainText($('#plaintextInput').val().split('\n'));
	//errorHandler.onSubmit();
	var questionArray = [];
	//Overarching loop
	for (var lineIndex = 0; plaintextInput.length > lineIndex; lineIndex++) {

		if (plaintextInput[lineIndex] != '') {
			var currentQuestionBlock = [];
			for (var questionLineIndex = 0;
				(plaintextInput[lineIndex + questionLineIndex] != '') && (lineIndex + questionLineIndex != plaintextInput.length); questionLineIndex++) {
				currentQuestionBlock.push(plaintextInput[lineIndex + questionLineIndex]);
			}
			questionArray.push(EvaluateBlock(currentQuestionBlock, lineIndex));
			lineIndex = lineIndex + questionLineIndex;
		}
	}

	var CSVData = '';

	if (errorHandler.errorCount == 0) {
		errorHandler.hideAlert();
		for (var questionIndex = 0; questionIndex < questionArray.length; questionIndex++) {
			CSVData += questionArray[questionIndex].ConvertToCSV();
		}
		$('#csvOutput').val(CSVData);
		document.getElementById('downloadButton').disabled = false;
		var dataStr = encodeURI("data:text/csv;charset=utf-8," + CSVData);
		var dlAnchorElem = document.getElementById('downloadButton');
		dlAnchorElem.setAttribute("href", dataStr);
		dlAnchorElem.setAttribute("download", "quiz.csv");

	} else {
		errorHandler.showErrors();
	}



}

function EvaluateBlock(lineBlock, lineIndex) {
	if (config.removeEnumeration) {
		lineBlock[0] = removeEnumeration(lineBlock[0]);
	}

	if (lineBlock.length === 1) {
		//Written Response using default points
		return newWrittenResponse(lineBlock);
	} else if (lineBlock.length === 2) {
		if (lineBlock[1].toLowerCase() !== "true" && lineBlock[1].toLowerCase() !== "false" && lineBlock[1].toLowerCase().search("points") == -1){
			errorHandler.addError("Error on line " + (lineIndex + 1) + ": Only true or false questions can have only one answer choice, and it must be either true or false. Make sure <strong>not</strong> to include a '*' before true or false.");
		} else if(lineBlock[1].toLowerCase().search("points") != -1) {
			//Written Response with points
			return newWrittenResponse(lineBlock);
		
		} else {
			//Since the length of the array is only 2, this must be a true or false question.
			return newTrueFalse(lineBlock);
		}
	} else if (lineBlock.length === 3 && lineBlock[1].toLowerCase().search("points") !== -1) {
		//True/False with custom points
		return newTrueFalse(lineBlock);
	} else {
		//Either a multiple choice or a multi-select, let's test which it is.
		var correctAnswers = 0;
		var match = 0;
		for (var questionLineIndex = 0; questionLineIndex < lineBlock.length; questionLineIndex++) {
			var subStringSample = lineBlock[questionLineIndex].substr(0, 1);
			if (subStringSample == "*") {
				correctAnswers++;
			}
			var searchMatch = lineBlock[questionLineIndex].search("/");
			if (searchMatch != -1) {
				match++;
			}
		}
		if (correctAnswers == 1) {
			//Multiple choice
			return newMultipleChoice(lineBlock);
		} else if (correctAnswers > 1) {
			//Multi-select
			return newMultiSelect(lineBlock);
		} else if(correctAnswers == 0) {
			//Either Short Answer/Blank, Matching, or Ordering
			var q = lineBlock[0].toLowerCase()
			if(match > 1){
				//Matching
				return newMatching(lineBlock);
			}
			else if(q.search("order") != -1 || q.search("greatest") != -1 || q.search("sort") != -1)  {
				//Order Question
				return newOrder(lineBlock);
			} else {
				//Short Answer/Fill in the Blank
				return newShortAnswer(lineBlock);
			}
		} else {
			//Error, no correct answers.
			errorHandler.addError("Error on line " + (lineIndex + 1) + ": There is no correct answer selected for question: \"" + lineBlock[0] + "\"");
		  }
	}

}



function newMultiSelect(lineBlock) {
	var multiSelect = new Object();
	//Set default settings
	multiSelect.NewQuestion = 'MS';
	//multiSelect.Title = '';
	multiSelect.QuestionText = '"' + htmlEntities(lineBlock[0]) + '"';
	var startIndex = 1;
	if(lineBlock[1].toLowerCase().search("points") != -1) {
		//Point value given
		var val = lineBlock[1].split(' ')
		multiSelect.Points = htmlEntities(val[1]);
		startIndex = 2;
	} else {
		//Use default
		multiSelect.Points = config.questionScore;
	}
	multiSelect.Difficulty = config.difficultyScore;
	multiSelect.Options = [];
	/* Starts at one because the first line of lineBlock is the question*/
	for (var optionIndex = startIndex; optionIndex < lineBlock.length; optionIndex++) {
		var score = 0;
		if (lineBlock[optionIndex].substr(0, 1) == "*") {
			score = 1;
			lineBlock[optionIndex] = lineBlock[optionIndex].slice(1);
		}
		multiSelect.Options.push(["Option", score, '"' + htmlEntities(lineBlock[optionIndex]) + '"']);
	}
	multiSelect.ConvertToCSV = function () {
		var result, keys;
		keys = Object.keys(this);
		result = '';
		//- 1 magic number is because the ConvertToCSV() counts as a key, and we don't want this function to appear in the CSV
		for (var i = 0; i < keys.length - 1; i++) {
			if (keys[i] == "Options") {
				for (var j = 0; this[keys[i]].length > j; j++) {
					result += this[keys[i]][j].join();
					result += '\n';
				}
			} else {
				result += keys[i] + ',' + this[keys[i]];
				result += '\n';
			}
		}
		return result;
	}
	return multiSelect;
}

function newMultipleChoice(lineBlock) {
	var multipleChoice = new Object();
	//Set default settings
	multipleChoice.NewQuestion = 'MC';
	//multipleChoice.Title = '';
	multipleChoice.QuestionText = '"' + htmlEntities(lineBlock[0]) + '"';
	var startIndex = 1;
	if(lineBlock[1].toLowerCase().search("points") != -1) {
		//Point value given
		var val = lineBlock[1].split(' ')
		//multipleChoice.Points = htmlEntities(val[1]);
		multipleChoice.Points = val[1];
		startIndex = 2;
	} else {
		//Use default
		multipleChoice.Points = config.questionScore;
	}
	multipleChoice.Difficulty = config.difficultyScore;
	multipleChoice.Options = [];
	/* Starts at one because the first line of lineBlock is the question*/
	for (var optionIndex = startIndex; optionIndex < lineBlock.length; optionIndex++) {
		var score = 0;
		if (lineBlock[optionIndex].substr(0, 1) == "*") {
			score = 100;
			lineBlock[optionIndex] = lineBlock[optionIndex].slice(1);
		}
		multipleChoice.Options.push(["Option", score, '"' + htmlEntities(lineBlock[optionIndex]) + '"']);
	}
	multipleChoice.ConvertToCSV = function () {
		var result, keys;
		keys = Object.keys(this);
		result = '';
		//- 1 magic number is because the ConvertToCSV() counts as a key, and we don't want this function to appear in the CSV
		for (var i = 0; i < keys.length - 1; i++) {
			if (keys[i] == "Options") {
				for (var j = 0; this[keys[i]].length > j; j++) {
					result += this[keys[i]][j].join();
					result += ',\n';
				}
			} else {
				result += keys[i] + ',' + this[keys[i]];
				result += ',\n';
			}
		}
		return result;
	}
	return multipleChoice;
}

function newTrueFalse(lineBlock) {
	var trueFalse = new Object();
	//Assign default variables
	trueFalse.NewQuestion = 'TF';
	//trueFalse.Title = '';
	trueFalse.QuestionText = '"' + htmlEntities(lineBlock[0]) + '"';
	var startIndex = 1;
	if(lineBlock[1].toLowerCase().search("points") != -1) {
		//Point value given
		var val = lineBlock[1].split(' ')
		trueFalse.Points = htmlEntities(val[1]);
		startIndex = 2;
	} else {
		//Use default
		trueFalse.Points = config.questionScore;
	}
	trueFalse.Difficulty = config.difficultyScore;
	trueFalse.TRUE = 0;
	trueFalse.FALSE = 0;
	if (lineBlock[startIndex].toLowerCase() === "true") {
		trueFalse.TRUE = 100;
	} else if (lineBlock[startIndex].toLowerCase() === "false") {
		trueFalse.FALSE = 100;
	} else {
		//TODO Error Reporting
		return false;
	}

	trueFalse.ConvertToCSV = function () {
		var result, keys;
		keys = Object.keys(this);
		result = '';
		//- 1 magic number is because the ConvertToCSV() counts as a key, and we don't want this function to appear in the CSV
		for (var i = 0; i < keys.length - 1; i++) {
			result += keys[i] + ',' + this[keys[i]];
			result += '\n';
		}
		return result;
	}

	return trueFalse;
}

function newMatching(lineBlock) {
	var matching = new Object();
	//Set default settings
	matching.NewQuestion = 'M';
	//matching.Title = '';
	matching.QuestionText = '"' + htmlEntities(lineBlock[0]) + '"';
	var startIndex = 1;
	if(lineBlock[1].toLowerCase().search("points") != -1) {
		//Point value given
		var val = lineBlock[1].split(' ')
		matching.Points = htmlEntities(val[1]);
		startIndex = 2;
	} else {
		//Use default
		matching.Points = config.questionScore;
	}
	matching.Difficulty = config.difficultyScore;
	matching.Options = [];
	/* Starts at one because the first line of lineBlock is the question*/
	for (var optionIndex = startIndex; optionIndex < lineBlock.length; optionIndex++) {
		var answer = lineBlock[optionIndex].split('/');
		matching.Options.push(["Choice",'"' + optionIndex + '"', '"' + htmlEntities(answer[0]) + '"']);
		matching.Options.push(["Match",'"' + optionIndex + '"', '"' + htmlEntities(answer[1]) + '"']);
	}
	matching.ConvertToCSV = function () {
		var result, keys;
		keys = Object.keys(this);
		result = '';
		//- 1 magic number is because the ConvertToCSV() counts as a key, and we don't want this function to appear in the CSV
		for (var i = 0; i < keys.length - 1; i++) {
			if (keys[i] == "Options") {
				for (var j = 0; this[keys[i]].length > j; j++) {
					result += this[keys[i]][j].join();
					result += '\n';
				}
			} else {
				result += keys[i] + ',' + this[keys[i]];
				result += '\n';
			}
		}
		return result;
	}
	return matching;
}

function newOrder(lineBlock) {
	var order = new Object();
	//Set default settings
	order.NewQuestion = 'O';
	//order.Title = '';
	order.QuestionText = '"' + htmlEntities(lineBlock[0]) + '"';
	var startIndex = 1;
	if(lineBlock[1].toLowerCase().search("points") != -1) {
		//Point value given
		var val = lineBlock[1].split(' ')
		order.Points = htmlEntities(val[1]);
		startIndex = 2;
	} else {
		//Use default
		order.Points = config.questionScore;
	}
	order.Difficulty = config.difficultyScore;
	order.Options = [];
	/* Starts at one because the first line of lineBlock is the question*/
	for (var optionIndex = startIndex; optionIndex < lineBlock.length; optionIndex++) {
		order.Options.push(["Item",'"' + htmlEntities(lineBlock[optionIndex]) + '"']);
	}
	order.ConvertToCSV = function () {
		var result, keys;
		keys = Object.keys(this);
		result = '';
		//- 1 magic number is because the ConvertToCSV() counts as a key, and we don't want this function to appear in the CSV
		for (var i = 0; i < keys.length - 1; i++) {
			if (keys[i] == "Options") {
				for (var j = 0; this[keys[i]].length > j; j++) {
					result += this[keys[i]][j].join();
					result += '\n';
				}
			} else {
				result += keys[i] + ',' + this[keys[i]];
				result += '\n';
			}
		}
		return result;
	}
	return order;
}

function newShortAnswer(lineBlock) {
	var shortanswer = new Object();
	//Set default settings
	shortanswer.NewQuestion = 'SA';
	//shortanswer.Title = '';
	shortanswer.QuestionText = '"' + htmlEntities(lineBlock[0]) + '"';
	var startIndex = 1;
	if(lineBlock[1].toLowerCase().search("points") != -1) {
		//Point value given
		var val = lineBlock[1].split(' ')
		shortanswer.Points = htmlEntities(val[1]);
		startIndex = 2;
	} else {
		//Use default
		shortanswer.Points = config.questionScore;
	}
	shortanswer.Difficulty = config.difficultyScore;
	shortanswer.Options = [];
	/* Starts at one because the first line of lineBlock is the question*/
	for (var optionIndex = startIndex; optionIndex < lineBlock.length; optionIndex++) {
		shortanswer.Options.push(['Answer' ,'100','"' + htmlEntities(lineBlock[optionIndex]) + '"']);
	}
	shortanswer.ConvertToCSV = function () {
		var result, keys;
		keys = Object.keys(this);
		result = '';
		//- 1 magic number is because the ConvertToCSV() counts as a key, and we don't want this function to appear in the CSV
		for (var i = 0; i < keys.length - 1; i++) {
			if (keys[i] == "Options") {
				for (var j = 0; this[keys[i]].length > j; j++) {
					result += this[keys[i]][j].join();
					result += '\n';
				}
			} else {
				result += keys[i] + ',' + this[keys[i]];
				result += '\n';
			}
		}
		return result;
	}
	return shortanswer;
}

function newWrittenResponse(lineBlock) {
	var writtenresponse = new Object();
	//Set default settings
	writtenresponse.NewQuestion = 'WR';
	//writtenresponse.Title = '';
	writtenresponse.QuestionText = '"' + htmlEntities(lineBlock[0]) + '"';
	var startIndex = 1;
	if(lineBlock.length === 2) {
		//Point value given
		var val = lineBlock[1].split(' ')
		writtenresponse.Points = htmlEntities(val[1]);
		startIndex = 2;
	} else {
		//Use default
		writtenresponse.Points = config.questionScore;
	}
	writtenresponse.Difficulty = config.difficultyScore;
	writtenresponse.ConvertToCSV = function () {
		var result, keys;
		keys = Object.keys(this);
		result = '';
		//- 1 magic number is because the ConvertToCSV() counts as a key, and we don't want this function to appear in the CSV
		for (var i = 0; i < keys.length - 1; i++) {
			
			result += keys[i] + ',' + this[keys[i]];
			result += '\n';
			
		}
		return result;
	}
	return writtenresponse;
}

//Searches through array of strings and removes empty lines if there's more than one of them in a row. 
function formatPlainText(array) {
	var previousEnter = false;
	var redundantLines = [];

	for (var i = 0; i < array.length; i++) {
		//Sets any lines that are JUST spaces to ''
		if (isSpaces(array[i])) {
			array[i] = '';
		}

		//Trim lines
		array[i] = array[i].trim();

		if (array[i] === '' && !previousEnter) {
			previousEnter = true;
		} else if (array[i] === '' && previousEnter) {
			redundantLines.push(i);
		} else if (array[i] != '') {
			previousEnter = false;
		}
	}

	for (var j = redundantLines.length; j > 0; j--) {
		array.splice(redundantLines[j - 1], 1);

	}
	//After clean up, removes the leading or trailing newline, if there is one. 
	if (array[array.length - 1] === '') {
		array.splice(array.length - 1, 1);
	}
	if (array[0] === '') {
		array.splice(0, 1);
	}
	return array;
}

function isSpaces(testString) {
	var justSpaces = /^\s+$/;
	return justSpaces.test(testString);
}

function removeEnumeration(testString) {
	return (testString.replace(/^(([1-9][0-9])|([1-9])){1}(\.|\))?/g, "").trim());
}

/* 

Grimes, C. (2015, May 28). Use JavaScript to Export Your Data as CSV [Program documentation]. 
    Retrieved December 7, 2018, from https://halistechnology.com/2015/05/28/use-javascript-to-export-your-data-as-csv/

*/
function downloadCSV(args) {
	var data, filename, link;
	var csv = convertArrayOfObjectsToCSV({
		data: stockData
	});
	if (csv == null) return;

	filename = args.filename || 'export.csv';

	if (!csv.match(/^data:text\/csv/i)) {
		csv = 'data:text/csv;charset=utf-8,' + csv;
	}
	data = encodeURI(csv);

	link = document.createElement('a');
	link.setAttribute('href', data);
	link.setAttribute('download', filename);
	link.click();
}


//Global on page ready function scripts. 
$(window).on('load', function () {
	$("textarea").linedtextarea();

	$('#score-input').on('change', function () {
		if (this.value !== undefined && this.value !== '') {
			if (this.value > 99) {
				this.value = 99;
			}
			if (this.value < 1) {
				this.value = 1;
			}
		} else {
			this.value = 1;
		}
		config.questionScore = this.value;
	});

	$('#difficulty-input').on('change', function () {
		if (this.value !== undefined && this.value !== '') {
			if (this.value > 99) {
				this.value = 99;
			}
			if (this.value < 1) {
				this.value = 1;
			}
		} else {
			this.value = 1;
		}
		config.difficultyScore = this.value;
	});

	$('#enumeration-input').on('change', function () {
		config.removeEnumeration = this.checked;
	});
});

function Format() {
	var inputTextarea = $('#plaintextInput');
	var plaintextInput = formatPlainText(inputTextarea.val().split('\n'));
	inputTextarea.val('');
	for (var i = 0; i < plaintextInput.length; i++) {
		inputTextarea.val(inputTextarea.val() + plaintextInput[i] + '\n');
	}
}

function CopyToClipboard() {
	var copyText = document.getElementById("jsonOutput");
	/* Select the text field */
	copyText.select();
	/* Copy the text inside the text field */
	document.execCommand("copy");
}

//https://stackoverflow.com/questions/14129953/how-to-encode-a-string-in-javascript-for-displaying-in-html
//https://stackoverflow.com/questions/9401312/how-to-replace-curly-quotation-marks-in-a-string-using-javascript
/*
function htmlEntities(str) {
	return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u2018\u2019]/g, '&apos;').replace(/[\u201C,\u201D]/g, '&quot');
} */

function htmlEntities(str) {
	return String(str).replace(/\"/g,'\"\"').replace(/\u2018/g, '\'').replace(/\u2019/g, '\'').replace(/\u201C/g, '\"\"').replace(/\u201D/g, '\"\"');
}
