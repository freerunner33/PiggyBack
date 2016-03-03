
// SETUP
var onfleet = require('./onfleet.js')
var yelp = require('./yelp')
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

// HOME PAGE
app.get('/', function(request, response) {
	response.render('index', {pageTitle: 'Home'})
})

// 1. Creating a new job
app.post('/Piggyback/jobs', function(request, response) {
	console.log('CREATE JOB')

	var header=request.headers['authorization']||''
	var token=header.split(/\s+/).pop()||''
	var auth=new Buffer(token, 'base64').toString()
	var parts=auth.split(/:/)
	var username=parts[0]
	var password=parts[1]

	if (username.localeCompare(yelpUser) == 0 && password.localeCompare(yelpPass) == 0) {
		var j = request.body

		if (checkWayPoint(j.pickup_waypoint, true) && checkWayPoint(j.dropoff_waypoint, false) && j.order_id) {
			var pickupSplit = j.pickup_waypoint.address.indexOf(' ')
			var destA = {
				address: {
					number: j.pickup_waypoint.address.substr(0, pickupSplit),
					street: j.pickup_waypoint.address.substr(pickupSplit),
					apartment: j.pickup_waypoint.address2,
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
					apartment: j.dropoff_waypoint.address2,
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
			j.pickup_waypoint.arrive_at = j.pickup_waypoint.arrive_at.replace(/\u2010/g, '-');
			
			var timeA = new Date(j.pickup_waypoint.arrive_at).getTime()
			var timeB = timeA + (15 * 60 * 1000)
			var timeC = timeA + (40 * 60 * 1000)

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
				{mode:'distance', team: 'wX8Nn3uoYlEvtGOdTcbQseQ6'}		// Can add team option with team id: TEST ylC5klVbtmEVrVlBfUYp9oeM
			).then(function(taskA) {
				console.log('Created pickup task - ' + taskA.shortId)

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
					console.log('Created dropoff task - ' + taskB.shortId + ' [' + taskA.shortId + ']')

					connection.query('INSERT INTO Tasks (shortId, taskId, yelpId, company, driverTip, taskType, completeAfter, completeBefore, workerId, workerName, destination, completionTime, didSucceed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
						[
							taskA.shortId,													// shortId
							taskA.id,														// taskId
							j.order_id,														// yelpId
							username,														// company
							null,															// driverTip
							'pickup',														// taskType
							(dateA).toISOString(),											// completeAfter	- in UTC
							(dateB).toISOString(),											// completeBefore	- in UTC
							'not assigned',													// workerId
							'not assigned',													// workerName
							'' + taskA.destination.address.number + taskA.destination.address.street + ', ' + taskA.destination.address.apartment + ', ' + taskA.destination.address.city + ', ' + taskA.destination.address.state + ' ' + taskA.destination.address.postalCode,
							null,															// completionTime
							null															// didSucceed
						], 
						function(error, rows)
						{
							if (error) {
								console.log(' ERR 01 - Pickup task: ' + taskA.shortId + ' was not added to database')
								throw error
							}
							connection.query('INSERT INTO Tasks (shortId, taskId, yelpId, company, driverTip, taskType, completeAfter, completeBefore, workerId, workerName, destination, completionTime, didSucceed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
								[
									taskB.shortId,										// shortId
									taskB.id,											// taskId
									j.order_id,											// yelpId
									username,											// company
									j.tip,												// driverTip
									'dropoff',											// taskType
									(dateA).toISOString(),								// completeAfter	- in UTC
									(dateC).toISOString(),								// completeBefore	- in UTC
									'not assigned',										// workerId
									'not assigned',										// workerName
									'' + taskB.destination.address.number + taskB.destination.address.street + ', ' + taskB.destination.address.apartment + ', ' + taskB.destination.address.city + ', ' + taskB.destination.address.state + ' ' + taskB.destination.address.postalCode,
									null,												// completionTime
									null												// didSucceed
								], 
								function(error, rows)
								{
									if (error) {
										console.log(' ERR 02 - Dropoff task: ' + taskB.shortId + ' was not added to database')
										throw error
									}
									console.log('Jobs [' + taskA.shortId + ', ' + taskB.shortId + '] were successfully created and added to database - \t\t\t' + (new Date()).getTime())
									response.writeHead(200, { 'Content-Type': 'application/json' })
									response.write(JSON.stringify({job_id: taskB.shortId}))
									response.end()
								}
							)
						}
					)
				}, function(error) {
					// ERROR CREATING DROPOFF TASK
					console.log(' ERR 03 - Dropoff task was not created\n' + JSON.stringify(error))
					response.writeHead(405, { 'Content-Type': 'application/json' })
					response.write(JSON.stringify({error: 'Error creating job - 2'}))
					response.end()
				})
			}, function(error) {
				// ERROR CREATING PICKUP TASK
				console.log(' ERR 04 - Pickup task was not created\n' + JSON.stringify(error))
				response.writeHead(405, { 'Content-Type': 'application/json' })
				response.write(JSON.stringify({error: 'Error creating job - 1 '}))
				response.end()
			})
		} else {
			// ERROR MISSING A VARIABLE
			console.log(' ERR 05 - Request missing a variable\n' + JSON.stringify(error))
			response.writeHead(400, { 'Content-Type': 'application/json' })
			response.write(JSON.stringify({error: 'Missing a parameter '}))
			response.end()
		}
	} else {
		response.sendStatus(401)
	}
})

// 2. Deleting a job
app.delete('/Piggyback/jobs/*', function(request, response) {
	console.log('DELETE JOB')

	var header=request.headers['authorization']||''
	var token=header.split(/\s+/).pop()||''
	var auth=new Buffer(token, 'base64').toString()
	var parts=auth.split(/:/)
	var username=parts[0]
	var password=parts[1]
	if (username.localeCompare(yelpUser) == 0 && password.localeCompare(yelpPass) == 0) {
		var path = request.url.split('/')
		if (path.length == 4) {
			onfleet.getSingleTaskByShortID(path[3]).then(function(taskB) {
				console.log('Cancelling dropoff ' + taskB.shortId + ' and pickup ' + taskB.dependencies[0])
				connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [taskB.shortId,'42',(new Date()).getTime()], function(error, rows){
					if (error) {
						console.log(' ERR 06 - Dropoff task: ' + taskB.shortId + ' was not added to database')
						throw error
					}
					getJobData(taskB.shortId).then(function(joblog) {
						onfleet.deleteTask(taskB.dependencies[0]).then(function() {
							console.log('Cancelled pickup task')
							onfleet.deleteTask(taskB.id).then(function() {
								console.log('Cancelled dropoff task - \t\t\t' + (new Date()).getTime())
								response.writeHead(200, { 'Content-Type': 'application/json' })
								response.write(JSON.stringify(joblog))
								response.end()
							}, function(error) {
								console.log(' ERR 07 - Dropoff task was not cancelled\n' + JSON.stringify(error))
								response.writeHead(405, { 'Content-Type': 'application/json' })
								response.write(JSON.stringify({error: 'Error cancelling job - 2 '}))
								response.end()
							})
						}, function(error) {
							console.log(' ERR 08 - Pickup task was not cancelled\n' + JSON.stringify(error))
							response.writeHead(405, { 'Content-Type': 'application/json' })
							response.write(JSON.stringify({error: 'Error cancelling job - 1'}))
							response.end()
						})
					}, function(error) {
						console.log(' ERR 09 - Job log could not be generated\n' + JSON.stringify(error))
						response.writeHead(405, { 'Content-Type': 'application/json' })
						response.write(JSON.stringify({error: 'Job log could not be generated'}))
						response.end()
					})
				})
			}, function(error) {
				console.log(' ERR 10 - Job could not be found\n' + JSON.stringify(error))
				response.writeHead(404, { 'Content-Type': 'application/json' })
				response.write(JSON.stringify({error: 'Job could not be found'}))
				response.end()
			})
		} else {
			console.log(' ERR 11 - Incorrect URL path format')
			response.writeHead(405, {'Content-Type': 'application/json'})
			response.write(JSON.stringify({error: 'Incorrect URL path format'}))
			response.end()
		}
	} else {
		response.sendStatus(401)
	}
})

// 3. Querying the status of a job
app.get('/Piggyback/status/*', function(request, response) {
	console.log('QUERY JOB')
	var header=request.headers['authorization']||''
	var token=header.split(/\s+/).pop()||''
	var auth=new Buffer(token, 'base64').toString()
	var parts=auth.split(/:/)
	var username=parts[0]
	var password=parts[1]

	if (username.localeCompare(yelpUser) == 0 && password.localeCompare(yelpPass) == 0) {
		var path = request.url.split('/')
		if (path.length == 4) {
			onfleet.getSingleTaskByShortID(path[3]).then(function(task) {
				console.log('Querying dropoff task - ' + taskB.shortId)
				connection.query('SELECT yelpId,workerName FROM Tasks WHERE shortId=?', [task.shortId], function(error, rows) {
					if (error) {
						console.log(' ERR 12 - Dropoff task: ' + task.shortId + ' was not found in database Tasks')
						response.writeHead(404, {'Content-Type': 'application/json'})
						response.write(JSON.stringify({error: 'Job id not found'}))
						response.end()
					}
					if (rows && rows.length) {
						if (task.worker) {
							onfleet.getSingleWorkerByID(task.worker).then(function(worker) {
								console.log('Found worker - ' + worker.name)
								if (worker.location) {
									var loc = {latitude: worker.location[1], longitude: worker.location[0]}
								} else {
									var loc = null
								}
								connection.query('SELECT statusCode, timestamp FROM JobLogs WHERE shortId=?', [task.shortId], function(error, rows2) {
									if (error) {
										console.log(' ERR 13 - Dropoff task: ' + task.shortId + ' was not found in database JobLogs')
										response.writeHead(404, {'Content-Type': 'application/json'})
										response.write(JSON.stringify({error: 'Job id not found'}))
										response.end()
									}
									if (rows2 && rows2.length) {
										writeLog(rows2, task.destination.location[1], task.destination.location[0]).then(function(log) {
											console.log('Query was successfully - \t\t\t' + (new Date()).getTime())
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
										}, function(error) {
											console.log(' ERR 14 - Job log could not be generated')
											response.writeHead(405, {'Content-Type': 'application/json'})
											response.write(JSON.stringify({error: 'Job log could not be generated'}))
											response.end()
										})
									} else {
										console.log(' ERR 15 - Dropoff task: ' + task.shortId + ' was not found in database JobLogs')
										response.writeHead(404, { 'Content-Type': 'application/json' })
										response.write(JSON.stringify({ error: 'Job id not found'}))
										response.end()
									}
								})
							}, function(error) {
								console.log(' ERR 16 - Worker: ' + task.worker + ' could not be found')
								response.writeHead(404, { 'Content-Type': 'application/json' })
								response.write(JSON.stringify({ error: 'Job id not found'}))
								response.end()
							})
						} else {
							connection.query('SELECT statusCode, timestamp FROM JobLogs WHERE shortId=?', [task.shortId], function(error, rows2) {
								if (error) {
									console.log(' ERR 17 - Dropoff task: ' + task.shortId + ' was not found in database JobLogs')
									response.writeHead(404, {'Content-Type': 'application/json'})
									response.write(JSON.stringify({error: 'Job id not found'}))
									response.end()
								}
								if (rows2 && rows2.length) {
									writeLog(rows2, task.destination.location[1], task.destination.location[0]).then(function(log) {
										console.log('Query was successfully - \t\t\t' + (new Date()).getTime())
										response.writeHead(200, {'Content-Type': 'application/json'})
										var json = JSON.stringify(
											{
												job_id: task.shortId,
												order_id: rows[0].yelpId,
												status_code: rows2[rows2.length - 1].statusCode,
												status: eat24StatusCodes[rows2[rows2.length - 1].statusCode],
												reason: eat24Reasons[rows2[rows2.length - 1].statusCode],
												log: log,
												driver: null
											}
										)
										response.end(json)	
									}, function(error) {
										console.log(' ERR 18 - Job log could not be generated')
										response.writeHead(405, {'Content-Type': 'application/json'})
										response.write(JSON.stringify({error: 'Job log could not be generated'}))
										response.end()
									})
								} else {
									console.log(' ERR 19 - Dropoff task: ' + task.shortId + ' was not found in database JobLogs')
									response.writeHead(404, { 'Content-Type': 'application/json' })
									response.write(JSON.stringify({ error: 'Job id not found'}))
									response.end()
								}
							})
						}	
					} else {
						console.log(' ERR 20 - Dropoff task: ' + task.shortId + ' was not found in database Tasks')
						response.writeHead(404, { 'Content-Type': 'application/json' })
						response.write(JSON.stringify({ error: 'Job id not found'}))
						response.end()
					}
				})
			}, function(error) {
				console.log(' ERR 21 - Job could not be found\n' + JSON.stringify(error))
				response.writeHead(404, { 'Content-Type': 'application/json' })
				response.write(JSON.stringify({error: 'Job could not be found'}))
				response.end()
			})
		} else {
			console.log(' ERR 22 - Incorrect URL path format')
			response.writeHead(400, {'Content-Type': 'application/json'})
			response.write(JSON.stringify({error: 'Incorrect URL path format'}))
			response.end()
		}
	} else {
		response.sendStatus(401)
	}
})

// 4. Reporting the status of a job
app.post('/Piggyback/webhook/taskStarted', function(request, response) {
	console.log('STATUS - taskStarted')
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		if (!task.pickupTask) {
			console.log(' Dropoff task: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'51',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log(' ERR 23 - Insert into JobLogs database was unsuccessful\n' + JSON.stringify(error))
				updateYelp(task.shortId, request, response)
				response.sendStatus(200)
			})
		} else {
			console.log(' Pickup task: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
		}
	}, function(error) {
		response.sendStatus(404)
	})
})

app.post('/Piggyback/webhook/taskEta', function(request, response) {
	console.log('STATUS - taskEta')
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		if (!task.pickupTask) {
			console.log(' Dropoff task: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'52',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log(' ERR 24 - Insert into JobLogs database was unsuccessful\n' + JSON.stringify(error))
				updateYelp(task.shortId, request, response)
				response.sendStatus(200)
			})
		} else {
			console.log(' Pickup task: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
		}
	}, function(error) {
		response.sendStatus(404)
	})
})

app.post('/Piggyback/webhook/taskArrival', function(request, response) {
	console.log('STATUS - taskArrival')
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		if (!task.pickupTask) {
			console.log(' Dropoff task: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'53',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log(' ERR 25 - Insert into JobLogs database was unsuccessful\n' + JSON.stringify(error))
				updateYelp(task.shortId, request, response)
				response.sendStatus(200)
			})
		} else {
			console.log(' Pickup task: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
		}
	}, function(error) {
		response.sendStatus(404)
	})
})

app.post('/Piggyback/webhook/taskCompleted', function(request, response) {
	console.log('STATUS - taskCompleted')
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		if (!task.pickupTask) {
			console.log(' Dropoff task: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'54',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log(' ERR 26 - Insert into JobLogs database was unsuccessful\n' + JSON.stringify(error))
				connection.query('UPDATE Tasks SET didSucceed=\'TRUE\', completionTime=? WHERE shortId=?', [(new Date()).toISOString(), task.shortId], function(error, rows) {
					if (error)
						console.log(' ERR 27 - Update Tasks database was unsuccessful\n' + JSON.stringify(error))
					updateYelp(task.shortId, request, response)
					response.sendStatus(200)
				})
			})
		} else {
			console.log(' Pickup task: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
			connection.query('UPDATE Tasks SET didSucceed=\'TRUE\', completionTime=? WHERE shortId=?', [(new Date()).toISOString(), task.shortId], function(error, rows) {
				if (error)
					console.log(' ERR 28 - Insert into JobLogs database was unsuccessful\n' + JSON.stringify(error))
				response.sendStatus(200)
			})
		}
	}, function(error) {
		response.sendStatus(404)
	})
})

app.post('/Piggyback/webhook/taskFailed', function(request, response) {
	console.log('STATUS - taskFailed')
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		if (!task.pickupTask) {
			console.log(' Dropoff task: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'55', (new Date()).getTime()], function(error, rows){
				if (error)
					console.log(' ERR 29 - Insert into JobLogs database was unsuccessful\n' + JSON.stringify(error))
				connection.query('UPDATE Tasks SET didSucceed=\'FALSE\', completionTime=? WHERE shortId=?', [(new Date()).toISOString(), task.shortId], function(error, rows) {
					if (error)
						console.log(' ERR 30 - Update Tasks database was unsuccessful\n' + JSON.stringify(error))
					updateYelp(task.shortId, request, response)
					response.sendStatus(200)
				})
			})
		} else {
			console.log(' Pickup task: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
			connection.query('UPDATE Tasks SET didSucceed=\'FALSE\', completionTime=? WHERE shortId=?', [task.shortId, (new Date()).getTime()], function(error, rows) {
				if (error)
					console.log(' ERR 31 - Update Tasks database was unsuccessful\n' + JSON.stringify(error))
				response.sendStatus(200)
			})
		}
	}, function(error) {
		response.sendStatus(404)
	})
})

app.post('/Piggyback/webhook/taskCreated', function(request, response) {
	console.log('STATUS - taskCreated')
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		if (!task.pickupTask) {
			console.log(' Dropoff task: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'40',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log(' ERR 32 - Insert into JobLogs database was unsuccessful\n' + JSON.stringify(error))
				// Do not need to update YelpEat24
				response.sendStatus(200)
			})
		} else {
			console.log(' Pickup task: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
			response.sendStatus(200)
		}
	}, function(error) {
		response.sendStatus(404)
	})
})

app.post('/Piggyback/webhook/taskAssigned', function(request, response) {
	console.log('STATUS - taskAssigned')
	setTimeout(function() {
		onfleet.getSingleTask(request.body.taskId).then(function(task) {
			if (!task.pickupTask) {
				console.log(' Dropoff task: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
				connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'50',(new Date()).getTime()], function(error, rows){
					if (error)
						console.log(' ERR 33 - Insert into JobLogs database was unsuccessful\n' + JSON.stringify(error))
					onfleet.getSingleWorkerByID(task.worker).then(function(worker) {
						console.log('Found worker - ' + worker.name)
						connection.query('UPDATE Tasks SET workerId=?, workerName=? WHERE shortId=?', [worker.id, worker.name, task.shortId], function(error, rows) {
							if (error)
								console.log(' ERR 34 - Update Tasks database was unsuccessful\n' + JSON.stringify(error))
							onfleet.getSingleTask(task.dependencies[0]).then(function(taskB) {
								worker.tasks.push(taskB.id)
								connection.query('UPDATE Tasks SET workerId=?, workerName=? WHERE shortId=?', [worker.id, worker.name, taskB.shortId], function(error, rows) {
									if (error)
										console.log(' ERR 35 - Update Tasks database was unsuccessful\n' + JSON.stringify(error))
									onfleet.updateWorkerByID(worker.id, {tasks: worker.tasks}).then(function() {
										console.log('Tasks [' + taskA.shortId + ', ' + taskB.shortId + '] were successfully assigned - \t\t\t' + (new Date()).getTime())






										updateYelp(task.shortId, request, response)
										response.sendStatus(200)
									}, function(error) {
										// DROPOFF TASK NOT ADDED TO WORKER
										console.log('did not work to update worker by id')
										console.log(error)
										console.log('End of error')
										response.writeHead(400, { 'Content-Type': 'application/json' })
										response.write(JSON.stringify(error))
										response.end()
									})
								})
							}, function(error) {
								// COULD NOT GET PICKUP TASK
								console.log('could not find dependency task')
								response.writeHead(400, { 'Content-Type': 'application/json' })
								response.write(JSON.stringify(error))
								response.end()
							})		
						})
					}, function(error) {
						// NOT AUTO ASSIGNED TO A WORKER
						console.log('could not assign task to driver ...')
						response.writeHead(403, { 'Content-Type': 'application/json' })
						response.write(JSON.stringify(error))
						response.end()
					})
				})
			} else {
				console.log(' Dropoff task: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
			}
			response.sendStatus(200)
		}, function(error) {
			response.sendStatus(404)
		})
	}, 5000)
})

// Unused webhooks
app.post('/Piggyback/webhook/workerDuty', function(request, response) {
	response.sendStatus(200)
})

app.post('/Piggyback/webhook/taskUpdated', function(request, response) {
	response.sendStatus(200)
})

app.post('/Piggyback/webhook/taskUnassigned', function(request, response) {
	response.sendStatus(200)
})

app.post('/Piggyback/webhook/taskDeleted', function(request, response) {
	response.sendStatus(200)
})

// Helper functions
function writeLog(arr, latitude, longitude) {
	return new Promise(function(resolve, reject) {
		var newArr = []
		timezone.getOffset(latitude, longitude).then(function(offset) {
			for (i = 0; i < arr.length; i++) {
				var log = arr[i]
				var status_code = log.statusCode
				var status = eat24StatusCodes[status_code]
				var reason = eat24Reasons[status_code]
				var time = log.timestamp // this is a number - convert to local with timezone, then format with timezone addition -0800
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

function getJobData(id) {
	return new Promise(function(resolve, reject) {
		onfleet.getSingleTaskByShortID(id).then(function(task) {
			connection.query('SELECT yelpId,workerName FROM Tasks WHERE shortId=?', [task.shortId], function(error, rows) {
				if (error)
					throw error
				if (rows && rows.length) {
					// get worker details
					if (task.worker) {
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
									writeLog(rows2, task.destination.location[1], task.destination.location[0]).then(function(log) {
										var result = {
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
										resolve(result)
									}, function() {
										reject('Problem with log file')
									})
								} else {
									reject('Task not found in database')
								}
							})
						}, function(error) {
							reject(error)
						})
					} else {
						connection.query('SELECT statusCode, timestamp FROM JobLogs WHERE shortId=?', [task.shortId], function(error, rows2) {
							if (error)
								throw error
							if (rows2 && rows2.length) {
								writeLog(rows2, task.destination.location[1], task.destination.location[0]).then(function(log) {
									var result = {
										job_id: task.shortId,
										order_id: rows[0].yelpId,
										status_code: rows2[rows2.length - 1].statusCode,
										status: eat24StatusCodes[rows2[rows2.length - 1].statusCode],
										reason: eat24Reasons[rows2[rows2.length - 1].statusCode],
										log: log,
										driver: null
									}
									resolve(result)
								}, function() {
									reject('Problem with log file')
								})
							} else {
								reject('Task not found in database')
							}
						})
					}
					
				} else {
					reject('Task not found in database')
				}
			})
		}, function(error) {
			reject(error)
		})
	})
}

function updateYelp(id, request, response) {
	console.log('Updating Yelp with updateYelp function - id - ' + id)
	getJobData(id).then(function(job) {
		console.log(job)
		// response.sendStatus(200)
		yelp.postUpdate(job).then(function(result) {
			console.log('successfully posted to Yelp ' + id)
			response.sendStatus(200)
		}, function(error1) {
			console.log('unsuccessfully posted to Yelp ' + id)
			response.sendStatus(404)
		})
	}, function(error2) {
		response.sendStatus(404)
	})
}

// OTHER
app.post('/Piggyback', function(request, response) {
	// Parsing basic authorization sent in post request
	var header=request.headers['authorization']||''
	var token=header.split(/\s+/).pop()||''
	var auth=new Buffer(token, 'base64').toString()
	var parts=auth.split(/:/)
	var username=parts[0]
	var password=parts[1]

	if (username.localeCompare(yelpUser) == 0 && password.localeCompare(yelpPass) == 0) {
		response.writeHead(200, { 'Content-Type': 'application/json' })
		response.write('OK')
		response.end()
	} else {
		response.sendStatus(401)
	}
})

// SITE
app.get('/Piggyback', function(request, response) {
	if (request.session.loggedin) {
		onfleet.listTasks().then(function(tasks) {
			response.render('tasks', {pageTitle: 'Piggyback Technologies', tasks: tasks, username: request.session.username})
		}, function(error) {
			response.render('error', {pageTitle: 'Error', errors: [JSON.stringify(error)]})
		})
	} else {
		response.render('signin', {pageTitle: 'Sign in'})
	}
})

app.get('/Piggyback/export', function(request, response) {
	if (request.session.loggedin) {
		response.render('export', {pageTitle: 'Export'})
	} else {
		response.render('signin', {pageTitle: 'Sign in'})
	}
})

app.post('/Piggyback/export', function(request, response) {
	if (request.session.loggedin) {
		var timeA = new Date(request.body.start_time).getTime()
		var timeB = new Date(request.body.end_time).getTime()
		var dateStrA = (new Date(timeA)).toISOString()
		var dateStrB = (new Date(timeB)).toISOString()
		
		var query = 'shortId, driverTip, taskType, workerName, destination, completionTime, didSucceed'
		connection.query('SELECT ' + query + ' FROM Tasks WHERE completeAfter >= ? && completeAfter <= ? && company = ? ORDER BY ' + request.body.order, [dateStrA, dateStrB, request.body.company, request.body.order], function(error, rows) {
			if (error)
				throw error
			if (rows && rows.length) {
				var arr = []
				for (i = 0; i < rows.length; i++) {
					arr.push(rows[i])
				}
				response.render('export', {pageTitle: 'Export', headers: query, arr: arr, test: '', start_time: dateStrA.substr(0, 16), end_time: dateStrB.substr(0, 16), company: request.body.company, sort: request.body.sort})
			} else {
				response.render('export', {pageTitle: 'Export', headers: query, arr: [], test: 'No data available for selected times', start_time: dateStrA.substr(0, 16), end_time: dateStrB.substr(0, 16), company: request.body.company, sort: request.body.sort})
			}
		})
	} else {
		response.render('signin', {pageTitle: 'Sign in'})
	}
})

// SIGNUP
app.get('/Piggyback/signup', function(request, response) {
	response.render('signup', {pageTitle: 'Sign up'})
})

app.post('/Piggyback/signup', function(request, response) {
	var username = request.body.username
	var firstname = request.body.firstname
	var lastname = request.body.lastname
	var phone = request.body.phone
	phone = phone.replace(/\D/g, '');
	var password = request.body.password
	var password2 = request.body.password2
	var key = request.body.key

	if (key.localeCompare(signupKey) != 0) {
		response.render('signup', {pageTitle: 'Sign up', errors: [signupKey, key, 'Incorrect sign up key. Please contact Noah for a key to sign up'], username: username, firstname: firstname, lastname: lastname, phone: phone})
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
	if (!(phone.length == 10))
		errors.push('Phone numbers must be 10 numbers in length')
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
				request.session.loggedin = true
				request.session.username = username
				response.render('success', {pageTitle: 'Success', message: 'You have successfully signed up'})
			}
		)
	})
})

// SIGNIN
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
		if (rows && rows.length) {
			request.session.loggedin = true
			request.session.username = username
			response.redirect('/Piggyback')
			return
		} else {
			response.render('signin', {pageTitle: 'Sign in', errors: ['Incorrect username or password'], username: username})
		}
	})
})

app.get('/Piggyback/logout', function(request, response) {
	request.session.destroy(function(error) {
		if (error) {
			throw error
		} else {
			response.redirect('/Piggyback')
		}
	})
})

app.post('/Piggyback/download', function(request, response) {
	if (request.session.loggedin) {
		// Generates a log file, then downloads it
		fs.readdir('/tmp', function (err, files) {
			if (err)
				throw err
			var max = 0
			for (var index in files) {
				if (files[index].includes('Piggyback_log')) {
					var num = (parseInt(files[index].substr(13, (files[index].indexOf('.')) - 13)))
					if (num > max)
						max = num
				}
			}
			var file = "'/tmp/Piggyback_log" + (max + 1) + ".csv'"
			var query = "(SELECT 'shortId','taskId','yelpId','company','driverTip','taskType','completeAfter','completeBefore','workerId','workerName','destination','completionTime','didSucceed') ";
			query = query + "UNION ALL (SELECT shortId,taskId,yelpId,company,driverTip,taskType,completeAfter,completeBefore,workerId,workerName,destination,completionTime,didSucceed FROM Tasks ";
			query = query + "WHERE completeAfter >= '" + request.body.start_time + "' && completeAfter <= '" + request.body.end_time + "' && company = '" + request.body.company + "' ORDER BY shortId ";
			query = query + "INTO OUTFILE " + file + " FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '\"' LINES TERMINATED BY '\n')"

			connection.query(query, function(error, rows) {
				if (error)
					throw error
				file = file.substr(1, file.length - 2)
				var filename = path.basename(file)
				var mimetype = mime.lookup(file)

				response.setHeader('Content-disposition', 'attachment; filename=' + filename)
				response.setHeader('Content-type', mimetype)

				var filestream = fs.createReadStream(file)
				filestream.pipe(response)
			})
		})
	} else {
		response.render('signin', {pageTitle: 'Sign in'})
	}
})

http.listen(8080, '127.0.0.1', function() {
	// console.log('listening on port 8080')
})
