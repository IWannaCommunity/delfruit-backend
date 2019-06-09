import express from 'express';
import datastore from './datastore';
import { Report } from './model/Report';
import handle from './lib/express-async-catch';

const app = express.Router();
export default app;

/**
 * @swagger
 * 
 * /games:
 *   get:
 *     summary: Game List
 *     description: Game List
 *     tags: 
 *       - Games
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: The type of reports to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: The page of results to return (default 0)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: The number of results per page (default 50, maximum 50)
 *     responses:
 *       200:
 *         description: returns a list of games matching filters
 */
app.route('/').get(handle(async (req,res,next) => {  
  if (!req.user || !req.user.sub || !req.user.isAdmin) return res.sendStatus(403);

  const n = await datastore.getReports({
    type: req.query.type,
    answered: req.query.answered,
    page: +req.query.page || 0,
    limit: +req.query.limit || 50
  });

  return res.send(n);
}));

app.route('/:id').get(handle(async (req,res,next) => {
  if (!req.user || !req.user.sub || !req.user.isAdmin) return res.sendStatus(403);
  if (isNaN(req.params.id)) return res.status(400).send({error:'id must be a number'});

  const report = await datastore.getReport(+req.params.id);
  if (!report) return res.sendStatus(404);
  return res.send(report);
}));

app.route('/:id').patch(handle(async (req,res,next) => {
  if (!req.user || !req.user.sub || !req.user.isAdmin) return res.sendStatus(403);
  if (isNaN(req.params.id)) return res.status(400).send({error:'id must be a number'});

  const rid = +req.params.id;

  const ogReport = await datastore.getReport(rid);
  if (!ogReport) return res.sendStatus(404);

  const report = req.body as Report;

  report.id = rid;
  delete report.report; //not even admins can change the report content
  delete report.reporterId;

  const success = await datastore.updateReport(report);
  if (success) return res.send(await datastore.getReport(rid));
  else throw 'failed to update report';
}));

app.route('/').post(handle(async (req,res,next) => {
  if (!req.user || !req.user.sub) return res.sendStatus(401);
  const uid = req.user.sub;

  const report = req.body as Report;

  const news = await datastore.addReport(report,uid);
  res.send(news);
}));