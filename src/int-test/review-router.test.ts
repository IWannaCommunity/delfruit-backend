import axios from 'axios';
import chai from 'chai';
import { createUser, getConTest, createGame, addScreenshot, addReview } from './test-lib';
import { fail } from 'assert';
import FormData from 'form-data';
import fs from 'fs';

var expect = chai.expect;

describe('review endpoint', function () {
    before(getConTest(this.ctx));
  
    it('allows users to get a list of reviews', async () => {
      /*const user = await createUser(false);
      const game = await createGame();
      const ss = await addScreenshot(user,game);

      const rsp = await axios.get(`http://localhost:4201/screenshots`);
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp).to.have.property('data');*/
    });

    it('allows the user to get a review', async () => {
      const user = await createUser(false);
      const game = await createGame();
      const rv = await addReview(user,game);
      
      const rsp = await axios.get(`http://localhost:4201/reviews/${rv.id}`);
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp).to.have.property('data');
      //todo: verify data
    });

    it('allows admins to remove a review', async () => {
      const admin = await createUser(true);
      const game = await createGame();
      const rv = await addReview(admin,game);

      const rsp = await axios.patch(`http://localhost:4201/reviews/${rv.id}`,
        {
          removed: true
        },
        {headers: {'Authorization': "Bearer " + admin.token}});
      expect(rsp).to.have.property('status').and.equal(204);
    });

    it('allows admins to restore a review', async () => {
      const admin = await createUser(true);
      const game = await createGame();
      const rv = await addReview(admin,game);

      let rsp = await axios.patch(`http://localhost:4201/reviews/${rv.id}`,
        { removed: true },
        {headers: {'Authorization': "Bearer " + admin.token}});
      expect(rsp).to.have.property('status').and.equal(204);

      rsp = await axios.patch(`http://localhost:4201/reviews/${rv.id}`,
        { removed: false },
        {headers: {'Authorization': "Bearer " + admin.token}});
      expect(rsp).to.have.property('status').and.equal(204);
    });

    it('allows the reviewer to remove their review', async () => {
      const user = await createUser(false);
      const game = await createGame();
      const rv = await addReview(user,game);

      const rsp = await axios.patch(`http://localhost:4201/reviews/${rv.id}`,
        { removed: true },
        {headers: {'Authorization': "Bearer " + user.token}});
      expect(rsp).to.have.property('status').and.equal(204);
    });

    it('does not return removed reviews', async () => {
      const admin = await createUser(true);
      const user = await createUser(false);
      const game = await createGame();
      const rv = await addReview(admin,game);

      const rsp = await axios.patch(`http://localhost:4201/reviews/${rv.id}`,
        { removed: true },
        {headers: {'Authorization': "Bearer " + admin.token}});
      expect(rsp).to.have.property('status').and.equal(204);

      try {
        await axios.delete(`http://localhost:4201/reviews/${rv.id}`,
          {headers: {'Authorization': "Bearer " + user.token}});
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(404);
        return;
      }
      fail("get should not have been successful");
    });

    it('prevents other non-admin users from deleting a review', async () => {
      const user = await createUser(false);
      const otherUser = await createUser(false);
      const game = await createGame();
      const rv = await addReview(user,game);
      
      try {
        await axios.patch(`http://localhost:4201/reviews/${rv.id}`,
          { removed: true },
          {headers: {'Authorization': "Bearer " + otherUser.token}});
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(403);
        return;
      }
      fail("post should not have been successful");
    });
    
    it('allows users to like a review', async () => {
      const reviewer = await createUser(false);
      const liker = await createUser(false);
      const game = await createGame();
      const rv = await addReview(reviewer,game);
      
      const rsp = await axios.put(
        `http://localhost:4201/reviews/${rv.id}/likes/${liker.id}`,{},
        {headers: {'Authorization': "Bearer " + liker.token}});
      expect(rsp).to.have.property('status').and.equal(204);
    });
    
    it('allows users to unlike a review', async () => {
      const reviewer = await createUser(false);
      const liker = await createUser(false);
      const game = await createGame();
      const rv = await addReview(reviewer,game);

      let rsp = await axios.put(
        `http://localhost:4201/reviews/${rv.id}/likes/${liker.id}`,{},
        {headers: {'Authorization': "Bearer " + liker.token}});
      expect(rsp).to.have.property('status').and.equal(204);

      rsp = await axios.delete(
        `http://localhost:4201/reviews/${rv.id}/likes/${liker.id}`,
        {headers: {'Authorization': "Bearer " + liker.token}});
      expect(rsp).to.have.property('status').and.equal(204);
    });
    
    it('permits multiple likes idempotently', async () => {
      const reviewer = await createUser(false);
      const liker = await createUser(false);
      const game = await createGame();
      const rv = await addReview(reviewer,game);

      let rsp = await axios.put(
        `http://localhost:4201/reviews/${rv.id}/likes/${liker.id}`,{},
        {headers: {'Authorization': "Bearer " + liker.token}});
      expect(rsp).to.have.property('status').and.equal(204);

      rsp = await axios.put(
        `http://localhost:4201/reviews/${rv.id}/likes/${liker.id}`,{},
        {headers: {'Authorization': "Bearer " + liker.token}});
      expect(rsp).to.have.property('status').and.equal(204);
    });

    it('returns multiple reviews', async () => {
      const user = await createUser(false);
      const game = await createGame();
      const game2 = await createGame();
      const rv = await addReview(user,game);
      const rv2 = await addReview(user,game2);
      
      const rsp = await axios.get(`http://localhost:4201/reviews`);
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp).to.have.property('data');
      expect(rsp.data).to.be.an.instanceof(Array);
      expect(rsp.data).to.have.length.above(1); //at least 2 results
    });
  });