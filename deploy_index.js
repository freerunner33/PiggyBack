
// SETUP

// Require the onfleet api, and the database js file
var onfleet = require('./onfleet.js')
var yelp = require('./yelp.js')
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

var httpClient = require('http')

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
app.use(bodyParser.urlencoded(
	{
		extended: false
	}
))

// More session configuration
app.use(session(
	{
		genid: function(request) {
			return  uuid.v4()// use UUIDs for session IDs 
		},
		secret: 'keyboard cat',
		resave: false,
		saveUninitialized: false
	}
))

// VARIABLES
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

// Home page
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

//	1. Creating a new job: 
app.post('/Piggyback/jobs', function(request, response) {
	var j = request.body
	
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

		tz.getTimeZone(j.dropoff_waypoint.location.latitude, j.dropoff_waypoint.location.longitude).then(function(timezone) {
			timeA = timeA - (timezone.rawOffset * 1000) - (timezone.dstOffset * 1000)
			timeB = timeB - (timezone.rawOffset * 1000) - (timezone.dstOffset * 1000)
			timeC = timeC - (timezone.rawOffset * 1000) - (timezone.dstOffset * 1000)
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
						connection.query('INSERT INTO Tasks (shortId, taskId, yelpId, company, driverTip, taskType, completeAfter, completeBefore, workerId, workerName, destination, completionTime, didSucceed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
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
								null															// didSucceed
							], 
							function(error, rows)
							{
								if (error)
									throw error
								// need to assign this task to the worker
								worker.tasks.push(taskB.id)
								onfleet.updateWorkerByID(worker.id, {tasks: worker.tasks}).then(function() {
									connection.query('INSERT INTO Tasks (shortId, taskId, yelpId, company, driverTip, taskType, completeAfter, completeBefore, workerId, workerName, destination, completionTime, didSucceed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
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
											null												// didSucceed
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

// 2. Deleting a job:
app.delete('/Piggyback/jobs/*', function(request, response) {
	var path = request.url.split('/')
	if (path.length != 4) {
		response.writeHead(405, {'Content-Type': 'application/json'})
		response.write(JSON.stringify({error: 'Incorrect path format'}))
		response.end()
	} else {
		// first delete the pickup, then dropoff
		onfleet.getSingleTask(path[3]).then(function(taskB) {
			onfleet.deleteTask(taskB.dependencies[0]).then(function() {
				onfleet.deleteTask(taskB.id).then(function() {
					response.writeHead(200, { 'Content-Type': 'application/json' })
					response.write(JSON.stringify({job_id: path[3]}))
					response.end()
				}, function(error) {
					response.writeHead(405, { 'Content-Type': 'application/json' })
					response.write(JSON.stringify({error: 'Task could not be deleted.'}))
					response.end()
				})
			}, function(error) {
				response.writeHead(405, { 'Content-Type': 'application/json' })
				response.write(JSON.stringify({error: 'Task could not be deleted.'}))
				response.end()
			})
		}, function(error) {
			response.writeHead(404, { 'Content-Type': 'application/json' })
			response.write(JSON.stringify({error: 'Job id not found.'}))
			response.end()
		})
	}
})

// 3. Querying the status of a job
app.get('/Piggyback/jobs/*', function(request, response) {
	var path = request.url.split('/')
	if (path.length != 4) {
		response.writeHead(400, {'Content-Type': 'application/json'})
		response.write(JSON.stringify({error: 'Incorrect path format'}))
		response.end()
	} else {
		onfleet.getSingleTaskByShortID(path[3]).then(function(task) {
			connection.query('SELECT yelpId,workerName FROM Tasks WHERE shortId=?', [task.shortId], function(error, rows) {
				if (error) {
					response.writeHead(400, {'Content-Type': 'application/json'})
					response.write(JSON.stringify(error))
					response.end()
				}
				if (rows && rows.length) {
					// get worker details
					onfleet.getSingleWorkerByID(task.worker).then(function(worker) {
						if (worker.location) {
							var loc = {latitude: worker.location[1], longitude: worker.location[0]}
						} else {
							var loc = null
						}
						connection.query('SELECT statusCode, timestamp FROM JobLogs WHERE shortId=?', [task.shortId], function(error, rows2) {
							if (error) {
								response.writeHead(400, {'Content-Type': 'application/json'})
								response.write(JSON.stringify(error))
								response.end()
							}
							if (rows2 && rows2.length) {
								writeLog(rows2, task.destination.location[1], task.destination.location[0]).then(function(log) {
									response.writeHead(200, {'Content-Type': 'application/json'})
									var json = JSON.stringify(
										{
											job_id: task.shortId,
											order_id: rows[0].yelpId,
											status_code: rows2[rows2.length - 1].statusCode,
											status: eat24StatusCodes[rows2[rows2.length - 1].statusCode],
											reason: eat24Reasons[rows2[rows2.length - 1].statusCode],
											log: log,
											driver: {
												name: worker.name,
												location: loc,
												phone: worker.phone
											}
										}
									)
									response.end(json)	
								}, function() {
									response.writeHead(400, { 'Content-Type': 'application/json' })
									response.write(JSON.stringify({ error: 'Problem with log file'}))
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
})

// HELPER FUNCTIONS
function writeLog(arr, latitude, longitude) {
	return new Promise(function(resolve, reject) {
		var newArr = []
		tz.getOffset(latitude, longitude).then(function(offset) {
			for (i = 0; i < arr.length; i++) {
				log = arr[i]
				var status_code = log.statusCode
				var status = eat24StatusCodes[status_code]
				var reason = eat24Reasons[status_code]
				var time = log.timestamp // this is a number - convert to local with tz, then format with tz addition -0800
				time = Number(time) + Number(offset.number * 1000)
				time = (new Date(time)).toISOString()
				time = time.substring(0, time.length - 5) // 12:30:05.000Z
				time = time + offset.string
				newArr.push({
					status_code: status_code,
					status: status,
					reason: reason,
					timestamp: time
				})
			}
			resolve(newArr)
		}, function(error) {
			reject('Failure')
		})
	})
}
