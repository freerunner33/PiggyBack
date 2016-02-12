
var apiKey = require('./keys.js').timezoneKey

var Promise = require('promise')
var https = require('https')

var hostname = 'maps.googleapis.com'
var path = '/maps/api/timezone/json'

function request(method, data) {
	return new Promise(function(resolve, reject) {
		var request = https.request({
			hostname: hostname,
			path: path + '?location=' + data.latitude + ',' + data.longitude + '&timestamp=' + data.timestamp + '&key=' + apiKey,
			method: method
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

function getTimeZone(lat, lon) {
	getTime().then(function(time) {
		return request('GET', {latitude: lat, longitude: lon, timestamp: time, key: apiKey})
	}, function(error) {
		return error
	})	
}

function getTime() {
	return new Promise(function(resolve, reject) {
		var time = new Date()
		if (time)
			resolve(time.getTime())
		else
			reject(1455292837149)
	})
}

function getOffset(lat, lon) {
	return new Promise(function(resolve, reject) {
		getTimeZone(lat, lon, (new Date()).getTime()).then(function(timezone) {
			var offsetStr = timezone.rawOffset/36
			if (offsetStr > -1000 && offsetStr < 1000)
				if (offsetStr < 0)
					offsetStr = '-0' + ('' + offsetStr).substring(1)
				else
					offsetStr = '0' + offsetStr
			if (offsetStr >= 0) 
				offsetStr = '+' + offsetStr
			offsetStr = offsetStr.substring(0, 5)
			resolve(
				{
					number: timezone.rawOffset,
					string: offsetStr
				}
			)
		}, function(error) {
			reject(error)
		})
	})
}

module.exports = {
	getTimeZone: getTimeZone,
	getOffset: getOffset
}
