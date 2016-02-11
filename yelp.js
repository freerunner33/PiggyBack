
var apiKey = require('./keys.js').yelpAPIKey

var Promise = require('promise')
var http = require('http')
// https://eat24hours.com/dprovider/status?key= {key}
// var hostname = 'eat24hours.com'
// var path = '/dprovider/'

// curl -X POST -d "fizz=buzz" http://requestb.in/1bluatq1
var hostname = 'requestb.in'
var path = '/1bluatq1'

function request(endpoint, method, data) {
	return new Promise(function(resolve, reject) {
		var request = http.request({
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

function postUpdate(data) { // data will be json object
	return request('', 'POST', data)
}

module.exports = {postUpdate: postUpdate}
