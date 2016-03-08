// var index = require('./index.js')

app.get('/', function(request, response) {
	response.render('index', {pageTitle: 'Home'})
})