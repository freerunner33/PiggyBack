
var apiKey = require('./keys.js').YelpAPIKey

var Promise = require('promise')
var https = require('https')

var request = require('request')

function postUpdate(data) {
	return new Promise(function(resolve, reject) {
		resolve('Success - test')
		// request.post(
		// 	'https://eat24hours.com/dprovider/status?key=' + apiKey,
		//     {
		//     	body: data,
		//     	json: true
		//     },
		//     function (error, response, body) {
		//     	if (error) {
		//     		reject(error)
		//     	}
		//         if (!error && response.statusCode == 200) {
		//             resolve(JSON.stringify(response))
		//         }
		//     }
		// )
	})
}

module.exports = {postUpdate: postUpdate}
