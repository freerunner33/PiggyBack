
// SETUP

// Require the onfleet api, and the database js file
var onfleet = require('./onfleet.js')
var tz = require('./timezone.js')
var connection = require('./database.js')
var signUpKey = require('./keys.js').signUpKey
var client = require('twilio')('ACb881b9340ea17635979b58d81acb6cdb', '291061d8ef68757197f8308b3856aa9e')

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

var eat24StatusCodes = {
	40: 'submitted',
	41: 'denied',
	42: 'done_cancelled',
	44: 'not_found',
	50: 'assigned',
	51: 'at_pickup',
	52: 'otw_active',
	53: 'at_dropoff',
	54: 'done_delivered',
	55: 'done_cannot_deliver'
}
var eat24Reasons = {
	40: 'Job has been accepted and successfully created. You will now have access to the job_id.',
	41: 'Job has been rejected by the driver company.',
	42: 'Job has been cancelled.',
	44: 'Job not found.',
	50: 'Job has been assigned to driver.',
	51: 'Driver at the restaurant.',
	52: 'Driver is on the way to the drop off.',
	53: 'Driver at the at the drop off.',
	54: 'Job has been delivered by driver.',
	55: 'Job delivery was unsuccessfully attempted by driver. Additional information will be logged.'
}

// TESTING
app.get('/Piggyback/test', function(request, response) {
	tz.getTimeZone(39.6034810, -119.6822510).then(function(timezone) {
		var offset = timezone.rawOffset/36
		if (offset <= 1000 || offset >= -1000) {
			if (offset < 0) 
				offset = '-0' + offset.substring(1)
			else
				offset = '0' + offset
		}
		response.render('error', {pageTitle: 'Success', errors: [JSON.stringify(timezone), offset]})
	}, function(error) {
		response.render('error', {pageTitle: 'Error', errors: [JSON.stringify(error)]})
	})
})

app.post('/Piggyback/twilio', function(request, response) {
	console.log('NEW REPLY MESSAGE')
	console.log('Message from: ' + request.body.From)
	console.log('Message body: ' + request.body.Body)
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

// requesting information about
app.get('/Piggyback/jobs/*', function(request, response) {
	// if (request.session.loggedin) {
		var path = request.url.split('/')
		if (path.length != 4) {
			response.writeHead(400, {'Content-Type': 'application/json'})
			response.write(JSON.stringify({error: 'Incorrect path format'}))
			response.end()
		} else {
			onfleet.getSingleTaskByShortID(path[3]).then(function(task) {
				connection.query('SELECT yelpId,workerName FROM Tasks WHERE shortId=?', [task.shortId], function(error, rows) {
					if (error)
						throw error
					if (rows && rows.length) {
						// get worker details
						onfleet.getSingleWorkerByID(task.worker).then(function(worker) {
							if (worker.location) {
								var loc = {latitude: worker.location[1], longitude: worker.location[0]}
							} else {
								var loc = null
							}
							connection.query('SELECT statusCode, timestamp FROM JobLogs WHERE shortId=?', [task.shortId], function(error, rows2) {
								if (error)
									throw error
								if (rows2 && rows2.length) {
									var logFile = writeLog(rows2, latitude, longitude)
									response.writeHead(200, {'Content-Type': 'application/json'})
									var json = JSON.stringify(
										{
											job_id: task.shortId,
											order_id: rows[0].yelpId,
											status_code: rows2[rows2.length - 1].statusCode,
											status: eat24StatusCodes[rows2[rows2.length - 1].statusCode],
											reason: eat24Reasons[rows2[rows2.length - 1].statusCode],
											log: rows2,
											driver: {
												name: worker.name,
												location: loc,
												phone: worker.phone
											}
										}
									)
									console.log('SUCCESS')
									response.end(json)	
								} else {
									console.log('FAIL')
									response.writeHead(400, { 'Content-Type': 'application/json' })
									response.write(JSON.stringify({ error: 'Task not found in database'}))
									response.end()
								}
							})
						}, function(error) {
							response.writeHead(400, { 'Content-Type': 'application/json' })
							response.write(JSON.stringify(error))
							response.end()
						})
					} else {
						response.writeHead(400, { 'Content-Type': 'application/json' })
						response.write(JSON.stringify({ error: 'Task not found in database'}))
						response.end()
					}
				})
			}, function(error) {
				response.writeHead(400, { 'Content-Type': 'application/json' })
				response.write(JSON.stringify(error))
				response.end()
			})
		}
	// } else {
	// 	response.redirect('/Piggyback/signin')
	// }
})

function writeLog(arr) {

	for (i = 0; i < arr.length; i++) {
		log = arr[i]
		var status_code = log.status_code
		var status = eat24StatusCodes[status_code]
		var reason = eat24Reasons[status_code]
		var time = log.timestamp // this is a number - convert to local with tz, then format with tz addition -0800

	}
	return
}

// do delete instead when deployed
app.post('/Piggyback/delete-task', function(request, response) {
	if (request.session.loggedin) {
		if (!request.body.id)
			response.redirect('/Piggyback')
		else {
			onfleet.deleteTask(request.body.id).then(function() {
				response.redirect('/Piggyback')
			}, function(error) {
				response.render('error', {pageTitle: 'Error', errors: [JSON.stringify(error)]})
			})
		}
	} else {
		response.redirect('/Piggyback/signin')
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

	if (checkWayPoint(j.pickup_waypoint, true) && checkWayPoint(j.dropoff_waypoint, false) && j.order_id) {
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
		tz.getTimeZone(/*j.dropoff_waypoint.location.latitude, j.dropoff_waypoint.location.longitude*/).then(function(timezone) {
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
						connection.query('INSERT INTO Tasks (shortId, taskId, yelpId, company, driverTip, taskType, completeAfter, completeBefore, workerId, workerName, destination, completionTime, didSucceed, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
							[
								taskA.shortId,													// shortId
								taskA.id,														// taskId
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
								null,															// didSucceed
								'40:' + taskA.timeCreated										//status
							], 
							function(error, rows)
							{
								if (error)
									throw error
								// need to assign this task to the worker
								worker.tasks.push(taskB.id)
								onfleet.updateWorkerByID(worker.id, {tasks: worker.tasks}).then(function() {
									connection.query('INSERT INTO Tasks (shortId, taskId, yelpId, company, driverTip, taskType, completeAfter, completeBefore, workerId, workerName, destination, completionTime, didSucceed, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
										[
											taskB.shortId,										// shortId
											taskB.id,											// taskId
											j.order_id,											// yelpId
											'Yelp',												// company
											j.tip,												// driverTip
											'dropoff',											// taskType
											(dateA).toISOString(),								// completeAfter	- in UTC
											(dateC).toISOString(),								// completeBefore	- in UTC
											worker.id,											// workerId
											worker.name,										// workerName
											'' + taskB.destination.address.number + taskB.destination.address.street + ', ' + taskB.destination.address.apartment + ', ' + taskB.destination.address.city + ', ' + taskB.destination.address.state + ' ' + taskB.destination.address.postalCode,
											null,												// completionTime
											null,												// didSucceed
											'40:' + taskB.timeCreated							//status
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
	} else {
		// ERROR MISSING SOME VARIABLE
		response.writeHead(400, { 'Content-Type': 'application/json' })
		response.write(JSON.stringify({error: 'Missing some variable.'}))
		response.end()
	}
})

function checkWayPoint(wp, pickup) {
	if (wp.address && wp.city && wp.state && wp.zip && wp.name && wp.phone && wp.location)
		if (pickup)
			if (wp.arrive_at)
				return true
			else
				return false
		else
			return true
	else
		return false
} 

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

// SIGNIN AND SIGNUP
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

app.post('/Piggyback/webhook/taskStarted', function(request, response) {
	console.log('taskStarted: ' + task.shortId)
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		if (!task.pickupTask) {		// Must be dropoff task
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'51',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log('ERROR - query\n' + error)
				if (rows) {
					// console.log('SUCCESS - query')
				}
				response.sendStatus(200)
			})
		}
	}, function(error) {
		response.sendStatus(404) // task not found, try again in 30 minutes
	})
})
app.post('/Piggyback/webhook/taskEta', function(request, response) {
	console.log('taskEta: ' + task.shortId)
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		if (!task.pickupTask) {		// Must be dropoff task
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'52',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log('ERROR - query\n' + error)
				if (rows) {
					// console.log('SUCCESS - query')
				}
				response.sendStatus(200)
			})
		}
	}, function(error) {
		response.sendStatus(404) // task not found, try again in 30 minutes
	})
})
app.post('/Piggyback/webhook/taskArrival', function(request, response) {
	console.log('taskArrival: ' + task.shortId)
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		if (!task.pickupTask) {		// Must be dropoff task
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'53',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log('ERROR - query\n' + error)
				if (rows) {
					// console.log('SUCCESS - query')
				}
				response.sendStatus(200)
			})
		}
	}, function(error) {
		response.sendStatus(404) // task not found, try again in 30 minutes
	})
})
app.post('/Piggyback/webhook/taskCompleted', function(request, response) {
	// client.sendMessage({
	//     to:'+19703084693',
	//     from: '+19709991252',
	//     body: 'Task was completed. Please respond with 1 to confirm, or 0 to indicate that the task was not completed.'
	// }, function(err, responseData) { //this function is executed when a response is received from Twilio
	// 	if (err) {
	// 		console.log('Twilio message error')
	// 		console.log(err)
	// 	} else {
	//         // console.log(responseData.from) // from phone number
	//         // console.log(responseData.body) // text message
	//         console.log(JSON.stringify(request.body))
	// 		response.sendStatus(200)
	//     }
	// })
	console.log('taskCompleted: ' + task.shortId)
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		if (!task.pickupTask) {		// Must be dropoff task
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'54',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log('ERROR - query\n' + error)
				if (rows) {
					// console.log('SUCCESS - query')
				}
				response.sendStatus(200)
			})
		}
	}, function(error) {
		response.sendStatus(404) // task not found, try again in 30 minutes
	})
})
app.post('/Piggyback/webhook/taskFailed', function(request, response) {
	console.log('taskFailed: ' + task.shortId)
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		if (!task.pickupTask) {		// Must be dropoff task
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'55',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log('ERROR - query\n' + error)
				if (rows) {
					// console.log('SUCCESS - query')
				}
				response.sendStatus(200)
			})
		}
	}, function(error) {
		response.sendStatus(404) // task not found, try again in 30 minutes
	})
})
app.post('/Piggyback/webhook/workerDuty', function(request, response) {
	response.sendStatus(200)
})
app.post('/Piggyback/webhook/taskCreated', function(request, response) {
	console.log('taskCreated: ' + task.shortId)
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		if (!task.pickupTask) {		// Must be dropoff task
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'40',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log('ERROR - query\n' + error)
				if (rows) {
					// console.log('SUCCESS - query')
				}
				response.sendStatus(200)
			})
		}
	}, function(error) {
		response.sendStatus(404) // task not found, try again in 30 minutes
	})
})
app.post('/Piggyback/webhook/taskUpdated', function(request, response) {
	response.sendStatus(200)
})
app.post('/Piggyback/webhook/taskDeleted', function(request, response) {
	console.log('taskDeleted: ' + task.shortId)
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		if (!task.pickupTask) {		// Must be dropoff task
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'42',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log('ERROR - query\n' + error)
				if (rows) {
					// console.log('SUCCESS - query')
				}
				response.sendStatus(200)
			})
		}
	}, function(error) {
		response.sendStatus(404) // task not found, try again in 30 minutes
	})
})
app.post('/Piggyback/webhook/taskAssigned', function(request, response) {
	console.log('taskAssigned: ' + task.shortId)
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		if (!task.pickupTask) {		// Must be dropoff task
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'50',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log('ERROR - query\n' + error)
				if (rows) {
					// console.log('SUCCESS - query')
				}
				response.sendStatus(200)
			})
		}
	}, function(error) {
		response.sendStatus(404) // task not found, try again in 30 minutes
	})
})
app.post('/Piggyback/webhook/taskUnassigned', function(request, response) {
	response.sendStatus(200)
})


// Used to respond to webhook request
// app.get('/Piggyback/webhook/taskCreated', function(request, response, next) {
// 	response.send(request.query.check)
// 	return next()
// })

// // Used to send a webhook request
// app.get('/Piggyback/sendwebhook', function(request, response) {
// 	if (request.session.loggedin) {
// 		onfleet.createWebHook('http://107.170.198.205/Piggyback/webhook/taskCreated', 6).then(function(data) {
// 			response.render('error', {pageTitle: 'Success', errors: [JSON.stringify(data)]})
// 		}, function(error) {
// 			response.render('error', {pageTitle: 'Error', errors: [JSON.stringify(error)]})
// 		})
// 	} else {
// 		response.redirect('/Piggyback/signin')
// 	}
// })

http.listen(8080, '127.0.0.1', function() {
	// console.log('listening on port 8080')
})
