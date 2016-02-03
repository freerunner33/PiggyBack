
// SETUP

// Require the onfleet api, and the database js file
var onfleet = require('./onfleet.js')
var tz = require('./timezone.js')
var connection = require('./database.js')
var signUpKey = require('./keys.js').signUpKey

var user1 = require('./keys.js').user1
var pass1 = require('./keys.js').pass1

// npm modules that are required in
var path = require('path')
var express = require('express')
var app = express()
var http = require('http').Server(app)
var validator = require('validator')
var bcrypt = require('bcrypt')
var uuid = require('node-uuid')
var authorization = require('auth-header')
var dateFormat = require('dateformat')

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



// TESTING
app.get('/Piggyback/pickup-task', function(request, response) {
	onfleet.createNewTask(
		'~2FSQGbR0qSXi1v9kSQxtW4v',								// merchant
		'~2FSQGbR0qSXi1v9kSQxtW4v',								// executor
		'n03HZa7KvR0R2L3EPHFYEbpq',								// destination
		[],														// recipients - array
		null,													// complete after - number
		null,													// complete before - number
		true,													// pickup task?
		[],														// dependencies - array
		'Test task',											// notes for task
		{mode:'distance', team: 'ylC5klVbtmEVrVlBfUYp9oeM'}		// Can add team option with team id
	).then(function(task) {
		response.render('error', {pageTitle: 'Error', errors: ['Success', JSON.stringify(task)]})
	}, function(error) {
		response.render('error', {pageTitle: 'Error', errors: ['Error', JSON.stringify(error)]})
	})
})

app.get('/Piggyback/dropoff-task', function(request, response) {
	onfleet.createNewTask(
		'~2FSQGbR0qSXi1v9kSQxtW4v',								// merchant
		'~2FSQGbR0qSXi1v9kSQxtW4v',								// executor
		'C8j7A7oJiw6AKwDc6Rjj*aaR',								// destination
		[],														// recipients - array
		null,													// complete after - number
		null,													// complete before - number
		false,													// pickup task?
		['XUeH0vt9hhaaB7kH9Py0gsom'],							// dependencies - array
		'Test task'												// notes for task
	).then(function(task) {
		response.render('error', {pageTitle: 'Error', errors: ['Success', JSON.stringify(task)]})
	}, function(error) {
		response.render('error', {pageTitle: 'Error', errors: ['Error', JSON.stringify(error)]})
	})
})

app.get('/Piggyback/assign-task', function(request, response) {
	onfleet.getSingleWorkerByID('ta0qIezLTkxMdkTxNyd*q4FH').then(function(worker) {
		if (worker.tasks.indexOf('JWt32Wqiy19qRdeYCzHgA29J') < 0){
			worker.tasks.push('JWt32Wqiy19qRdeYCzHgA29J')
			onfleet.updateWorkerByID(worker.id, {tasks: worker.tasks}).then(function() {
				response.redirect('/Piggyback')
			}, function(error) {
				response.render('error', {pageTitle: 'Error', errors: ['Error', JSON.stringify(error)]})
			})
		} else {
			response.render('error', {pageTitle: 'Error', errors: ['Already contains this task']})
		}
	}, function(error) {
		response.render('error', {pageTitle: 'Error', errors: ['Error', JSON.stringify(error)]})
	})
})


// ROUTING
app.get('/', function(request, response) {
	if (request.session.views)
		request.session.views++
	else
		request.session.views = 1
	response.render('index', {pageTitle: 'Home', views: request.session.views})
})

app.post('/Piggyback', function(request, response) {
	// Parsing basic authorization sent in post request
	var header=request.headers['authorization']||''
	var token=header.split(/\s+/).pop()||''
	var auth=new Buffer(token, 'base64').toString()
	var parts=auth.split(/:/)
	var username=parts[0]
	var password=parts[1]

	if (username == user1 && password == pass1 && request.body.destinationA && request.body.destinationB && request.body.driverTip) {
		response.writeHead(200, { 'Content-Type': 'text/plain' })
		response.write('\nSuccess!\nExample return object\n')
		response.write('{\n\ttaskId: abc123def456ghi789\n')
		response.write('\tDestination A: ' + request.body.destinationA + '\n')
		response.write('\tDestination B: ' + request.body.destinationB + '\n')
		response.write('\tDriver Tip: $' + request.body.driverTip + '\n}\n\n')
		response.end()
	} else {
		response.writeHead(401, { 'Content-Type': 'text/plain' })
		response.write('Incorrect credentials\n' + username + ':' + user1 + '\n' + password + ':' + pass1 + '\n')
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

app.get('/Piggyback', function(request, response) {
	if (request.session.loggedin) {
		onfleet.listTasks().then(function(tasks) {
			var html = []
			connection.query('SELECT id,name,number,street,apartment,city,state,postalCode,country FROM Destinations', function(error, rows) {
				if (error)
					throw error
				if (rows.length) {
					response.render(
						'tasks', {
							pageTitle: 'Piggyback Technologies',
							tasks: tasks,
							dest: rows
						}
					)
				}
			})
		}, function(error) {
			response.render('error', {pageTitle: 'Error', errors: JSON.stringify(error)})
		})
	} else {
		response.redirect('/Piggyback/signin')
	}
})

// do delete instead when deployed
app.post('/Piggyback/delete-task', function(request, response) {
	if (!request.body.id)
		response.redirect('/Piggyback')
	else {
		onfleet.deleteTask(request.body.id).then(function() {
			response.redirect('/Piggyback')
		}, function(error) {
			response.render('error', {pageTitle: 'Error', errors: [JSON.stringify(error)]})
		})
	}
})

app.post('/Piggyback/jobs', function(request, response) {
	var b = request.body
	var waypoint1 = {
		address: b.pickup_address, 
		address2: b.pickup_address2, 
		city: b.pickup_city, 
		state: b.pickup_state, 
		zip: b.pickup_zip, 
		name: b.pickup_name, 
		phone: b.pickup_phone, 
		email: b.pickup_email, 
		location: {latitude: b.pickup_latitude, 
			longitude: b.pickup_longitude}, 
		arrive_at: b.pickup_arrive_at, 
		special_instructions: b.pickup_special_instructions
	}
	var waypoint2 = {
		address: b.dropoff_address, 
		address2: b.dropoff_address2 , 
		city: b.dropoff_city, 
		state: b.dropoff_state, 
		zip: b.dropoff_zip, 
		name: b.dropoff_name, 
		phone: b.dropoff_phone, 
		email: b.dropoff_email, 
		location: {latitude: b.dropoff_latitude, 
			longitude: b.dropoff_longitude}, 
		special_instructions: b.dropoff_special_instructions
	}
	var j = {
		pickup_waypoint: waypoint1, 
		dropoff_waypoint: waypoint2, 
		order_id: b.order_id, 
		order_items: b.order_items, 
		order_total: b.order_total, 
		tip: b.tip, 
		support_phone: b.support_phone, 
		debug: b.debug
	}
	/////////////////////////////////
	var pickupSplit = j.pickup_waypoint.address.indexOf(' ')
	var destA = {
		address: {
			number: j.pickup_waypoint.address.substr(0, pickupSplit),
			street: j.pickup_waypoint.address.substr(pickupSplit),
			city: j.pickup_waypoint.city,
			state: j.pickup_waypoint.state,
			postalCode: j.pickup_waypoint.zip,
			country: 'USA'
		}, 
		location: [j.pickup_waypoint.location.longitude, j.pickup_waypoint.location.latitude]
	}
	var dropoffSplit = j.dropoff_waypoint.address.indexOf(' ')
	var destB = {
		address: {
			number: j.dropoff_waypoint.address.substr(0, dropoffSplit),
			street: j.dropoff_waypoint.address.substr(dropoffSplit),
			city: j.dropoff_waypoint.city,
			state: j.dropoff_waypoint.state,
			postalCode: j.dropoff_waypoint.zip,
			country: 'USA'
		}, 
		location: [j.dropoff_waypoint.location.longitude, j.dropoff_waypoint.location.latitude]
	}

	var recipientA = {
		name: j.pickup_waypoint.name,
		phone: j.pickup_waypoint.phone,
		notes: null,
		skipSMSNotifications: 'false',
		skipPhoneNumberValidation: 'false'
	}
	var recipientB = {
		name: j.dropoff_waypoint.name,
		phone: j.dropoff_waypoint.phone,
		notes: null,
		skipSMSNotifications: 'false',
		skipPhoneNumberValidation: 'false'
	}

	var timeA = new Date(j.pickup_waypoint.arrive_at).getTime()
	var timeB = timeA + (15 * 60 * 1000)
	var timeC = timeA + (40 * 60 * 1000)
	tz.getTimeZone().then(function(timezone) {
		timeA = timeA - (timezone.rawOffset * 1000)
		timeB = timeB - (timezone.rawOffset * 1000)
		timeC = timeC - (timezone.rawOffset * 1000)
		var dateA = new Date(timeA)
		var dateB = new Date(timeB)
		var dateC = new Date(timeC)
		onfleet.createNewTask(
			'~2FSQGbR0qSXi1v9kSQxtW4v',								// merchant
			'~2FSQGbR0qSXi1v9kSQxtW4v',								// executor
			destA,													// destination
			[recipientA],											// recipients - array
			timeA,													// complete after - number
			timeB,													// complete before - number
			true,													// pickup task?
			[],														// dependencies - array
			j.pickup_waypoint.special_instructions,					// notes for task
			{mode:'distance', team: 'ylC5klVbtmEVrVlBfUYp9oeM'}		// Can add team option with team id: TEST
		).then(function(taskA) {
			onfleet.createNewTask(
				'~2FSQGbR0qSXi1v9kSQxtW4v',							// merchant
				'~2FSQGbR0qSXi1v9kSQxtW4v',							// executor
				destB,												// destination
				[recipientB],										// recipients - array
				timeA,												// complete after - number
				timeC,												// complete before - number
				false,												// pickup task?
				[taskA.id],											// dependencies - array
				j.dropoff_waypoint.special_instructions				// notes for task
			).then(function(taskB) {
				onfleet.getSingleWorkerByID(taskA.worker).then(function(worker) {
					connection.query('INSERT INTO Tasks (shortId, yelpId, company, driverTip, taskType, completeAfter, completeBefore, workerId, workerName, destination, completionTime, didSucceed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
						[
							taskA.shortId,													// shortId
							j.order_id,														// yelpId
							'Yelp',															// company
							null,															// driverTip
							'pickup',														// taskType
							(dateA).toISOString(),											// completeAfter	- in UTC
							(dateB).toISOString(),											// completeBefore	- in UTC
							worker.id,														// workerId
							worker.name,													// workerName
							'' + taskA.destination.address.number + taskA.destination.address.street + ', ' + taskA.destination.address.apartment + ', ' + taskA.destination.address.city + ', ' + taskA.destination.address.state + ' ' + taskA.destination.address.postalCode,
							null,															// completionTime
							null															// didSucceed
						], 
						function(error, rows)
						{
							if (error)
								throw error
							// need to assign this task to the worker
							worker.tasks.push(taskB.id)
							onfleet.updateWorkerByID(worker.id, {tasks: worker.tasks}).then(function() {
								connection.query('INSERT INTO Tasks (shortId, yelpId, company, driverTip, taskType, completeAfter, completeBefore, workerId, workerName, destination, completionTime, didSucceed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
									[
										taskB.shortId,													// shortId
										j.order_id,														// yelpId
										'Yelp',															// company
										j.tip,															// driverTip
										'dropoff',														// taskType
										(dateA).toISOString(),											// completeAfter	- in UTC
										(dateC).toISOString(),											// completeBefore	- in UTC
										worker.id,														// workerId
										worker.name,													// workerName
										'' + taskB.destination.address.number + taskB.destination.address.street + ', ' + taskB.destination.address.apartment + ', ' + taskB.destination.address.city + ', ' + taskB.destination.address.state + ' ' + taskB.destination.address.postalCode,
										null,															// completionTime
										null															// didSucceed
									], 
									function(error, rows)
									{
										if (error)
											throw error
										response.writeHead(200, { 'Content-Type': 'application/json' })
										response.write(JSON.stringify({job_id: taskB.shortId}))
										response.end()
									}
								)
							}, function(error) {
								// DROPOFF TASK NOT ADDED TO WORKER
								response.writeHead(400, { 'Content-Type': 'application/json' })
								response.write(JSON.stringify(error))
								response.end()
							})
						}
					)
				}, function(error) {
					// NOT AUTO ASSIGNED TO A WORKER
					response.writeHead(400, { 'Content-Type': 'application/json' })
					response.write(JSON.stringify(error))
					response.end()
				})
			}, function(error) {
				// ERROR CREATING DROPOFF TASK
				response.writeHead(400, { 'Content-Type': 'application/json' })
				response.write(JSON.stringify(error))
				response.end()
			})
		}, function(error) {
			// ERROR CREATING PICKUP TASK
			response.writeHead(400, { 'Content-Type': 'application/json' })
			response.write(JSON.stringify(error))
			response.end()
		})
	}, function(error) {
		// ERROR GETTING TIMEZONE
		response.writeHead(400, { 'Content-Type': 'application/json' })
		response.write(JSON.stringify(error))
		response.end()
	})
})

app.delete('/Piggyback/jobs/*', function(request, response) {
	response.writeHead(200, { 'Content-Type': 'application/json' })
	response.write(JSON.stringify({path: request.url}))
	response.end
})

app.get('/Piggyback/signup', function(request, response) {
	response.render('signup', {pageTitle: 'Sign up'})
})

app.post('/Piggyback/signup', function(request, response) {
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

app.get('/Piggyback/signin', function(request, response) {
	if (request.session.loggedin)
		response.render('signin', {pageTitle: 'Sign in', errors: ['Already signed in']})
	else
		response.render('signin', {pageTitle: 'Sign in'})
})

app.post('/Piggyback/signin', function(request, response) {
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
			response.redirect('/Piggyback')
			return
		} else {
			response.render('signin', {pageTitle: 'Sign in', errors: ['Incorrect username or password'], username: username})
		}
	})
})

app.post('/Piggyback/webhook/taskCompleted', function(request, response) {
	console.log('Got a new task')
	console.log('\n' + JSON.stringify(request.body))
})

// Used to respond to webhook request
app.get('/Piggyback/webhook/taskCompleted', function(request, response, next) {
	var str = request.originalUrl.split('=')[1]
	response.send(str)
	return next()
})

// Used to send a webhook request
app.get('/Piggyback/sendwebhook', function(request, response) {
	onfleet.createWebHook('http://noahthomas.us/Piggyback/webhook/taskCompleted', 0).then(function(data) {
		response.render('error', {pageTitle: 'Success', errors: JSON.stringify(data)})
	}).catch(function(error) {
		response.render('error', {pageTitle: 'Error', errors: JSON.stringify(error)})
	})
})

http.listen(8080, '127.0.0.1', function() {
	console.log('listening on port 8080')
})
