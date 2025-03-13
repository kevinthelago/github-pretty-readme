import accountSummary from './api/account-summary.js';
import express from 'express';

// const express = require('express');
const app = express();
app.listen(process.env.port || 8080);

app.get('/account-summary', accountSummary);

