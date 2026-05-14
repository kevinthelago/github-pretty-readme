import accountSummary from './api/account-summary.js';
import techSummary from './api/tech-summary.js';
import express from 'express';

const app = express();
app.listen(process.env.port || 8080);

app.get('/account-summary', accountSummary);
app.get('/tech-summary', techSummary);
