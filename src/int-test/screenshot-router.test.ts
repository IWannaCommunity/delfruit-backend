import axios from 'axios';
import chai from 'chai';
import { createUser, getConTest, createGame, addScreenshot, hasPermission } from './test-lib';
import { fail } from 'assert';
import FormData from 'form-data';
import fs from 'fs';
import { Permission } from '../model/Permission';

var expect = chai.expect;

describe('screenshot endpoint', function () {
    before(getConTest(this.ctx));
  
    it('allows users to get a list of screenshots', async () => {
      const user = await createUser(false);
      const game = await createGame();
      const ss = await addScreenshot(user,game);

      const rsp = await axios.get(`http://localhost:4201/screenshots`);
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp).to.have.property('data');
      //todo: check if array contains the new screenshot
    });

    it('allows the user to get a screenshot', async () => {
      const user = await createUser(false);
      const game = await createGame();
      const ss = await addScreenshot(user,game);
      
      const rsp = await axios.get(`http://localhost:4201/screenshots/${ss.id}`);
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp).to.have.property('data');
      //todo: check if object equals created screenshot
    });

    it('allows admins to remove a screenshot', async () => {
      const admin = await createUser(true);
      const game = await createGame();
      const ss = await addScreenshot(admin,game);

      const rsp = await axios.delete(`http://localhost:4201/screenshots/${ss.id}`,
        {headers: {'Authorization': "Bearer " + admin.token}});
      expect(rsp).to.have.property('status').and.equal(204);
    });

    it('grants auto-approve once the approve threshold has been met', async function () {
      this.timeout(3000) //took 1205 in my test
      const admin = await createUser(true);
      const user = await createUser(false);
      const game = await createGame();
      //create and approve 10 screenshots
      for (let i = 0; i < 10; i++) {
        const ss = await addScreenshot(user,game);
        await axios.patch(`http://localhost:4201/screenshots/${ss.id}`,{approved: true},
          {headers: {'Authorization': "Bearer " + admin.token}});

          if (i === 8) { //one before end
            const hadPerm = await hasPermission(user,Permission.AUTO_APPROVE_SCREENSHOT);
            expect(hadPerm).to.be.false;
          }
      }

      const hadPerm = await hasPermission(user,Permission.AUTO_APPROVE_SCREENSHOT);
      expect(hadPerm).to.be.true;
    });

    it('prevents non-admins from deleting a screenshot', async () => {
      const admin = await createUser(false);
      const game = await createGame();
      const ss = await addScreenshot(admin,game);

      try {
        await axios.delete(`http://localhost:4201/screenshots/${ss.id}`,
          {headers: {'Authorization': "Bearer " + admin.token}});
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(403);
        return;
      }
      fail("get should not have been successful");
    });

    it('prevents anons from creating a screenshot', async () => {
      const game = await createGame();

      let data = new FormData();

      data.append('description', 'super neat screenshot');
      data.append('screenshot', fs.createReadStream(__dirname+'/HYPE.png'));
  
      try {
        await axios.post(`http://localhost:4201/games/${game.id}/screenshots`,
          data,
          {headers: data.getHeaders()});
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(401);
        return;
      }
      fail("get should not have been successful");
    });

    it('allows admins to approve a screenshot', async () => {
      const user = await createUser(true);
      const game = await createGame();
      const ss = await addScreenshot(user,game);
      expect(ss).to.have.property('approved').and.equal(null);
      
      let rsp = await axios.patch(`http://localhost:4201/screenshots/${ss.id}`,{
        approved: true
      },
        {headers: {'Authorization': "Bearer " + user.token}});
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp).to.have.property('data');
      expect(rsp.data).to.have.property('approved').and.equal(true);
      
      rsp = await axios.get(`http://localhost:4201/screenshots/${ss.id}`);
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp).to.have.property('data');
      expect(rsp.data).to.have.property('approved').and.equal(true);
    });

    it('allows admins to deny a screenshot', async () => {
      const user = await createUser(true);
      const game = await createGame();
      const ss = await addScreenshot(user,game);
      expect(ss).to.have.property('approved').and.equal(null);
      
      let rsp = await axios.patch(`http://localhost:4201/screenshots/${ss.id}`,{
        approved: false
      },
        {headers: {'Authorization': "Bearer " + user.token}});
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp).to.have.property('data');
      expect(rsp.data).to.have.property('approved').and.equal(false);
    });

    it('does not return screenshots until approved', async () => {
      const user = await createUser(false);
      const admin = await createUser(true);
      const game = await createGame();
      const ss = await addScreenshot(user,game);
      expect(ss).to.have.property('approved').and.equal(null);

      try {
        await axios.get(`http://localhost:4201/screenshots/${ss.id}`);
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(404);
        return;
      }
      
      let rsp = await axios.patch(`http://localhost:4201/screenshots/${ss.id}`,{
        approved: true
      },{headers: {'Authorization': "Bearer " + admin.token}});
      
      rsp = await axios.get(`http://localhost:4201/screenshots/${ss.id}`);
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp).to.have.property('data');
      expect(rsp.data).to.have.property('approved').and.equal(true);
    });

    it('prevents anons from approving a screenshot', async () => {
      const user = await createUser(true);
      const game = await createGame();
      const ss = await addScreenshot(user,game);
      expect(ss).to.have.property('approved').and.equal(null);

      try {
        await axios.patch(`http://localhost:4201/screenshots/${ss.id}`,{
          approved: true
        });
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(401);
        return;
      }
      fail("get should not have been successful");
    });

    it('prevents users from approving a screenshot', async () => {
      const user = await createUser(false);
      const game = await createGame();
      const ss = await addScreenshot(user,game);
      expect(ss).to.have.property('approved').and.equal(null);

      try {
        await axios.patch(`http://localhost:4201/screenshots/${ss.id}`,{
          approved: true
        },
        {headers: {'Authorization': "Bearer " + user.token}});
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(403);
        return;
      }
      fail("get should not have been successful");
    });
  });