import express from 'express';
import datastore from './datastore';
import handle from './lib/express-async-catch';
import { adminCheck } from './lib/auth-check';
const app = express.Router();
export default app;

/**
 * @swagger
 * 
 * /api/users:
 *   get:
 *     summary: API User List
 *     description: API User List
 *     tags: 
 *       - API
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: returns a list of api users
 *         content:
 *              application/json:
 *                      schema:
 *                              type: array
 *                              items:
 *                                      $ref: '#/components/schemas/ApiUser'
 * components:
 *      schemas:
 *              ApiUser:
 *                      type: object
 *                      properties:
 *                          id:
 *                              type: integer
 *                              format: int64
 *                          api_key:
 *                              type: string
 *                          description:
 *                              type: string
 *                          date_created:
 *                              type: string
 *                              format: date
 *                          origin:
 *                              type: string
 *                      required:
 *                              - id
 *                              - api_key
 *                              - date_created
 */
app.route('/users').get(adminCheck(), handle(async (req, res, next) => {
    var page = +req.query.page || 0;
    var limit = +req.query.limit || 50;
    const users = await datastore.getApiUsers({ page, limit });
    users.forEach(u => {
        delete u.email;
        delete u.canReport;
        delete u.canSubmit;
        delete u.canReview;
        delete u.canScreenshot;
        delete u.banned;
    });
    return res.send(users);
}));
