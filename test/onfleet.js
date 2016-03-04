
var Promise = require('promise')
var https = require('https')

var hostname = 'onfleet.com'
var path = '/api/v2/'
var onfleetApiKey = require('./keys.js').onfleetApiKey

function request(endpoint, method, data) {
	return new Promise(function(resolve, reject) {
		var request = https.request({
			hostname: hostname,
			path: path + endpoint,
			method: method,
			auth: onfleetApiKey
		}, function(response) {
			var str = ''
			response.on('data', function(chunk) {
				str += chunk
			})
			response.on('end', function() {
				var result
				if (str.length)
					result = JSON.parse(str)	
				if (response.statusCode != 200)
					reject(result)
				else
					resolve(result)
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
function getOrganizationDetails() {
	return request('organization', 'GET')
}
function getDelegateeDetails(id) {
	return request('organizations/' + id, 'GET')
}

// ADMINISTRATORS
function createAdministrator(name, email, phone, isReadOnly) {
	return request('admins', 'POST', {'name': name, 'email': email, 'phone': phone, 'isReadOnly': isReadOnly})
}
function listAdministrators() {
	return request('admins', 'GET')
}
function updateAdministrator(id, data) {
	return request('admins/' + id, 'PUT', data)
}
function deleteAdministrator(id) {
	return request('admins/' + id, 'DELETE')
}

// WORKERS
function createNewWorker(name, phone, teams, vehicle) {
	return request('workers', 'POST', {name: name, phone: phone, teams: teams, vehicle: vehicle})
}
function listWorkers(filter, teams, states) {
	var queryString = '?'
	if (filter)
		queryString += '&filter=' + filter
	if (teams)
		queryString += '&teams=' + teams
	if (states)
		queryString += '&states' + states
	return request('workers' + queryString, 'GET', data)
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
function createNewTask(merchant, executor, destination, recipients, completeAfter, completeBefore, pickupTask, dependencies, notes, autoAssign) {
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
			dependencies: dependencies,
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
function getSingleTaskByShortID(id) {
	return request('tasks/shortId/' + id, 'GET')
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
	getSingleTaskByShortID: getSingleTaskByShortID,
	updateTask: updateTask,
	completeTask: completeTask,
	deleteTask: deleteTask,

	createWebHook: createWebHook,
	listWebHooks: listWebHooks,
	deleteWebHook: deleteWebHook
}
