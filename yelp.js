
var apiKey = require('./keys.js').YelpAPIKey

// changed the post url to append the api key. If doesn't work, just put key in file and remove from github

var Promise = require('promise')
var https = require('https')

var request = require('request')

function postUpdate(data) {
	return new Promise(function(resolve, reject) {
		request.post(
			'https://eat24hours.com/dprovider/status?key=' + apiKey,
		    {
		    	body: data,
		    	json: true
		    },
		    function (error, response, body) {
		    	if (error) {
		    		reject(error)
		    	}
		        if (!error && response.statusCode == 200) {
		            resolve(JSON.stringify(response))
		        }
		    }
		)
	})
}

module.exports = {postUpdate: postUpdate}
