
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

function postUpdate(data) {
	return new Promise(function(resolve, reject) {
		request.post(
		    'http://requestb.in/1bluatq1',
		    {
		    	body: {
		    		data: {
			    		"job_id":"675e8eed","order_id":"123example456id",
			    		"status_code":"54","status":"done_delivered",
			    		"reason":"Job has been delivered by driver."
			    	}
		    	},
		    	form: {
		    		key: 'value'
		    	} 
		    },
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

function postUpdate2(data) {
	return new Promise(function(resolve, reject) {
		request.post(
		    'http://noahthomas.us/test',
		    {
		    	body: {
		    		data: {
			    		"job_id":"675e8eed","order_id":"123example456id",
			    		"status_code":"54","status":"done_delivered",
			    		"reason":"Job has been delivered by driver."
			    	}
		    	},
		    	form: {
		    		key: 'value'
		    	} 
		    },
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

module.exports = {postUpdate: postUpdate, postUpdate2: postUpdate2}
