// Require the onfleet api, and the database js file
var onfleet = require('./onfleet.js')
var connection = require('./database.js')
var signUpKey = require('./keys.js').signUpKey

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
	var header=request.headers['authorization']||'',
		token=header.split(/\s+/).pop()||'',
		auth=new Buffer(token, 'base64').toString(),
		parts=auth.split(/:/),
		username=parts[0],
		password=parts[1];

	response.writeHead(200, { 'Content-Type': 'text/plain' });
	response.write("{header:Test Page, username:" + username + ", password:" + password + "}");
	response.end();

	// if (request.session.views) {
	// 	request.session.views++
	// } else {
	// 	request.session.views = 1
	// }
	// if (username == 'noah' && password == 'something')

	// 	response.render('index', {pageTitle: 'Home', views: request.session.views, username: 'success', password: 'success'})
	// else
	// 	response.render('index', {pageTitle: 'Home', views: request.session.views, username: 'fail', password: 'fail'})
})

app.post('/', function(request, response) {
	var header=request.headers['authorization']||'',
			token=header.split(/\s+/).pop()||'',
			auth=new Buffer(token, 'base64').toString(),
			parts=auth.split(/:/),
			username=parts[0],
			password=parts[1];

		response.writeHead(200, { 'Content-Type': 'text/plain' });
		response.write(JSON.stringify(request.body.name))
		// response.write("{header:Test Page, username:" + username + ", password:" + password + "}");
		response.end();
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
			).then(function(destination) {
				console.log(JSON.stringify(destination))
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
		if (!(request.body.merchant && request.body.executor && request.body.destination))
		response.redirect('/PiggyBack')
		else {
			onfleet.createNewTask(
				request.body.merchant,
				request.body.executor,
				request.body.destination,
				[request.body.recipients]
				// request.body.completeAfter - need to convert time to number
				// request.body.completeBefore, - null if no time entered
				// request.body.pickupTask,
				// [request.body.dependencies],
				// request.body.notes
				// {request.body.autoAssign}
			).then(function(destination) {
				response.redirect('/PiggyBack')
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
			response.render('success', {pageTitle: 'Success', message: 'You have successfully signed in'})
			return
		} else {
			response.render('signin', {pageTitle: 'Sign in', errors: ['Incorrect username or password'], username: username})
		}
	})
})

app.get('/PiggyBack/calculate', function(request, response) {
	if (request.session.loggedin) {
		response.render('calculate', {pageTitle: 'Calculate', reqbody: 'no content uploaded'})
	} else {
		response.redirect('/PiggyBack/signin')
	}
})

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
