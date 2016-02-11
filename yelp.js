
var apiKey = require('./keys.js').yelpAPIKey

var Promise = require('promise')
var http = require('http')
// https://eat24hours.com/dprovider/status?key= {key}
// var hostname = 'eat24hours.com'
// var path = '/dprovider/'

// curl -X POST -d "fizz=buzz" http://requestb.in/1bluatq1
var host = 'requestb.in'
var path = '/1bluatq1'

var request = require('request');


function request(endpoint, method, data) {
	return new Promise(function(resolve, reject) {
		request.post(
		    'http://requestb.in/1bluatq1',
		    { form: { key: 'value' } },
		    function (error, response, body) {
		    	if (error) {
		    		reject(error)
		    	}
		        if (!error && response.statusCode == 200) {
		            resolve(body)
		        }
		    }
		);
	})
}

function postUpdate(data) { // data will be json object
	return request('', 'POST', data)
}

module.exports = {postUpdate: postUpdate}
