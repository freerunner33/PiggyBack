
/**
	This file is used for posting to any business partner
	Need to access partnerData
		url to post to
		key to use to access
**/

var keys = require('./keys.js')

var Promise = require('promise')
var https = require('https')
var request = require('request')

// This function takes in the partner's name, and the data to send (usually a job log)
// 		For example - postUpdate('YelpEat24', joblog)
//		The url and key can be accessed by keys[partner].url and keys[partner].key
function postUpdate(partner, data) {
	return new Promise(function(resolve, reject) {
		request.post(
			keys[partner].url + '?key=' + keys[partner].key,
		    {
		    	body: data,
		    	json: true
		    },
		    function (error, response, body) {
		    	if (error)
		    		reject(error)
		        if (!error && response.statusCode == 200)
		            resolve(JSON.stringify(response))
		    }
		)
	})
}

module.exports = {postUpdate: postUpdate}
