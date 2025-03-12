import accountSummary from './api/account-summary.js';
// import repositoryReadme from './api/repository-readme.js';
import express from 'express';

// const express = require('express');
const app = express();
var port = normalizePort(process.env.PORT || '8080');
app.set("port", port)
// app.listen(process.env.PORT || 8080);

app.get('/account-summary', accountSummary);
// app.get('/repository-readme', repositoryReadme);

app.use(function (req, res, next) {
    next(createError(404));
  });

  app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get("env") === "development" ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render("error");
  });

  return app;
}

function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}
