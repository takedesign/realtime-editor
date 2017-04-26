# realtime-editor
Ever had the same feeling as us about how complicated and soul-crushing it can be to implement some sort of a collaborative editor? ..Even a simple one?

If Etherpad are either too big or too much of what you need and shareJS doesnt fit your application (as ours don't since we build upon [socket.io](https://www.npmjs.com/package/socket.io) this plugin might be what you're looking for.

Here at [T.A.K.E.](http://takedesign.dk/) we have made a very simple "textarea" where the only needs required were to have it be on some sort of collaborative level while not requiring insane amount of server configuration nor external/extra db logic.


This realtime-editor is a lightweight node module with a server and client side script. It uses [socket.io](https://www.npmjs.com/package/socket.io) and [diff-match-patch](https://code.google.com/p/google-diff-match-patch/). It doesnt solve all the collaborative problems or needs but if it fits your needs go ahead and give it a try.


NOTE: Before we begin, this is a really early beta version and is quite unstable.. more updates and documentations is on its way..


Setup
--------
Npm install the sucker and include it to your server index.js

```js
npm install realtime-editor
```
```js
var realtimeEditor = require('realtime-editor');
```

Add the client part aswell to your application's index.html

```html
<script src="node_modules/realtime-editor/realtime-editor.js"></script>
```

And dont forget the 2 dependencies socket.io and diff-match-patch client parts aswell if you dont have them included allready

```html
<script src="node_modules/socket.io-client/dist/socket.io.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/diff_match_patch/20121119/diff_match_patch.js"></script>
```


Usage
--------

It's currently build around MDL-Lite's material design framework but it should work without it (Dont blame us if doesnt!).

For the MDL styles check the example in the demo folder. For now, here is the bare one. Feel free to include your own styles and a label tag inside the div wrapper at the bottom

```html
<div style="position: relative;">
	<div id="textarea1" ondragstart="return false" contenteditable="true" spellcheck="false">
		<div><br></div>
	</div>
</div>
```

Now init socket.io client part and the the textarea through javascript

```js
var socket = io.connect();

var editor = new realtimeEditor(options);
```

The options argument needs atleast the id of the text field aswell as an unique identifier fx a project id.
It takes several others optional parameters such as an user color.

The text property consist of an array with an object for each line created in it. The array can either start empty or with some data (fx. stored from your database).
The format of the objects inside the text array needs to have the properties as shown below, alltho they are auto generated when new lines are created, but make sure you save the whole text array when storing it to your database.

```js
var options = {
	id: 'textarea1', // unique to the textfield
	projectId: 'someUniqueIdentifier', // required in order to have several active editors on the same page
	room: 'uniqueTextRoom', // unique room id, default is projectId combined with the element id
	text: [ // init the textarea with the newest text
		{
			author: '',
			text: 'line_1',
			id: '1459856606818_16407750' // id of the line auto generated.
		},
		{
			author: '',
			text: 'line_2',
			id: '1459865117436_19682870'
		},
		{
			author: '',
			text: 'line_3',
			id: '1459865208855_19888940'
		}
	],
	custom: { // custom object such as specific appication IDs. Fx in order to save it on the server side
		appId: 1,
		customProperty: 'some_application_specific_here'
	}
};

new realtimeEditor(options);
```


Options
--------

| Parameter		| Type		| Default		| Description															|
| ------------- | --------- | ------------- | --------------------------------------------------------------------- |
| id 			| string	| undefined		| The id of the textarea. Is requried 	|
| projectId 	| integer 	| 1 			| Will be renamed at some point. is required in order to have multiple editors on same page		|
| room 			| string	| projectId + id| Room name for socket.io. Make sure its unqiue in order to avoid conflicts. Default is the id of the textarea 	|
| color 		| string	| random		| Set a user color as such #1d1d1d 	|
| author 		| string	| random		| Set an id of the user. make sure its unique and no spaces 	|
| authorName	| string	| random		| Set name of author. random name is generated if none applied. Not complete 	|
| message 		| string	| Connection lost. please wait.. | Message will be desplayed below when socket connection is lost. Change it here to fit your language 	|
| custom 		| object	| {}			| This is where you add your applications specific properties incase you want to do something with the data like save it to your own db in a hook 	|


Hooks
--------

On your server side you can add a hook which will fire when something changes


```js
var editor = new realtimeEditor(options);

realtimeEditor.onSave(function (data) {
	// do something with the data object here like stringify it and save it to your fauvorite db
});
```


Demo
--------

A demo is included. Check it out by cloning the demo folder, go into it and run ```npm install``` followed by a ```node demo.js```
Open your browser and go to http://localhost:2000 to see the example


Todo
--------
* Atm you cant write on same line as it updates the text per line
* More stable version aka. better server testing / fallback
* Undo/redo availability (keyboard shortcuts)
* More test!
* Author text string on an individual line is not getting set correctly atm
* Gif demo example.. gotta have those animated gifs!
* maybe include text styling in the long run like a WYSIWYG editor
* did I mention test?


Keep making it better
--------
Feel free to donate in order to help us out.
Any amount will be greatly appreciated, for the many hours invested into this, aswell as in future developement.

[![paypal](https://www.paypalobjects.com/en_US/DK/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=WBXRF3VJD2MJY)
