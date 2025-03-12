import accountSummary from './api/account-summary.js';
// import repositoryReadme from './api/repository-readme.js';
import express from 'express';

// const express = require('express');
const app = express();
var port = normalizePort(process.env.PORT || 8080);
app.set("port", 8080)
// app.listen(process.env.PORT || 8080);

app.get('/account-summary', accountSummary);
// app.get('/repository-readme', repositoryReadme);

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
