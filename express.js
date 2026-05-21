import accountSummary from './api/account-summary.js';
import accountSummaryMd from './api/account-summary-md.js';
import developerRating from './api/developer-rating.js';
import developerRatingInsights from './api/developer-rating-insights.js';
import techSummary from './api/tech-summary.js';
import techList from './api/tech-list.js';
import techChart from './api/tech-chart.js';
import techSpider from './api/tech-spider.js';
import techCategories from './api/tech-categories.js';
import improveTopics from './api/improve-topics.js';
import improveDescriptions from './api/improve-descriptions.js';
import express from 'express';

const app = express();
app.listen(process.env.port || 8080);

app.get('/account-summary', accountSummary);
app.get('/account-summary-md', accountSummaryMd);
app.get('/developer-rating', developerRating);
app.get('/developer-rating-insights', developerRatingInsights);
app.get('/tech-summary', techSummary);
app.get('/tech-list', techList);
app.get('/tech-chart', techChart);
app.get('/tech-spider', techSpider);
app.get('/tech-categories', techCategories);
app.get('/improve-topics', improveTopics);
app.get('/improve-descriptions', improveDescriptions);
