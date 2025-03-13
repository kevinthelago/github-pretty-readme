import accountSummary from './api/account-summary.js';
// import repositoryReadme from './api/repository-readme.js';
import express from 'express';

// const express = require('express');
const app = express();
app.listen(process.env.port || 8080);

app.get('/account-summary', accountSummary);
// app.get('/repository-readme', repositoryReadme);

