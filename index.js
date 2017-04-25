// realtime-editor
//
// server side part
//

var emitter = require('events'),
	//io = require('socket.io')(http),
	diffMatchPatch = require('diff-match-patch'),
	dmp = new diffMatchPatch();	


function realtimeEditor (parameters, custom) {
	this.emitter = new emitter();

	this.options = parameters || {};
	this.textarea = {};

	this.init();	
}


// init the socket.io connection to coEditor
realtimeEditor.prototype.init = function () {
	var that = this;

	io.sockets.on('connection', function (socket) {

		socket.on('rtEditorSync', function (data, callback) {
			that.syncText(data, function (res) {
				socket.broadcast.to(data.room).emit('rtEditorBroadcast', res);
			});
		});

		socket.on('rtEditorJoin', function (data, callback) {
			socket.rtEditor = {
				room: data.room
			};
			
			socket.join(data.room, function () {
				// check if there is a data object allready
				
				/*if (that.textarea[data.projectId] !== undefined) {
					if (that.textarea[data.projectId][data.targetId] !== undefined) {

						data.text = that.textarea[data.projectId][data.targetId].data;
					}
				}*/

				//console.log('join room:', data.room);


				if (that.textarea[data.projectId] === undefined) {					
					that.textarea[data.projectId] = {
						projectId: data.projectId
					};
				}

				if (that.textarea[data.projectId][data.targetId] === undefined) {					
					that.textarea[data.projectId][data.targetId] = {
						targetId: data.targetId,
						data: data.text,
						timeout: 0
					};				
				}

				if (callback !== undefined) {
					callback({mesage: 'done joining the room: ' + data.room, data: that.textarea[data.projectId][data.targetId].data});
				}				
			});
		});

		socket.on('rtEditorRejoin', function (data, callback) {
			socket.join(data.room, function () {
				if (callback !== undefined) {
					callback({mesage: 'done rejoining the room: ' + data.room, data: data});
				}
			});
		});

		socket.on('rtEditorExit', function (data, callback) {
			socket.leave(data.room, function () {
				if (callback !== undefined) {
					callback({mesage: 'done leaving room: ' + data.room, data: data});
				}
			});
		});

		socket.on('disconnect', function () {
			/*console.log('on plugin disconnect', socket.rtEditor);

			for (var editor in socket.rtEditor) {
				console.log('clear cursor from this:', socket.rtEditor[editor]);

				socket.broadcast.to(data.room).emit('rtEditorBroadcast', {});
			}*/			
		});

	});
};


// emit back to parameter callback
realtimeEditor.prototype.emit = function (name, data) {
	if (this.options[name] !== undefined) {
		this.options[name](data);
	}
};

// sync the text to the server object
realtimeEditor.prototype.syncText = function (data, callback) {
	//console.log('syncText', data);
	
	var line, previousLine, currentText, currentTextIndex, previousLineIndex, loopedLine,
		diff, patchText, resultText,
		that = this;
	
	//console.log('data', data);

	if (this.textarea[data.projectId] === undefined) {
		this.textarea[data.projectId] = {
			projectId: data.projectId
		};
	}

	if (this.textarea[data.projectId][data.targetId] === undefined) {
		// create object if first time and save all current lines
		this.textarea[data.projectId][data.targetId] = {
			targetId: data.targetId,
			data: data.savedLines
		};
	}

	// patch changes only and save all current lines after patch
	//console.log('patch');

	for (var l = 0; l < this.textarea[data.projectId][data.targetId].data.length; l++) {
		line = this.textarea[data.projectId][data.targetId].data[l];
		
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
	}
	
	if (data.type === 'modifyLine') { // patch existing line
		diff = dmp.diff_main(currentText, data.activeLineText);
		patchText = dmp.patch_make(currentText, data.activeLineText, diff);
		resultText = dmp.patch_apply(patchText, currentText);

		this.textarea[data.projectId][data.targetId].data[currentTextIndex].text = resultText[0];
		this.textarea[data.projectId][data.targetId].data[currentTextIndex].author = data.author;
	} else if (data.type === 'newLine') { // add new line
		if (previousLineIndex === (this.textarea[data.projectId][data.targetId].data.length - 1)) {
			// if last line append
			this.textarea[data.projectId][data.targetId].data.push({
				id: data.activeLineId,
				text: data.activeLineText,
				author: data.author
			});
		} else {
			// if not last line insertBefore
			this.textarea[data.projectId][data.targetId].data.splice(previousLineIndex + 1, 0, {
				id: data.activeLineId,
				text: data.activeLineText,
				author: data.author
			});
		}
	} else if (data.type === 'breakLine') {
		if (previousLineIndex === (this.textarea[data.projectId][data.targetId].data.length - 1)) {
			// if last line append
			this.textarea[data.projectId][data.targetId].data.push({
				id: data.activeLineId,
				text: data.activeLineText,
				author: data.author
			});
		} else {
			// if not last line insertBefore
			this.textarea[data.projectId][data.targetId].data.splice(previousLineIndex + 1, 0, {
				id: data.activeLineId,
				text: data.activeLineText,
				author: data.author
			});
		}
		

		diff = dmp.diff_main(previousLine, data.previousLineText);
		patchText = dmp.patch_make(previousLine, data.previousLineText, diff);
		resultText = dmp.patch_apply(patchText, previousLine);

		this.textarea[data.projectId][data.targetId].data[previousLineIndex].text = (resultText[0] === '' ? '<br>' : resultText[0]);
	} else if (data.type === 'pastedContent') {
		for (var n = 0; n < data.newLines.length; n++) {
			if (n === 0) {
				// if first line

				for (var d = 0; d < this.textarea[data.projectId][data.targetId].data.length; d++) {
					loopedLine = this.textarea[data.projectId][data.targetId].data[d];

					if (loopedLine.id === data.newLines[n].id) {

						diff = dmp.diff_main(loopedLine.text, data.newLines[n].text);
						patchText = dmp.patch_make(loopedLine.text, data.newLines[n].text, diff);
						resultText = dmp.patch_apply(patchText, loopedLine.text);

						loopedLine.text = resultText[0];

						previousLine = d;
					}
				}

				// diff & patch first line of content
				
			} else {
				this.textarea[data.projectId][data.targetId].data.splice((previousLine + 1), 0, {
					id: data.newLines[n].id,
					text: data.newLines[n].text,
					author: data.newLines[n].author,
				});

				previousLine = n;
			}

		}

	}


	// Handle deleted lines
	if (data.deletedLines !== undefined) {
		if (data.deletedLines.length > 0) {
			for (var l = 0; l < data.deletedLines.length; l++) {
				for (var d = this.textarea[data.projectId][data.targetId].data.length - 1; d >= 0; d--) {
					if (this.textarea[data.projectId][data.targetId].data[d].id === data.deletedLines[l]) {
						this.textarea[data.projectId][data.targetId].data.splice(d, 1);
					}
				}
			}
		}	
	}
	
	

	//console.log('data', this.textarea[data.projectId][data.targetId]);

	/*if (callback !== undefined) {
		callback(this.textarea[data.projectId]);
	}*/
	

	// server demo test	
	//var diff = dmp.diff_main(serverText, 'h1 elo');
	//var patch_list = dmp.patch_make(serverText, 'h1 elo', diff);
	//var result = dmp.patch_apply(patch_list, serverText);

	//console.log('sync text', this.options);


	// callbacks
	callback(data);

	if (data.type !== 'clearCursor' && data.type !== 'moveCursor') {
		clearTimeout(this.textarea[data.projectId][data.targetId].timeout);
		
		// timeout to avoid db spam
		this.textarea[data.projectId][data.targetId].timeout = setTimeout(function () {
			that.emitter.emit('onSave', data);
		}, 700);
	}	
};



realtimeEditor.prototype.onSave = function (callback) {
	this.emitter.on('onSave', function (data) {

		// emit specific information parts
		// add more properties from the data object if needed here
		var savedData = {
			targetId: data.targetId,
			author: data.author,
			text: data.savedLines,
			custom: data.custom
		};

		callback(savedData);
	});
	
};

module.exports = new realtimeEditor;