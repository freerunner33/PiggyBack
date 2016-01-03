
var onfleet = require('./onfleet.js')
var connection = require('./database.js')

var path = require('path')
var validator = require('validator')
var bcrypt = require('bcrypt')
var express = require('express')
var app = express()
var http = require('http').Server(app)

var bodyParser = require('body-parser')
app.use( bodyParser.json() );
app.use(bodyParser.urlencoded({
  extended: false
}));

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')

// Main GET request listener
app.get('/PiggyBack', function(request, response) {
	onfleet.getSingleTeamByName('TEST').then(function(team) {
		onfleet.getOrganizationDetails().then(function(org) {
			onfleet.getDestinationByID('IWU6PFSVyLhAbifvh3KnDxnZ').then(function(destination) {
				onfleet.listTasks().then(function(tasks) {
					onfleet.listWebHooks().then(function(webhooks) {
						response.render(
							'index', {
								pageTitle: 'NOAH', 
								orgName: org.name, 
								orgID: org.id,
								orgEmail: org.email,
								teamName: team.name,
								teamID: team.id, 
								teamWorkers: team.workers,
								destination: destination,
								tasks: tasks,
								webhooks: webhooks
							}
						)
					})
				})
			})
		})
	})
})


// POST request listener for a call to create a new worker
app.post('/PiggyBack/new-worker', function(request, response) {
	if (!request.body.name || !request.body.number)
		response.redirect('/')
	else {
		onfleet.createNewWorker(
			request.body.name,
			request.body.number.replace(/[^0-9\+]/, ''),
			['ylC5klVbtmEVrVlBfUYp9oeM'], 
			{
				type: 'CAR', 
				description: 'Lamborghini', 
				licensePlate: '333-ABC', 
				color: 'black'
			}
		).then(function(worker) {
			response.redirect('/PiggyBack/')
		}).catch(function(error) {
			response.render('error', {pageTitle: 'Error', error: JSON.stringify(error)})
		})
	}
})

// POST request listener for a call to delete a worker
	// need to pass in worker's id
app.post('/PiggyBack/delete-worker', function(request, response) {
	if (!request.body.id)
		response.redirect('/PiggyBack/')
	else {
		onfleet.deleteWorkerByID(request.body.id).then(function() {
			response.redirect('/PiggyBack/')
		}).catch(function(error) {
			response.render('error', {pageTitle: 'Error', error: JSON.stringify(error)})
		})
	}
})

// POST request listener for a call to update a worker
	// need to pass in worker's id and probably more
app.post('/PiggyBack/update-worker', function(request, response) {
	if (!(request.body.id && request.body.name))
		response.redirect('/PiggyBack/')
	else {
		onfleet.updateWorkerByID(request.body.id, {name: request.body.name}).then(function() {
			response.redirect('/PiggyBack/')
		}).catch(function(error) {
			response.render('error', {pageTitle: 'Error', error: JSON.stringify(error)})
		})
	}
})

app.post('/PiggyBack/new-destination', function(request, response) {
	if (!(request.body.number && request.body.street && request.body.city && request.body.country))
		response.redirect('/PiggyBack/')
	else {
		onfleet.createNewDestination(
			{
				name: request.body.name,
				number: request.body.number,
				street: request.body.street,
				apartment: request.body.apartment,
				city: request.body.city,
				state: request.body.state,
				postalCode: request.body.postalCode,
				country: request.body.country
			}
		).then(function(destination) {
			console.log(JSON.stringify(destination))
			response.redirect('/PiggyBack/')
		}).catch(function(error) {
			response.render('error', {pageTitle: 'Error', error: JSON.stringify(error)})
		})
	}
})

app.get('/PiggyBack/signup', function(request, response) {
	response.render('signup', {pageTitle: 'Sign up'})
})

app.post('/PiggyBack/signup', function(request, response) {
	var username = request.body.username
	var firstname = request.body.firstname
	var lastname = request.body.lastname
	var phone = request.body.phone
	var password = request.body.password
	var password2 = request.body.password2

	if (!(username && firstname && lastname && phone && password && password2)) {
		response.render('signup', {pageTitle: 'Sign up', errors: ['All fields must be completed'], username: username, firstname: firstname, lastname: lastname, phone: phone})
		return
	}
	errors = []
	if (!validator.isAlphanumeric(username))
		errors.push('Username must contain only letters and numbers')
	if (!validator.isAlpha(firstname))
		errors.push('First Name must contain only letters')
	if (!validator.isAlpha(lastname))
		errors.push('Last Name must contain only letters')
	if (!(phone.length == 12 && phone.charAt(3) == '-' && phone.charAt(7) == '-' && validator.isInt(phone.substring(0, 3) + phone.substring(4, 7) + phone.substring(8))))
		errors.push('Phone Number must be of the form 123-456-7890')
	if (password.length < 6)
		errors.push('Password length must be at least 6')
	if (!validator.isAscii(password))
		errors.push('Password contains invalid characters')
	if (password.localeCompare(password2) != 0)
		errors.push('Passwords must match')
	if (errors.length) {
		response.render('signup', {pageTitle: 'Sign up', errors: errors, username: username, firstname: firstname, lastname: lastname, phone: phone})
		return
	}

	//response.render('success', {pageTitle: 'Success'})
	connection.query('SELECT id FROM users WHERE username=?', [username], function(error, rows) {
		if (error) 
			throw error
		if (rows.length) {
			response.render('signup', {pageTitle: 'Sign up', errors: ['Username already taken'], username: username, firstname: firstname, lastname: lastname, phone: phone})
			return
		}
		bcrypt.hash(password, 8, function(error, hash) {
			if (error)
				throw error
			connection.query('INSERT INTO Users (username, firstname, lastname, password, phone) VALUES (?,?,?,?,?)',
				[username, firstname, lastname, hash, phone], function(error, rows) {
					if (error)
						throw error
					response.render('success', {pageTitle: 'Success'})
				})
		})
	})
})

http.listen(8080, '127.0.0.1', function() {
	console.log('listening on port 8080')
})
