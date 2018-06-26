const express = require('express');
const middleware = require('../middleware');
const route = require('../route');
const app = express();

app.use(middleware.logger());

app.use(function(req, res, next){
    logger.info(`time begin:${Date.now()}`);
    next();
});

app.use(route);

app.use(function(req, res, next){
    logger.info(`time end:${Date.now()}`);
    next();
});

app.use(function(err, req, res, next) {
    logger.error(err.stack);
    res.status(500).send('Something broke!');
});

var server = app.listen(2222, () => {
    console.log(`Server started on ${server.address().port}`);
});

