#!/usr/bin/env node

const program = require('commander');
const request = require('request');
const config = require('./config')
var readline = require('readline')
var errorCount = 0;
var rl;
const errorMapper = {
	0: 'Try Again, Enter the Word',
	1: 'Try Again (please enter valid words eg:single, break, start)'
}
var functionCalled;

function makeRequest(method, word, type, cb) {
	if (arguments.length == 2 && typeof word == 'function')
		cb = word;
	request(`${config.APIHost}/${method}?api_key=${config.APIKey}`, {
		json: true
	}, (er, res, body) => {
		if (er || !body) {
			console.log('Try Again Later API Down');
			process.exit(0)
		}
		try {
			return cb(body, word, type)
		} catch (er) {
			console.log('Try Again Later API Down')
			process.exit(0);
		}
	})
}

function callReadLine() {
	rl = readline.createInterface(process.stdin, process.stdout)
		.on('close', function() {
			process.exit(0);
		});
	rl.on('line', function(line) {
		validator(line)
	})
	rl.prompt()
}

function validator(value, type) {
	if (type)
		functionCalled = type
	if (!value || !value.match(/^[A-Za-z]+$/) || value.length == 1) {
		if (!errorMapper[errorCount]) {
			console.log('Sorry, Max. Attempts Reached Try Later')
			return process.exit(0)
		}
		console.log(errorMapper[errorCount])
		if (!rl)
			callReadLine()
		// rl.prompt()
		errorCount++;
	} else {
		errorCount = 0;
		if (rl)
			rl.pause()
		value = value.toString().toLowerCase()
		return functionCalled(value)
	}
}


function parseOutPut(body, word, type) {
	var isfound = false;
	if (!body.error)
		body.forEach(key => {
			if (key.relationshipType == type) {
				isfound = true;
				return console.log(`${type.toUpperCase()} for Word ${word.toUpperCase()} : ${key.words.join()}`);
			}
		})
	if (!isfound)
		return console.log(`${type.toUpperCase()} for Word ${word.toUpperCase()} : Not Found ,try words like single, break, start.`);
}

function formatDef(body, word) {
	console.log(`${'definitions'.toUpperCase()} for Word ${word.toUpperCase()} :`);
	if (body.error || body.length == 0)
		return console.log('Not Found ,try words like single, break, start.')
	body.forEach((key, index) => {
		console.log(`${index+1} : ${key.text}`);
	})
}

function getDefn(word) {
	makeRequest(`word/${word}/definitions`, word, null, formatDef)
}

function getSyn(word) {
	makeRequest(`word/${word}/relatedWords`, word, 'synonym', parseOutPut)
}

function getAnt(word) {
	makeRequest(`word/${word}/relatedWords`, word, 'antonym', parseOutPut)
}

function getEx(word, cb) {
	makeRequest(`word/${word}/examples`, word, null, (body, word) => {
		if (cb)
			cb()
		if (body.error || body.examples.length == 0)
			return console.log(`${'Examples'.toUpperCase()} for Word ${word.toUpperCase()} : Not Found ,try words like single, break, start.`)
		console.log(`${'Examples'.toUpperCase()} for Word ${word.toUpperCase()} :`);
		body.examples.forEach((key, index) => {
			console.log(`${index+1} : ${key.text}`)
		})

	})
}


function playWord() {
	let counter = 1;
	makeRequest(`words/randomWord`, (random) => {
		makeRequest(`word/${random.word}/definitions`, (def) => {
			makeRequest(`word/${random.word}/relatedWords`, (synonyms) => {
				var onlySynonyms = synonyms.filter((key) => {
					return key.relationshipType == 'synonym'
				})
				console.log(` Guess the Word\nDefination : ${def[0].text}\n Synonym : ${onlySynonyms[0].words[0]}`)
				var readLine = readline.createInterface(process.stdin, process.stdout)
					.on('close', function() {
						process.exit(0);
					});
				readLine.on('line', function(line) {
					if (line.toLowerCase() == random.word.toLowerCase()) {
						console.log('Congratulations! Correct Answer')
						process.exit(0)
					}
					counter++;
					if (counter > 2) {
						console.log('Max Attempts Over \nAnswer:' + random.word.toUpperCase());
						formatDef(def, random.word);
						parseOutPut(synonyms, random.word, 'synonym')
						parseOutPut(synonyms, random.word, 'antonym')
						getEx(random.word, () => {
							process.exit(0)
						})
					} else
						console.log(`Wrong Answer!! Guess Again\nDefination : ${def[1].text} \n Synonym : ${onlySynonyms[0].words[1]}`)
				})
				readLine.prompt()
			})
		})
	})
}

function getDetail(word, cb) {
	getDefn(word);
	makeRequest(`word/${word}/relatedWords`, word, null, (body) => {
		parseOutPut(body, word, 'antonym');
		parseOutPut(body, word, 'synonym')
	})
	getEx(word);
}

function callRandomWord() {
	makeRequest(`words/randomWord`, (body) => {
		getDetail(body.word);
	})
}
program
	.option('defn <word>', 'defination', validator, getDefn)
	.option('syn <word>', 'synonyms', validator, getSyn)
	.option('ant <word>', 'antonyms', validator, getAnt)
	.option('ex <word>', 'examples', validator, getEx)
// .option('play','guess work', validator, playWord)
program
	.command("play")
	.action((cmd, er) => {
		playWord()
	})
program
	.command("*")
	.action((cmd, er) => {
		validator(cmd.parent.args[0], getDetail)
	})



// var Methods = ['defn', 'sync', 'ant', 'ex', 'play']
var parsed = program.parse(process.argv);
if (parsed.rawArgs.length == 2 && parsed.args.length == 0) return callRandomWord()