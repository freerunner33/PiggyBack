// SETUP
var onfleet = require('./onfleet.js')
var yelp = require('./yelp.js')
var timezone = require('./timezone.js')
var connection = require('./database.js')
var keys = require('./keys.js')

var signupKey = keys.signupKey
var yelpUser = keys.yelpUser
var yelpPass = keys.yelpPass

var path = require('path')
var express = require('express')
var app = express()
var http = require('http').Server(app)
var validator = require('validator')
var bcrypt = require('bcrypt')
var uuid = require('node-uuid')
var session = require('express-session')
var authorization = require('auth-header')
var mime = require('mime')
const fs = require('fs')

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')

var bodyParser = require('body-parser')
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))
app.use(session(
	{
		genid: function(request) {
			return uuid.v4()
		},
		secret: 'keyboard cat',
		resave: false,
		saveUninitialized: false
	}
))


app.get('/', function(request, response) {
	response.render('index', {pageTitle: 'Home'})
})

http.listen(8081, '127.0.0.1', function() {
	console.log('----------------listening on port 8081')
})
