// realtime-editor
//
// client side part
//

function realtimeEditor (options) {
	var that = this,
		random = Math.floor((Math.random() * 100000) + 1),
		div;

	// The .bind method from Prototype.js 
	if (!Function.prototype.bind) { // check if native implementation is not available (it is for ES5+)
		Function.prototype.bind = function () { 
			var fn = this, 
				args = Array.prototype.slice.call(arguments),
				object = args.shift(); 
			
			return function () {
				return fn.apply(object, args.concat(Array.prototype.slice.call(arguments)));
			};
		};
	}

	// required checks
	if (options.id === undefined) {
		console.error('realtimeEditor: textarea id is required');

		return;
	}

	if (options.text === undefined) {
		console.error('realtimeEditor: textarea text array is required');

		return;	
	}

	// temp values
	if (options.author === undefined && sessionStorage.tempRealtimeauthor === undefined) {
		sessionStorage.tempRealtimeauthor = 'user' + random;
	}

	if (options.authorName === undefined && sessionStorage.tempRealtimeAuthorName === undefined) {
		sessionStorage.tempRealtimeAuthorName = 'user' + random;
	}

	if (options.color === undefined && sessionStorage.tempRealtimeColor === undefined) {
		sessionStorage.tempRealtimeColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
	}	

	// set standing variables
	this.author = options.author || sessionStorage.tempRealtimeauthor;
	this.authorName = options.authorName || sessionStorage.tempRealtimeAuthorName;
	this.id = options.id;
	this.text = (options.text.length > 0 ? options.text : this.emptyLine());
	this.color = options.color || sessionStorage.tempRealtimeColor;
	this.lineHeight = options.lineHeight || 20;
	this.editor = document.getElementById(options.id);
	this.projectId = options.projectId || 1;
	this.room = (options.room === undefined ? (options.projectId + '' + options.id) : options.room);
	
	this.message = options.message || 'Connection lost. please wait..';
	this.custom = options.custom || {};
	
	this.update.bind(this);

	if (socket) {
		socket.emit('rtEditorJoin', {room: that.room, targetId: that.id, projectId: that.projectId, text: that.text}, function (res) {
			that.text = res.data;

			that.loadText();
		});

		socket.on('connect', function () {
			socket.emit('rtEditorRejoin', {room: that.room}, function (res) {
				var data = {
					room: that.room,
					targetId: that.id,
					projectId: that.projectId,
					type: 'clearCursor',
					savedLines: that.getLines()
				};

				that.send(data);

				that.editor.style.opacity = 1;
				that.editor.contentEditable = true;

				that.toggleMessage('hide');
			});
		});
		
		if (socket.rtEditorBroadcast === undefined) {
			socket.rtEditorBroadcast = true;
			socket.on('rtEditorBroadcast', function (data) {
				that.update(data);
			});
		}		
		
		if (socket.rtEditorDisconnect === undefined) {
			socket.rtEditorDisconnect = true;
			socket.on('disconnect', function () {				
				that.editor.style.opacity = 0.7;
				that.editor.contentEditable = false;
				that.toggleMessage('show');
			});	
		}
		

	} else {
		console.error('realtimeEditor: socket.io not detected');
	}
}

// show the text
realtimeEditor.prototype.loadText = function () {
	this.editor.addEventListener('focus', this.onFocus.bind(this), false);
	this.editor.addEventListener('blur', this.onBlur.bind(this), false);
	this.editor.addEventListener('click', this.onClick.bind(this), false);
	this.editor.addEventListener('keydown', this.keydown.bind(this), false);
	this.editor.addEventListener('keyup', this.keyup.bind(this), false);
	this.editor.addEventListener('paste', this.paste.bind(this), false);
	
	// check if selected field is not active
	if (document.activeElement.id !== this.editor.id) {
		this.editor.innerHTML = '';

		if (this.text.length > 0) {
			for (var t = 0; t < this.text.length; t++) {
				div = document.createElement('div');

				div.id = this.text[t].id;
				div.innerHTML = this.text[t].text;										
				
				this.editor.appendChild(div);

				this.editor.parentNode.classList.add('is-dirty');
			}
		} else {
			// if existing data array is empty insert default empty lines
			this.insertDefault(this.editor);
		}
	}
};

// create a new empty line
realtimeEditor.prototype.emptyLine = function () {
	return [
		{
			author: this.author,
			text: '<br>',
			id: new Date().getTime() + '_' + Math.floor(Math.random() * (2000000 - 0)) + 0
		}
	];
};

// on focus add active class
realtimeEditor.prototype.onFocus = function (event) {
	event.target.parentNode.classList.add('is-focused');
};

// on blur remove active class
realtimeEditor.prototype.onBlur = function (event) {
	var data = {
		room: this.room,
		color: this.color,
		targetId: this.id,
		projectId: this.projectId,
		type: 'clearCursor',
		author: this.author,
		savedLines: this.getLines()
	};

	event.target.parentNode.classList.remove('is-focused');
	
	this.send(data);
};

// on click
realtimeEditor.prototype.onClick = function (event) {
	var data = {
		room: this.room,
		color: this.color,
		targetId: this.id,
		projectId: this.projectId,
		type: 'moveCursor',
		author: this.author,
		authorName: this.authorName,
		savedLines: this.getLines(),
		caretPos: this.getCaret()
	};

	if (data.caretPos.activeLine.tagName === 'DIV') {
		this.send(data);	
	}	
};

// get caret line index and offset
realtimeEditor.prototype.getCaret = function (event) {
	var selection = window.getSelection(),
		caret = {};

	if (selection.anchorNode !== null) {
		if (selection.anchorNode.nodeType === 1) {
			caret.activeLine = selection.anchorNode;
		} else {
			caret.activeLine = selection.anchorNode.parentNode;
		}

		caret.activeLineId = caret.activeLine.id;
		caret.offset = selection.anchorOffset;
		caret.lineIndex = [].indexOf.call(caret.activeLine.parentNode.children, caret.activeLine);
	}

	return caret;
};

// Paste
realtimeEditor.prototype.paste = function (event) {
	var pasteLine = event.target,
		textarea = pasteLine.parentNode,
		selection = window.getSelection(),
		range = document.createRange(),
		pasteLineText = pasteLine.innerHTML,
		caretOffset = selection.getRangeAt(0).startOffset,
		pastedLines = event.clipboardData.getData('text/plain').split('\n'),
		div,
		previousLine,
		timeId;

	event.preventDefault();

	pasteLineText = pasteLine.innerHTML;

	for (var p = 0; p < pastedLines.length; p++) {
		// special stuff for first pasted line
		if (p === 0) {

			// add remaining of line one if only one line was pasted in
			if (pastedLines.length === 1) {
				pasteLine.innerHTML = pasteLineText.substr(0, caretOffset) + pastedLines[p] + pasteLineText.substr(caretOffset);
			} else {
				pasteLine.innerHTML = pasteLineText.substr(0, caretOffset) + pastedLines[p];
			}

			previousLine = pasteLine;
		} else {
			div = document.createElement('div');
			timeId = new Date().getTime() + '_' + Math.floor(Math.random() * (2000000 - 0)) + 0;

			div.id = timeId;
			div.innerHTML = (p === (pastedLines.length - 1) ? pastedLines[p] + pasteLineText.substr(caretOffset) : pastedLines[p]);

			textarea.insertBefore(div, previousLine.nextSibling);

			previousLine = div;
		}

		this.newLines.push({
			id: (p === 0 ? pasteLine.id : timeId),
			text: previousLine.innerHTML.replace(/<\/?[^>]+(>|$)/g, ''),
			author: sessionStorage.uniId || ''
		});

		// place caret when last inserted row
		if (p === (pastedLines.length - 1)) {
			//console.log('place the damn caret', caretOffset);
			previousLine.focus();

			// if only one line was pasted add the caretOffset
			if (pastedLines.length === 1) {
				selection.collapse(previousLine.childNodes[0], (caretOffset + pastedLines[pastedLines.length - 1].length));
			} else {
				selection.collapse(previousLine.childNodes[0], pastedLines[pastedLines.length - 1].length);	
			}

			//range.setStart(previousLine, 0);
			//range.collapse(true);
		}
	}

	this.clipboardData = {
		pasteLine: pasteLine.id,
		indexLine: [].indexOf.call(pasteLine.parentNode.children, pasteLine),
		lines: event.clipboardData.getData('text/plain').split('\n')
	};
};


// default tree empty lines
realtimeEditor.prototype.insertDefault = function (target) {
	var div;

	target.innerHTML = '';

	for (var p = 0; p < 1; p++) {
		div = document.createElement('div');

		div.id = new Date().getTime() + '_' + Math.floor(Math.random() * (2000000 - 0)) + 0;
		div.innerHTML = '<br>';

		target.appendChild(div);								
	}
};

// Handle keydown
realtimeEditor.prototype.keydown = function (event) {
	var textarea = event.target,
		timeId = new Date().getTime() + '_' + Math.floor(Math.random() * (2000000 - 0)) + 0,
		lines = textarea.getElementsByTagName('div'),
		div = document.createElement('div'),
		selection = window.getSelection(),
		activeLine;

	// reset paste boolean
	this.clipboardData = {};
	this.newLines = [];

	if (event.ctrlKey) {
		if (event.keyCode == 90) { // undo
			event.preventDefault();
			
			console.log('undo - not implemented yet');
			return;
		} else if (event.keyCode == 89) { // redo
			event.preventDefault();
			
			console.log('redo - not implemented yet');
			return;
		}
	}

	if (event.keyCode === 13) {
		// only adapt if Firefox on enter
		if (window.navigator.userAgent.indexOf('Firefox') > -1 || window.navigator.userAgent.indexOf('Edge') > -1) {
			if (selection.anchorNode.nodeType === 1) {
				activeLine = selection.anchorNode;
			} else {
				activeLine = selection.anchorNode.parentNode;
			}

			event.preventDefault();

			div.id = timeId;				

			activeLine.parentNode.insertBefore(div, activeLine.nextSibling);
			
			div.focus();

			selection.collapse(div, 0);
		}	
	}

	this.storedLines = [];

	for (var l = 0; l < lines.length; l++) {
		this.storedLines.push(lines[l].id);
	}
};

// Handle keyup
realtimeEditor.prototype.keyup = function (event) {
	if (event.keyCode === 16 || event.keyCode === 17 || event.keyCode === 18) { // prevent shift, ctrl & alt default
		return false;
	}

	var textarea = event.target,
		lines = textarea.getElementsByTagName('div'),
		selection = window.getSelection(),
		range = selection.getRangeAt(0),
		timeId = new Date().getTime() + '_' + Math.floor(Math.random() * (2000000 - 0)) + 0,
		deletedLines = [],
		newLines = [],
		savedLines = [],
		newLineCounter = 0,
		data,
		currentIndex,
		previousLine,
		activeLine,
		type,
		lineExist;

	// check deleted lines
	if (lines.length < this.storedLines.length) {
		for (var s = 0; s < this.storedLines.length; s++) {
			lineExist = false;

			for (l = 0; l < lines.length; l++) {
				if (lines[l].id === this.storedLines[s]) {
					lineExist = true;
				}
			}

			if (lineExist === false) {
				deletedLines.push(this.storedLines[s]);
			}
		}
	}
	
	// get active line based on caret position
	
	if (window.getSelection().anchorNode.nodeType === 1) {
		activeLine = window.getSelection().anchorNode;
	} else {
		activeLine = window.getSelection().anchorNode.parentNode;
	}

	if (event.keyCode === 13) { // if enter
		if (activeLine.innerHTML === '<br>') {
			type = 'newLine';
		} else {
			type = 'breakLine';

			if (activeLine.innerHTML === '') {
				activeLine.innerHTML = '<br>';
			}
		}

		if (textarea.parentNode.classList.contains('is-dirty') === false) {
			textarea.parentNode.classList.add('is-dirty');	
		}
	} else if (event.keyCode === 37 || event.keyCode === 38 || event.keyCode === 39 || event.keyCode === 40) { // if arrows
		type = 'moveCursor';
		timeId = activeLine.id;
	} else {
		type = 'modifyLine';
		timeId = activeLine.id;

		if (textarea.parentNode.classList.contains('is-dirty') === false) {
			textarea.parentNode.classList.add('is-dirty');	
		}
	}
	
	currentIndex = [].indexOf.call(activeLine.parentNode.children, activeLine);
	previousLine = activeLine.previousSibling;

	if (currentIndex === 0) {
		previousLineId = 'firstLine';
	} else {
		previousLineId = previousLine.id;					
	}

	activeLine.id = timeId;

	// Check and handle paste content
	if (this.clipboardData.lines !== undefined) {
		if (this.clipboardData.lines.length > 0) {
			type = 'pastedContent';
			
			//console.log('clipboardData', this.clipboardData);
		}
	}	

	for (var l = 0; l < lines.length; l++) {
		savedLines.push({
			id: lines[l].id,
			text: lines[l].innerHTML,
			author: ''
		});
	}

	//console.log('savedLines', savedLines);

	data = {
		room: this.room,
		color: this.color,
		targetId: textarea.id,
		projectId: this.projectId,
		activeLineId: timeId,
		activeLineText: (activeLine.innerHTML === '<br>' ? '<br>' : activeLine.innerHTML.replace(/<\/?[^>]+(>|$)/g, '')),
		previousLineId: previousLineId,
		previousLineText: (type === 'breakLine' ? previousLine.innerHTML.replace(/<\/?[^>]+(>|$)/g, '') : undefined),
		type: type,
		author: this.author,
		indexLine: [].indexOf.call(activeLine.parentNode.children, activeLine),
		savedLines: savedLines,
		linesAmount: lines.length,
		deletedLines: deletedLines,
		newLines: this.newLines,
		caretPos: this.getCaret(),
		custom: this.custom
	};

	this.send(data);
};

realtimeEditor.prototype.deletedLines = function (data) {
	var textarea = document.getElementById(data.targetId),
		line;

	for (var i = data.deletedLines.length - 1; i >= 0; i--) {
		line = document.getElementById(data.deletedLines[i]);

		textarea.removeChild(line);
	}
};

// send
realtimeEditor.prototype.send = function (data) {
	socket.emit('rtEditorSync', data, function (res) {
		//console.log('realtimeEditor res: ', res);
	});
};

// Patch & Update specific editor with changes
realtimeEditor.prototype.update = function (data) {
	var target = document.getElementById(data.targetId),
		line = document.getElementById(data.activeLineId),
		dmp = new diff_match_patch(),
		loopedLine,
		previousLine,
		currentText,
		div,
		diff, 
		patchText, 
		resultText,
		data,
		currentTextIndex,
		previousLineIndex;

	if (target !== null) {
		/*for (var l = 0; l < this.text.length; l++) {
			line = this.text[l];
			
			// find line to patch
			if (line.id === data.activeLineId) {
				currentText = line.text;
				currentTextIndex = l;
				//console.log('found currentText to patch', data.activeLineText);
			}

			// find previous line if any
			if (line.id === data.previousLineId) {
				previousLine = line.text;
				previousLineIndex = l;

				//console.log('found previousLine to fix', data.previousLineText);
			}
		}*/

		if (data.type === 'modifyLine') { // patch existing line
			currentText = line.innerHTML;

			diff = dmp.diff_main(currentText, data.activeLineText);
			patchText = dmp.patch_make(currentText, data.activeLineText, diff);
			resultText = dmp.patch_apply(patchText, currentText);

			line.innerHTML = resultText[0];

			// data object
			//this.text[currentTextIndex].text = resultText[0];
			//this.text[currentTextIndex].author = data.author;
		} else if (data.type === 'newLine') { // add new line
			previousLine = document.getElementById(data.previousLineId);
			div = document.createElement('div');
			div.id = data.activeLineId;
			div.innerHTML = data.activeLineText;

			target.insertBefore(div, previousLine.nextSibling);

			// data object
			
		} else if (data.type === 'breakLine') {
			previousLine = document.getElementById(data.previousLineId);
			div = document.createElement('div');
			div.id = data.activeLineId;
			div.innerHTML = data.activeLineText;

			target.insertBefore(div, previousLine.nextSibling);

			diff = dmp.diff_main(previousLine.innerHTML, data.previousLineText);
			patchText = dmp.patch_make(previousLine.innerHTML, data.previousLineText, diff);
			resultText = dmp.patch_apply(patchText, previousLine.innerHTML);

			previousLine.innerHTML = (resultText[0] === '' ? '<br>' : resultText[0]);
		} else if (data.type === 'pastedContent') {
			for (var n = 0; n < data.newLines.length; n++) {
				if (n === 0) {
					loopedLine = document.getElementById(data.newLines[n].id);

					// diff & patch first line of content
					diff = dmp.diff_main(loopedLine.innerHTML, data.newLines[n].text);
					patchText = dmp.patch_make(loopedLine.innerHTML, data.newLines[n].text, diff);
					resultText = dmp.patch_apply(patchText, loopedLine.innerHTML);
					
					loopedLine.innerHTML = resultText[0];

					previousLine = loopedLine;
				} else {
					div = document.createElement('div');
					div.id = data.newLines[n].id;
					div.innerHTML = data.newLines[n].text;

					target.insertBefore(div, previousLine.nextSibling);

					previousLine = div;
				}
			}
		}


		// Handle deleted lines
		if (data.deletedLines) {
			if (data.deletedLines.length > 0) {
				this.deletedLines(data);
			}
		}


		// move the recived data's user cursor
		if (data.type === 'clearCursor') {
			this.clearCursor(data);	
		} else {
			if (document.getElementById(data.caretPos.activeLineId) !== null) {
				this.moveCursor(data);
			}
		}

		// move the client user cursor
		// only when data.type !== moveCursor to avoid infinite broadcast loop
		if (data.type !== 'moveCursor') {
			data = {
				room: this.room,
				color: this.color,
				targetId: this.id,
				projectId: this.projectId,
				type: 'moveCursor',
				author: this.author,
				savedLines: this.getLines(),
				caretPos: this.getCaret()
			};

			if (data.caretPos.activeLine !== undefined) {
				this.send(data);
			}
		}
	}	
};

realtimeEditor.prototype.getLines = function (data) {
	var lines = this.editor.getElementsByTagName('div'),
		savedLines = [];

	for (var l = 0; l < lines.length; l++) {
		savedLines.push({
			id: lines[l].id,
			text: lines[l].innerHTML,
			author: ''
		});
	}

	return savedLines;
};

// move cursor
// data properties required author, caretPos
realtimeEditor.prototype.moveCursor = function (data) {
	var user = document.getElementById(data.author),
		target = document.getElementById(data.targetId),
		offsetText = data.savedLines[data.caretPos.lineIndex].text.substr(0, data.caretPos.offset),	
		computedStyles = window.getComputedStyle(document.getElementById(data.caretPos.activeLineId), null),
		font = computedStyles.getPropertyValue('font-weight') + ' ' + computedStyles.getPropertyValue('font-size') + ' ' + computedStyles.getPropertyValue('font-family'),
		name;

	if (user === null && target !== null) {		
		user = document.createElement('span');
		name = document.createElement('span');

		user.id = data.author;
		user.className = 'realtimeEditorUser';
		user.style.cssText = 'position: absolute; background-color: ' + data.color + '; width: 2px; height: 20px; top: 0; left: 0;';
		user.style.top = (data.caretPos.lineIndex * this.lineHeight) + 'px';
		user.style.left = this.getTextWidth(offsetText, font) + 'px';
		user.contentEditable = false;

		name.style.cssText = 'position: absolute; opacity: 0; transition: 0.2s ease; visibility: hidden; min-width: ' + (this.getTextWidth(data.authorName, 'normal 10px Roboto, Helvetica, Arial') + 5) + 'px; z-index: 1; font-size: 10px; background-color: ' + data.color + '; color: #FFF !important; height: 15px; line-height: 15px; padding-left: 5px; bottom: 20px';
		name.innerHTML = data.authorName;

		user.appendChild(name);
		target.appendChild(user);

		user.addEventListener('mouseenter', this.showName, false);
		user.addEventListener('mouseleave', this.hideName, false);
	} else {
		user.style.top = (data.caretPos.lineIndex * this.lineHeight) + 'px';
		user.style.left = this.getTextWidth(offsetText, font) + 'px';
	}
};

// get the width of the text to calculate in pixel the caret position
realtimeEditor.prototype.getTextWidth = function (text, font) {
	var canvas = this.getTextWidth.canvas || (this.getTextWidth.canvas = document.createElement("canvas")), // re-use canvas object for better performance
		context = canvas.getContext("2d"),
		metrics;
	
	context.font = font;
	
	metrics = context.measureText(text);
	
	return Math.floor(metrics.width);
};

// remove the user color node
realtimeEditor.prototype.clearCursor = function (data) {
	var user = document.getElementById(data.author);

	if (user !== null) {
		user.parentNode.removeChild(user);
	}
};

// show caret user name
realtimeEditor.prototype.showName = function (event) {
	var name = this.getElementsByTagName('span')[0];
	
	name.style.opacity = 1;
	name.style.visibility = 'visible';
};

realtimeEditor.prototype.hideName = function (event) {
	var name = this.getElementsByTagName('span')[0];
	
	name.style.opacity = 0;
	name.style.visibility = 'hidden';	
};

// toggle message upon disconnect
realtimeEditor.prototype.toggleMessage = function (action) {
	var message = document.getElementById('rtEditor_' + this.id),
		div;

	if (message === null) {
		div = document.createElement('div');

		div.id = 'rtEditor_' + this.id;
		div.style.font = 'italic 14px Roboto, Helvetica, Arial';
		div.innerHTML = this.message;
	}

	if (action === 'show') {
		this.editor.parentNode.appendChild(div);
	} else {
		if (message !== null) {
			message.parentNode.removeChild(message);
		}		
	}
};

realtimeEditor.prototype.exit = function (room, callback) {
	if (socket) {
		socket.emit('rtEditorExit', {room: room}, function (res) {
			if (callback !== undefined) {
				callback(res);
			}
		});
	} else {
		console.error('realtimeEditor: cant leave room, socket.io not detected');
	}
};