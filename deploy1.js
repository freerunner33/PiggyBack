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
	var dateFormat = require('dateformat')
	var httpClient = require('http')
	var multer = require('multer')

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
	response.sendStatus(200)
})

// 1. Creating a new job
app.post('/Piggyback/jobs', function(request, response) {
	var header=request.headers['authorization']||''
	var token=header.split(/\s+/).pop()||''
	var auth=new Buffer(token, 'base64').toString()
	var parts=auth.split(/:/)
	var username=parts[0]
	var password=parts[1]

	if (username == yelpUser && password == yelpPass) {
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
			timezone.getTimeZone(j.dropoff_waypoint.location.latitude, j.dropoff_waypoint.location.longitude).then(function(timezone) {
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
									if (error) {
										console.log('TaskA: ' + taskA.id + ' was not added to database')
										throw error
									}
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
												if (error) {
													console.log('TaskB ' + taskB.id + ' was not added to database')
													throw error
												}
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
	} else {
		response.sendStatus(401)
	}
})

// 2. Deleting a job
app.delete('/Piggyback/jobs/*', function(request, response) {
	var header=request.headers['authorization']||''
	var token=header.split(/\s+/).pop()||''
	var auth=new Buffer(token, 'base64').toString()
	var parts=auth.split(/:/)
	var username=parts[0]
	var password=parts[1]

	if (username == yelpUser && password == yelpPass) {
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
						response.write(JSON.stringify({error: 'Task could not be deleted. - delete1'}))
						response.end()
					})
				}, function(error) {
					response.writeHead(405, { 'Content-Type': 'application/json' })
					response.write(JSON.stringify({error: 'Task could not be deleted. - delete2'}))
					response.end()
				})
			}, function(error) {
				response.writeHead(404, { 'Content-Type': 'application/json' })
				response.write(JSON.stringify({error: 'Job id not found. - delete3'}))
				response.end()
			})
		}
	} else {
		response.sendStatus(401)
	}
})

// Querying the status of a job
app.get('/Piggyback/jobs/*', function(request, response) {
	var header=request.headers['authorization']||''
	var token=header.split(/\s+/).pop()||''
	var auth=new Buffer(token, 'base64').toString()
	var parts=auth.split(/:/)
	var username=parts[0]
	var password=parts[1]

	if (username == yelpUser && password == yelpPass) {
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
									response.write(JSON.stringify({ error: 'Task not found in database - query1'}))
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
						response.write(JSON.stringify({ error: 'Task not found in database - query2'}))
						response.end()
					}
				})
			}, function(error) {
				response.writeHead(400, { 'Content-Type': 'application/json' })
				response.write(JSON.stringify(error))
				response.end()
			})
		}
	} else {
		response.sendStatus(401)
	}
})

// 4. Reporting the status of a job
app.post('/Piggyback/webhook/taskStarted', function(request, response) {
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		console.log('taskStarted: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
		if (!task.pickupTask) {
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'51',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log('ERROR - query\n' + error)
				updateYelp(task.shortId, request, response)
			})
		}
		response.sendStatus(200)
	}, function(error) {
		response.sendStatus(404)
	})
})

app.post('/Piggyback/webhook/taskEta', function(request, response) {
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		console.log('taskEta: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
		if (!task.pickupTask) {
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'52',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log('ERROR - query\n' + error)
				updateYelp(task.shortId, request, response)
			})
		}
		response.sendStatus(200)
	}, function(error) {
		response.sendStatus(404)
	})
})

app.post('/Piggyback/webhook/taskArrival', function(request, response) {
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		console.log('taskArrival: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
		if (!task.pickupTask) {
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'53',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log('ERROR - query\n' + error)
				updateYelp(task.shortId, request, response)
			})
		}
		response.sendStatus(200)
	}, function(error) {
		response.sendStatus(404)
	})
})

app.post('/Piggyback/webhook/taskCompleted', function(request, response) {
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		console.log('taskCompleted: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
		if (!task.pickupTask) {		// Must be dropoff task
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'54',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log('ERROR (INSERT JobLogs) - query - taskCompleted\n' + error)
				connection.query('UPDATE Tasks SET didSucceed=\'TRUE\', completionTime=? WHERE shortId=?', [(new Date()).toISOString(), task.shortId], function(error, rows) {
					if (error)
						console.log('ERROR UPDATING - dropoff\n' + error)
					updateYelp(task.shortId, request, response)
				})
			})
		} else {
			connection.query('UPDATE Tasks SET didSucceed=\'TRUE\', completionTime=? WHERE shortId=?', [(new Date()).toISOString(), task.shortId], function(error, rows) {
				if (error)
					console.log('ERROR UPDATING - pickup\n' + error)
			})
		}
		response.sendStatus(200)
	}, function(error) {
		response.sendStatus(404)
	})
})

app.post('/Piggyback/webhook/taskFailed', function(request, response) {
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		console.log('taskFailed: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
		if (!task.pickupTask) {
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [(new Date()).toISOString(), task.shortId,'55'], function(error, rows){
				if (error)
					console.log('ERROR (INSERT JobLogs) - query - taskFailed\n' + error)
				connection.query('UPDATE Tasks SET didSucceed=\'FALSE\', completionTime=? WHERE shortId=?', [(new Date()).toISOString(), task.shortId], function(error, rows) {
					if (error)
						console.log('ERROR (UPDATE Tasks) - dropoff\n' + error)
					updateYelp(task.shortId, request, response)
				})
			})
		} else {
			connection.query('UPDATE Tasks SET didSucceed=\'FALSE\', completionTime=? WHERE shortId=?', [task.shortId, (new Date()).getTime()], function(error, rows) {
				if (error)
					console.log('ERROR (UPDATE, Tasks) - pickup\n' + error)
				updateYelp(task.shortId, request, response)
			})
		}
		response.sendStatus(200)
	}, function(error) {
		response.sendStatus(404)
	})
})

app.post('/Piggyback/webhook/taskCreated', function(request, response) {
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		console.log('taskCreated: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
		if (!task.pickupTask) {
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'40',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log('ERROR - query\n' + error)
				// updateYelp(task.shortId, request, response)
				response.sendStatus(200)
			})
		} else {
			response.sendStatus(200)
		}
	}, function(error) {
		response.sendStatus(404)
	})
})

app.post('/Piggyback/webhook/taskDeleted', function(request, response) {
	response.sendStatus(200)
	// onfleet.getSingleTask(request.body.taskId).then(function(task) {
	// 	console.log('taskDeleted: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
	// 	if (!task.pickupTask) {
	// 		connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'42',(new Date()).getTime()], function(error, rows){
	// 			if (error)
	// 				console.log('ERROR - query\n' + error)
	// 			updateYelp(task.shortId, request, response)
	// 		})
	// 	}
	// 	response.sendStatus(200)
	// }, function(error) {
	// 	response.sendStatus(200) // task not found, try again in 30 minutes
	// })
})

app.post('/Piggyback/webhook/taskAssigned', function(request, response) {
	onfleet.getSingleTask(request.body.taskId).then(function(task) {
		console.log('taskAssigned: ' + task.shortId + '\t' + request.body.time + '\t' + (new Date()).getTime())
		if (!task.pickupTask) {
			connection.query('INSERT INTO JobLogs (shortId, statusCode, timestamp) VALUES (?,?,?)', [task.shortId,'50',(new Date()).getTime()], function(error, rows){
				if (error)
					console.log('ERROR - query\n' + error)
				updateYelp(task.shortId, request, response)
			})
		}
		response.sendStatus(200)
	}, function(error) {
		response.sendStatus(404)
	})
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

// Helper functions
function writeLog(arr, latitude, longitude) {
	return new Promise(function(resolve, reject) {
		var newArr = []
		timezone.getOffset(latitude, longitude).then(function(offset) {
			for (i = 0; i < arr.length; i++) {
				log = arr[i]
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
					reject('Task not found in database')
				}
			})
		}, function(error) {
			reject(error)
		})
	})
}

function updateYelp(id, request, response) {
	getJobData(id).then(function(job) {
		console.log('Updated Yelp')
		console.log(job)
		yelp.postUpdate(job).then(function(result) {
			response.sendStatus(200)
		}, function(error1) {
			response.sendStatus(404)
		})
	}, function(error2) {
		response.sendStatus(404)
	})
}

// OTHER

app.get('/Piggyback', function(request, response) {
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
})

app.post('/Piggyback', function(request, response) {
	// Parsing basic authorization sent in post request
	var header=request.headers['authorization']||''
	var token=header.split(/\s+/).pop()||''
	var auth=new Buffer(token, 'base64').toString()
	var parts=auth.split(/:/)
	var username=parts[0]
	var password=parts[1]

	if (username == yelpUser && password == yelpPass) {
		response.writeHead(200, { 'Content-Type': 'text/plain' })
		response.write('\nSuccess!\n')
		response.end()
	} else {
		response.writeHead(401, { 'Content-Type': 'text/plain' })
		response.write('Incorrect credentials\n' + username + ':' + yelpUser + '\n' + password + ':' + yelpPass + '\n')
		response.end()
	}
})



http.listen(8080, '127.0.0.1', function() {
	// console.log('listening on port 8080')
})