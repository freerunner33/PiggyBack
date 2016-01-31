
var apiKey = require('./keys.js').timezoneKey

var Promise = require('promise')
var https = require('https')

var hostname = 'maps.googleapis.com'
var path = '/maps/api/timezone/json'

// https://maps.googleapis.com/maps/api/timezone/json?location=39.6034810,-119.6822510&timestamp=1331161200&key=AIzaSyC1DXxAHKBW10zZ3W1bYJhJpPv9cgtlDoM
function request(method, data) {
	return new Promise(function(resolve, reject) {
		var request = https.request({
			hostname: hostname,
			path: path + '?location=' + data.latitude + ',' + data.longitude + '&timestamp=' + data.timestamp + '&key=' + apiKey,

			// + data.latitude + ',' + data.longitude + '&timestamp=' + data.timestamp + '&key=' + apiKey,
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

function getTimeZone() {
	return request('GET', {latitude: '39.6034810', longitude: '-119.6822510', timestamp: '1331766000', key: apiKey})
}

module.exports = {getTimeZone: getTimeZone}
