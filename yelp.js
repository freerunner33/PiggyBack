
var apiKey = require('./keys.js').yelpAPIKey

var Promise = require('promise')
var http = require('http')
// https://eat24hours.com/dprovider/status?key= {key}

var request = require('request');

function postUpdate(data) {
	return new Promise(function(resolve, reject) {
		request.post(
		    'https://e24beta.com/dprovider/status',
		    {
		    	form: data,
		    	qs: {
		    		key: apiKey
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

module.exports = {postUpdate: postUpdate}
