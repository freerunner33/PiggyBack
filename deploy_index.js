
//	1. Creating a new job: 
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

	if (checkWayPoint(j.pickup_waypoint, true) && checkWayPoint(j.dropoff_waypoint, false)) {
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
	}
	response.writeHead(400, { 'Content-Type': 'application/json' })
	response.write(JSON.stringify({error: 'Missing some variable'}))
	response.end()
})

function checkWayPoint(wp, pickup) {
	if (wp && wp.address && wp.city && wp.state && wp.zip && wp.name && wp.phone && wp.location)
		if (pickup)
			if (wp.arrive_at)
				return true
			else
				return true
	return false
} 

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
