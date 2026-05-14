import accountSummary from './api/account-summary.js';
import techSummary from './api/tech-summary.js';
import techList from './api/tech-list.js';
import techChart from './api/tech-chart.js';
import techSpider from './api/tech-spider.js';
import express from 'express';

const app = express();
app.listen(process.env.port || 8080);

app.get('/account-summary', accountSummary);
app.get('/tech-summary', techSummary);
app.get('/tech-list', techList);
app.get('/tech-chart', techChart);
app.get('/tech-spider', techSpider);
