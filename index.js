// Require the onfleet api, and the database js file
var onfleet = require('./onfleet.js')
var connection = require('./database.js')
var signUpKey = require('./keys.js').signUpKey
var yelpPass = require('./keys.js').yelpPass

// npm modules that are required in
var path = require('path')
var express = require('express')
var app = express()
var http = require('http').Server(app)
var validator = require('validator')
var bcrypt = require('bcrypt')
var uuid = require('node-uuid')
var authorization = require('auth-header')

// Used for session variables
var session = require('express-session')

// For use with file input and output
var multer  = require('multer')
// var upload = multer({ dest: 'assets/uploads/' })

// For rendering the pages in the views folder
app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'jade')

// Use this for static builds, otherwise check nginx config
app.use(express.static('assets'));

// Body Parser used for the response.query
var bodyParser = require('body-parser')
app.use( bodyParser.json() );
app.use(bodyParser.urlencoded({
  extended: false
}));

// More session configuration
app.use(session({
  genid: function(request) {
    return  uuid.v4()// use UUIDs for session IDs 
  },
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false
}))


app.get('/', function(request, response) {
	// var header=request.headers['authorization']||'',
	// 	token=header.split(/\s+/).pop()||'',
	// 	auth=new Buffer(token, 'base64').toString(),
	// 	parts=auth.split(/:/),
	// 	username=parts[0],
	// 	password=parts[1];

	// response.writeHead(200, { 'Content-Type': 'text/plain' });
	// response.write("{header:Test Page, username:" + username + ", password:" + password + "}");
	// response.end();

	if (request.session.views) {
		request.session.views++
	} else {
		request.session.views = 1
	}
	if (1)
		response.render('index', {pageTitle: 'Home', views: request.session.views, username: 'Yelp', password: 'success'})
	else
		response.render('index', {pageTitle: 'Home', views: request.session.views, username: 'Yelp', password: 'fail'})
})

app.post('/', function(request, response) {
	var header=request.headers['authorization']||''
	var token=header.split(/\s+/).pop()||''
	var auth=new Buffer(token, 'base64').toString()
	var parts=auth.split(/:/)
	var username=parts[0]
	var password=parts[1]

	if (username == 'Yelp' && password == yelpPass) {
		response.writeHead(200, { 'Content-Type': 'text/plain' })
		response.write('\nSuccess!\n')
		response.write(JSON.stringify(request.body) + '\n')
		response.end()
	} else {
		response.writeHead(401, { 'Content-Type': 'text/plain' })
		response.write('\nIncorrect credentials\n')
		response.end()
	}
})

app.get('/destroy', function(request, response) {
	request.session.destroy(function(error) {
		if (error) {
			throw error
		} else {
			response.redirect('/')
		}
	})
})

// Main GET request listener
app.get('/PiggyBack', function(request, response) {
	if (request.session.loggedin) {
		onfleet.getSingleTeamByName('TEST').then(function(team) {
			onfleet.getOrganizationDetails().then(function(org) {
				onfleet.getDestinationByID('IWU6PFSVyLhAbifvh3KnDxnZ').then(function(destination) {
					onfleet.listTasks().then(function(tasks) {
						onfleet.listWebHooks().then(function(webhooks) {
							response.render(
								'pbhome', {
									pageTitle: 'PiggyBack', 
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
	} else {
		response.redirect('/PiggyBack/signin')
	}
})


// POST request listener for a call to create a new worker
app.post('/PiggyBack/new-worker', function(request, response) {
	if (request.session.loggedin) {
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
				response.redirect('/PiggyBack')
			}).catch(function(error) {
				response.render('error', {pageTitle: 'Error', error: JSON.stringify(error)})
			})
		}
	} else {
		response.redirect('/PiggyBack/signin')
	}
})

// POST request listener for a call to delete a worker
	// need to pass in worker's id
app.post('/PiggyBack/delete-worker', function(request, response) {
	if (request.session.loggedin) {
		if (!request.body.id)
			response.redirect('/PiggyBack/')
		else {
			onfleet.deleteWorkerByID(request.body.id).then(function() {
				response.redirect('/PiggyBack/')
			}).catch(function(error) {
				response.render('error', {pageTitle: 'Error', error: JSON.stringify(error)})
			})
		}
	} else {
		response.redirect('/PiggyBack/signin')
	}
})

// POST request listener for a call to update a worker
	// need to pass in worker's id and probably more
app.post('/PiggyBack/update-worker', function(request, response) {
	if (request.session.loggedin) {
		if (!(request.body.id && request.body.name))
			response.redirect('/PiggyBack')
		else {
			onfleet.updateWorkerByID(request.body.id, {name: request.body.name}).then(function() {
				response.redirect('/PiggyBack')
			}).catch(function(error) {
				response.render('error', {pageTitle: 'Error', error: JSON.stringify(error)})
			})
		}
	} else {
		response.redirect('/PiggyBack/signin')
	}
})

app.post('/PiggyBack/new-destination', function(request, response) {
	if (request.session.loggedin) {
		if (!(request.body.number && request.body.street && request.body.city && request.body.country))
		response.redirect('/PiggyBack')
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
			).then(function(d) {
					connection.query('INSERT INTO Destinations (id, name, number, street, apartment, city, state, postalCode, country) VALUES (?,?,?,?,?,?,?,?,?)',
						[d.id, d.address.name, d.address.number, d.address.street, d.address.apartment, d.address.city, d.address.state, d.address.postalCode, d.address.country], 
						function(error, rows) 
						{
							if (error)
								throw error
							console.log('Location successfully added to database. ID: ' + d.id)
						}
					)
				console.log(JSON.stringify(d))
				response.redirect('/PiggyBack')
			}).catch(function(error) {
				response.render('error', {pageTitle: 'Error', error: JSON.stringify(error)})
			})
		}
	} else {
		response.redirect('/PiggyBack/signin')
	}
})

app.post('/PiggyBack/new-task', function(request, response) {
	if (request.session.loggedin) {
		if (!(request.body.destination))
			response.redirect('/PiggyBack')
		else {
			onfleet.createNewTask(
				'~2FSQGbR0qSXi1v9kSQxtW4v',		// merchant
				'~2FSQGbR0qSXi1v9kSQxtW4v',		// executor
				request.body.destination,		// destination
				[request.body.recipients],		// recipients - array
				null,							// complete after - number
				null,							// complete before - number
				false,							// pickup task?
				[],								// dependencies - array
				request.body.notes,				// notes for task
				// request.body.notes
				{mode:'distance', team: 'ylC5klVbtmEVrVlBfUYp9oeM'}
				// {request.body.autoAssign}
				// TEST TEAM
			).then(function(t) {
				var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
				var time = new Date();
				if (t.didAutoAssign) { // get the worker's name
					onfleet.getSingleWorkerByID(t.worker).then(function(w) {
						connection.query('INSERT INTO Tasks (id, company, driverTip, month, day, year, hour, minute, workerId, workerName, destId, destNumber, destStreet, destCity, destPostalCode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
							[
								t.id, request.body.company, 
								request.body.driverTip, 
								months[time.getMonth()], 
								time.getDate(), 
								time.getFullYear(),
								time.getHours(),
								time.getMinutes(),
								t.worker, 
								w.name, 
								t.destination.id, 
								t.destination.address.number, 
								t.destination.address.street, 
								t.destination.address.city, 
								t.destination.address.postalCode
							], 
							function(error, rows)
							{
								if (error)
									throw error
								console.log('Task successfully added to database ID: ' + t.id)
							}
						)
						response.redirect('/PiggyBack')
					}).catch(function(error) {
						response.render('error', {pageTitle: 'Error', error: JSON.stringify(error)})
					})
				} else { // leave the name blank
					console.log('Task was not assigned...')
					connection.query('INSERT INTO Tasks (id, company, driverTip, workerId, workerName, destId, destNumber, destStreet, destCity, destPostalCode) VALUES (?,?,?,?,?,?,?,?,?,?)',
						[t.id, request.body.company, request.body.driverTip, t.worker, '', t.destination.id, t.destination.address.number, t.destination.address.street, t.destination.address.city, t.destination.address.postalCode], 
						function(error, rows)
						{
							if (error)
								throw error
							console.log('Task successfully added to database ID: ' + t.id)
						}
					)
					response.redirect('/PiggyBack')
				}

				
			}).catch(function(error) {
				response.render('error', {pageTitle: 'Error', error: JSON.stringify(error)})
			})
		}
	} else {
		response.redirect('/PiggyBack/signin')
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
	var key = request.body.key

	if (key != signUpKey) {
		response.render('signup', {pageTitle: 'Sign up', errors: ['Incorrect sign up key. Please contact Noah for a key to sign up'], username: username, firstname: firstname, lastname: lastname, phone: phone})
		return
	}

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

	connection.query('SELECT id FROM Users WHERE username=?', [username], function(error, rows) {
		if (error) 
			throw error
		if (rows.length) {
			response.render('signup', {pageTitle: 'Sign up', errors: ['Username already taken'], username: username, firstname: firstname, lastname: lastname, phone: phone})
			return
		}
		
		// something weird here. Not inserting correctly
		connection.query('INSERT INTO Users (username, firstname, lastname, password, phone) VALUES (?,?,?,?,?)',
			[username, firstname, lastname, password, phone], function(error, rows) 
			{
				if (error)
					throw error
				response.render('success', {pageTitle: 'Success', message: 'You have successfully signed up'})
			}
		)
	})
})

app.get('/PiggyBack/signin', function(request, response) {
	if (request.session.loggedin) {
		response.render('signin', {pageTitle: 'Sign in', errors: ['Already signed in']})
	} else {
		response.render('signin', {pageTitle: 'Sign in'})
	}
})

app.post('/PiggyBack/signin', function(request, response) {
	var username = request.body.username
	var password = request.body.password

	if (!(username && password)) {
		response.render('signin', {pageTitle: 'Sign in', errors: ['All fields must be completed'], username: username})
		return
	}

 	connection.query('SELECT id FROM Users WHERE username=? && password=?', [username, password], function(error, rows) {
		if (error)
			throw error
		if (rows.length) {
			request.session.loggedin = true
			response.redirect('/PiggyBack')
			// response.render('success', {pageTitle: 'Success', message: 'You have successfully signed in'})
			return
		} else {
			response.render('signin', {pageTitle: 'Sign in', errors: ['Incorrect username or password'], username: username})
		}
	})
})

app.get('/PiggyBack/webhook/taskCompleted', function(request, response, next) {
	console.log('Received a GET request from Onfleet!')
	console.log(request.originalUrl)
	console.log(request.ip)
	console.log(request.method)
	response.send(request.params.check)
	return next()
})

app.get('/PiggyBack/sendwebhook', function(request, response) {
	console.log('Sending webhook request')
	onfleet.createWebHook('http://noahthomas.us/PiggyBack/webhook/taskCompleted', 0).then(function(data) {
		response.render('error', {pageTitle: 'Success', error: JSON.stringify(data)})
	}).catch(function(error) {
		response.render('error', {pageTitle: 'Error', error: JSON.stringify(error)})
	})
})

// app.get('/PiggyBack/calculate', function(request, response) {
// 	if (request.session.loggedin) {
// 		response.render('calculate', {pageTitle: 'Calculate', reqbody: 'no content uploaded'})
// 	} else {
// 		response.redirect('/PiggyBack/signin')
// 	}
// })

// app.post('/PiggyBack/calculate', upload.single('testfile'), function(request, response) {
// 	if (!request.session.loggedin) {
// 		// req.file is the `avatar` file 
// 	  	// req.body will hold the text fields, if there were any 
// 		response.render('calculate', {
// 			pageTitle: 'Calculate', 
// 			reqbody: JSON.stringify(request.body),
// 			reqfile: JSON.stringify(request.file),
// 			other: JSON.stringify(response.locals.auth)
// 			// need some way to access auth part of options on the request
// 		})
// 	} else {
// 		response.redirect('/PiggyBack/signin')
// 	}
// })

http.listen(8080, '127.0.0.1', function() {
	console.log('listening on port 8080')
})
