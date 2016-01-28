
var apiKey = require('./keys.js').apiKey

var Promise = require('promise')
var https = require('https')

var hostname = 'onfleet.com'
var path = '/api/v2/'

function request(endpoint, method, data) {
	return new Promise(function(resolve, reject) {
		var request = https.request({
			hostname: hostname,
			path: path + endpoint,
			method: method,
			auth: apiKey
		}, function(response) {
			var str = ''
			response.on('data', function(chunk) {
				str += chunk
			})
			response.on('end', function() {
				var result
				if (str.length)
					result = JSON.parse(str)
				
				if (response.statusCode != 200) {
					reject(result)
				}
				else {
					resolve(result)
				}
			})
		})
		request.on('error', function(error) {
			reject(error)
		})
		if (data)
			request.write(JSON.stringify(data))
		request.end()
	})
}

// ORGANIZATIONS
// A delegatee is an organization to which the current organization is able to assign tasks.
function getOrganizationDetails() {
	return request('organization', 'GET')
}
function getDelegateeDetailsByID(id) {
	return request('organizations/' + id, 'GET')
}
function getDelegateeDetailsByName(name) {
	return new Promise(function(resolve, reject) {
		getDetails().then(function(organization) {
			for (var i = 0; i < organization.delegatees.length; ++i) {
				request('organizations/' + organization.delegatees[i], 'GET').then(function(delegatee) {
					if (delegatee.name.localeCompare(name) == 0) {
						getDelegateeDetailsByID(delegatee.id).then(function(delegatee) {
							resolve(delegatee)
						}).catch(function(error) {
							reject(error)
						})
					}
				})
			}
		}).catch(function(error) {
			reject(error)
		})
	})
}

// ADMINISTRATORS
// When a new administrator is created, an email will be sent to confirm and configure their account
function createNewAdministrator(name, email, phone, vehicle) {
	return request('workers', 'POST', {'name': name, 'email': email, 'phone': phone})
}
function listAdministrators() {
	return request('admins', 'GET')
}
function updateAdministratorByID(id, data) {
	return request('admins/' + id, 'PUT', data)
}
function deleteAdministratorByID(id) {
	return request('admins/' + id, 'DELETE')
}

// WORKERS
function createNewWorker(name, phone, teams, vehicle) {
	return request('workers', 'POST', {name: name, phone: phone, teams: teams, vehicle: vehicle})
}
function listWorkers(data) {
	console.log(JSON.stringify(data))
	return request('workers', 'GET', data)
}
function getSingleWorkerByID(id) {
	return request('workers/' + id, 'GET')
}
function updateWorkerByID(id, data) {
	return request('workers/' + id, 'PUT', data)
}
function deleteWorkerByID(id) {
	return request('workers/' + id, 'DELETE')
}

// TEAMS
// Teams must be created, updated and deleted via the dashboard.
function listTeams() {
	return request('teams', 'GET')
}
function getSingleTeamByID(id) {
	return request('teams/' + id, 'GET')
}
function getSingleTeamByName(name) {
	return new Promise(function(resolve, reject) {
		listTeams().then(function(teams) {
			for (var i = 0; i < teams.length; ++i) {
				if ((teams[i].name).localeCompare(name) == 0)
					getSingleTeamByID(teams[i].id).then(function(team) {
						resolve(team)
					}).catch(function(error) {
						reject(error)
					})
			}
		}).catch(function(error) {
			reject(error)
		})
	})
}

// DESTINATIONS
	// address = {name, *number, *street, apartment, *city, state, postalCode, *country, unparsed}
function createNewDestination(address) {
	return request('destinations', 'POST', {address: address})
}
function getDestinationByID(id) {
	return request('destinations/' + id, 'GET')
}
function listDestinationsByID(arr) {
	return new Promise(function(resolve, reject) {
		Promise.all(
			[
				getDestinationByID(arr[0]),
				getDestinationByID(arr[1]),
				getDestinationByID(arr[2])
			]
		).then(function(values) {
			console.log(values)
			resolve('It worked')
		}, function(error) {
			reject('Error\n' + error)
		})
	})
}

// RECIPIENTS
	// cannot be deleted once created
function createNewRecipient(name, phone, notes, skipSMSNotifications, skipPhoneNumberValidation) {
	return request(
		'recipients', 
		'POST', 
		{
			name: name, 
			phone: phone, 
			notes: notes,
			skipSMSNotifications: skipSMSNotifications,
			skipPhoneNumberValidation: skipPhoneNumberValidation
		}
	)
}
function updateRecipientByID(id, data) {
	return request('recipients/' + id, 'PUT', data)
}
function findRecipientByName(name) {
	return request('recipients/name/' + name, 'GET')
}
function findRecipientByPhone(phone) {
	return request('recipients/phone/' + phone, 'GET')
}
function getSingleRecipient(id) {
	return request('recipients/' + id, 'GET')
}

// TASKS
	// state = (0: unassigned, 1: assigned, 2: active, 3: completed)
function createNewTask(merchant, executor, destination, recipients, completeAfter, completeBefore, pickupTask, dependendencies, notes, autoAssign) {
	return request(
		'tasks', 
		'POST', 
		{
			merchant: merchant,
			executor: executor,
			destination: destination,
			recipients: recipients,
			completeAfter: completeAfter,
			completeBefore: completeBefore,
			pickupTask: pickupTask,
			dependendencies: dependendencies,
			notes: notes,
			autoAssign: autoAssign
		}
	)
}
function listTasks() {
	return request('tasks', 'GET')
}
function getSingleTask(id) {
	return request('tasks/' + id, 'GET')
}
function updateTask(id, data) {
	return request('tasks/' + id, 'PUT', data)
}
function completeTask(id, success) {
	return request('tasks/' + id + '/complete', 'POST', {success: success})
}
function deleteTask(id) {
	return request('tasks/' + id, 'DELETE')
}

// WEBHOOKS
function createWebHook(url, trigger) {
	return request('webhooks', 'POST', {url: url, trigger: trigger})
}
function listWebHooks() {
	return request('webhooks', 'GET')
}
function deleteWebHook(id) {
	return request('webhooks/' + id, 'DELETE')
}
module.exports = {
	getOrganizationDetails: getOrganizationDetails, 
	getDelegateeDetailsByID: getDelegateeDetailsByID,
	getDelegateeDetailsByName: getDelegateeDetailsByName,

	createNewAdministrator: createNewAdministrator,
	listAdministrators: listAdministrators,
	updateAdministratorByID: updateAdministratorByID,
	deleteAdministratorByID: deleteAdministratorByID,

	createNewWorker: createNewWorker,
	listWorkers: listWorkers,
	getSingleWorkerByID: getSingleWorkerByID,
	updateWorkerByID: updateWorkerByID,
	deleteWorkerByID: deleteWorkerByID,

	createNewDestination: createNewDestination,
	getDestinationByID: getDestinationByID,
	listDestinationsByID: listDestinationsByID,

	listTeams: listTeams, 
	getSingleTeamByID: getSingleTeamByID,
	getSingleTeamByName: getSingleTeamByName,

	createNewRecipient: createNewRecipient,
	updateRecipientByID: updateRecipientByID,
	findRecipientByName: findRecipientByName,
	findRecipientByPhone: findRecipientByPhone,
	getSingleRecipient: getSingleRecipient,

	createNewTask: createNewTask,
	listTasks: listTasks,
	getSingleTask: getSingleTask,
	updateTask: updateTask,
	completeTask: completeTask,
	deleteTask: deleteTask,

	createWebHook: createWebHook,
	listWebHooks: listWebHooks,
	deleteWebHook: deleteWebHook
}
