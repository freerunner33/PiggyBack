
var apiKey = require('./keys.js').yelpAPIKey

var Promise = require('promise')
var http = require('http')
// https://eat24hours.com/dprovider/status?key= {key}
// var hostname = 'eat24hours.com'
// var path = '/dprovider/'

// curl -X POST -d "fizz=buzz" http://requestb.in/1bluatq1
var host = 'requestb.in'
var path = '/1bluatq1'

function request(endpoint, method, data) {
	return new Promise(function(resolve, reject) {
		var request = http.request({
			host: 'requestb.in',
			port: '80',
			path: '/1bluatq1',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
		        'Content-Length': Buffer.byteLength(data)
		    }
		}, function(response) {
			response.setEncodings('utf8')
			response.on('data', function(chunk) {
				console.log('Response: ' + chunk)
			})
		})
		request.write(data)
		request.end()
	})
}

function postUpdate(data) { // data will be json object
	return request('', 'POST', data)
}

module.exports = {postUpdate: postUpdate}
