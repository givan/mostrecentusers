var express = require('express');
var redis = require('redis');
var db = redis.createClient();
var app = express();

app.use(express.logger());

// Next up is the middleware for tracking online users. Here we'll use sorted sets so that we can query redis for the users online within the last N milliseconds. We do this by passing a timestamp as the member's "score". Note that here we're using the User-Agent string in place of what would normally be a user id.
app.use(function(req, res, next){
  var ua = req.headers['user-agent'];
  // console.log("Request: %j", req);
  db.zadd('online', Date.now(), ua, next);
});

// This next middleware is for fetching the users online in the last minute using zrevrangebyscore to fetch with a positive infinite max value so that we're always getting the most recent users, capped with a minimum score of the current timestamp minus 60,000 milliseconds.
app.use(function(req, res, next){
  var min = 60 * 1000;
  var ago = Date.now() - min;
  db.zrevrangebyscore('online', '+inf', ago, function(err, users){
    if (err) return next(err);
    req.online = users;
    next();
  });
});

app.use(logErrors);
app.use(clientErrorHandler);
app.use(errorHandler);
 
 app.get('/', function(req, res){
  res.send(req.online.length + ' users online');
});

// app.param('id', /^\d+$/);

app.get('/user/:id', function(req, res){
  res.send('user ' + req.params.id);
});

app.listen(8150);
console.log('Listening on port 8150...');

function logErrors(err, req, res, next) {
	console.error(err.stack);
	next(err);
}

function clientErrorHandler(err, req, res, next) {
	if (req.xhr) {
		res.send(500,  { error: 'Something blew up!' });
	} else 	{
		next(err);
	}
}

function errorHandler(err, req, res, next) {
	res.status(500);
	res.render('error', { error : err } );
}