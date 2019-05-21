import express from 'express';
import { Database } from './database';
import datastore from './datastore';

const app = express.Router();
export default app;

app.route('/:listId').post((req,res,next) => {
    const uid = req.body.userId;
    const gid = req.body.gameId;
    const value = req.body.value;
    const lid = parseInt(req.params.listId, 10);
    
    if (!req.user || req.user.sub == null || req.user.sub != uid) {
      res.status(403).send({error:'user cannot update this list'});
      return;
    }
  
    if (!value) {
      const database = new Database();
      var query = `
        DELETE FROM lists 
        WHERE user_id=? AND game_id=? AND list_id=?
      `;
      database.query(query,[uid,gid,lid])
        .then(() => datastore.getLists(uid,gid)
          .then(rows=>res.send(rows))
          .catch(err=>next(err))
        )
        .then(() => database.close())
        .catch(err => {
          database.close();
          next(err);
        });
    } else {
      const database = new Database();
      var query = `
        INSERT INTO lists 
        (user_id,game_id,list_id)
        VALUES (?,?,?)
      `;
      database.query(query,[uid,gid,lid])
        .then(() => datastore.getLists(uid,gid)
          .then(rows=>res.send(rows))
          .catch(err=>next(err)))
        .then(() => database.close())
        .catch(err => {
          database.close();
          next(err);
        });
    }
  });