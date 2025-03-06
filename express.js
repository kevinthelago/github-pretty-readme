import cherryBlossom from './api/cherry-blossom.js';
import accountSummary from './api/account-summary.js';
import express from 'express';

// const express = require('express');
const app = express();
app.listen(process.env.port || 3000);

app.get('/', accountSummary);
