var index = require('./index.js')
var app = index.app

app.get('/', function(request, response) {
	response.render('index', {pageTitle: 'Home'})
})
