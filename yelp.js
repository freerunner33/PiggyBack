
var apiKey = require('./keys.js').yelpAPIKey

var Promise = require('promise')
var https = require('https')
// https://eat24hours.com/dprovider/status?key= {key}

var request = require('request');

function postUpdate(data) {
	return new Promise(function(resolve, reject) {
		request.post(
		    'https://e24beta.com/dprovider/status/?key=wuJzjPFT5sE33Vu1iy5yudYy2uHhZoMz',
		    {
		    	form: data,
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
		);
	})
}

module.exports = {postUpdate: postUpdate}
