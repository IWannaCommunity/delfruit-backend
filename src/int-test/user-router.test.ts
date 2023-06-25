import axios from 'axios';
import chai from 'chai';
import { fail } from 'assert';
import { getConTest, createUser, genUsername } from './test-lib';
import FormData from 'form-data';
import moment from 'moment';
var Moniker = require('moniker');

var expect = chai.expect;
var usergen = Moniker.generator(['src/int-test/usernames']);

describe('user endpoint', function () {
  const ctx = this.ctx;
  
    before(() => {
      getConTest(ctx);

    });
  
    it('returns a 401 if the token is invalid', async () => {
      try {
        await axios.get('http://localhost:4201/users',
          {headers: {'Authorization': "Bearer xyz"}});
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(401);
      }
    });
  
    it('allows a user to be registered', async () => {
      const usernameA = genUsername();

      const rsp = await axios.post('http://localhost:4201/users',
        {username:usernameA,password:"test-pw",email:"test@example.com"});
        expect(rsp).to.have.property('status').and.equal(201);
        expect(rsp).to.have.property('data');
        expect(rsp.data).to.have.property('id').and.be.a('number');
        expect(rsp.data).to.have.property('email').and.equal('test@example.com');
        expect(rsp.data).to.have.property('token').and.be.a('string');
        expect(rsp.data).to.have.property('isAdmin').and.equal(false);
    });
  
    it('rejects registration via form parameters', async () => {
      const usernameA = genUsername();
      let bodyFormData = new FormData();
      bodyFormData.append('userName', usernameA);
      bodyFormData.append('password', 'test-pw');
      bodyFormData.append('email', 'test@example.com');

      try {
        const rsp = await axios.post('http://localhost:4201/users',
          bodyFormData);
        fail("registration should not have been successful");
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(400);
        expect(err.response.data).to.equal('Invalid request: expected a JSON body of the format {"username":"example","password":"example","email":"example@example.com"}')
      }
    });
  
    it('rejects existing users', async () => {
      const user = await createUser(false);

      //second, should fail
      try {
        await axios.post('http://localhost:4201/users',
          {username:user.username,password:"test-pw",email:"test@example.com"});
        fail("second registration should not have been successful");
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(400);
      }
    });

    it('returns user information', async () => {
      const rsp = await axios.get('http://localhost:4201/users/1');
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp).to.have.property('data');
      expect(rsp.data).to.have.property('id').and.equal(1);
      expect(rsp.data).to.have.property('name').and.be.a('string');
    });

    it('allows modification of your own user', async () => {
      const u = await createUser(false);

      //update
      const patch = await axios.patch(`http://localhost:4201/users/${u.id}`,
          {email:"new@example.com"},
          {headers: {'Authorization': "Bearer " + u.token}});
      expect(patch).to.have.property('status').and.equal(200);
      expect(patch).to.have.property('data');
      expect(patch.data).to.have.property('email').and.equal('new@example.com');
      expect(patch.data).to.have.property('id').and.equal(u.id);

      //verify
      const user = await axios.get(`http://localhost:4201/users/${u.id}`,
          {headers: {'Authorization': "Bearer " + u.token}});
      expect(user).to.have.property('status').and.equal(200);
      expect(user).to.have.property('data');
      expect(user.data).to.have.property('email').and.equal('new@example.com');
      expect(user.data).to.have.property('id').and.equal(u.id);
    });

    it('does not allow modification of a different user', async () => {
      const Alice = await createUser(false);
      const Bob = await createUser(false);

      try {
        await axios.patch(`http://localhost:4201/users/${Alice.id}`,
          {email:"new@example.com"},
          {headers: {'Authorization': "Bearer " + Bob.token}});
        fail("modify should not have been successful");
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(403);
      }
    });

    it('does not allow modification user if not logged in', async () => {
      const user = await createUser(false);

      try {
        await axios.patch(`http://localhost:4201/users/${user.id}`,
            {email:"new@example.com"});
        fail("modify should not have been successful");
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(401);
      }
    });

    it('allows password change', async () => {
      const user = await createUser(false);

      //update
      const patch = await axios.patch(`http://localhost:4201/users/${user.id}`,
          {password:"new-pw", currentPassword:"test-pw"},
          {headers: {'Authorization': "Bearer " + user.token}});
      expect(patch).to.have.property('status').and.equal(200);

      //verify login
      const login = await axios.post('http://localhost:4201/auth/login',
          {username:user.username,password:"new-pw"});
      expect(login).to.have.property('status').and.equal(200);
    });

    it('rejects password change if current password incorrect', async () => {
      const user = await createUser(false);

      //update
      try {
        const patch = await axios.patch(`http://localhost:4201/users/${user.id}`,
          {password:"new-pw", currentPassword:"not-correct-password"},
          {headers: {'Authorization': "Bearer " + user.token}});
          fail("modify should not have been successful");
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(401);
      }
    });

    it('rejects password change if current password not provided', async () => {
      const user = await createUser(false);

      //update
      try {
        const patch = await axios.patch(`http://localhost:4201/users/${user.id}`,
          {password:"new-pw"},
          {headers: {'Authorization': "Bearer " + user.token}});
          fail("modify should not have been successful");
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(401);
      }
    });

    it('gets lists for a user', async () => {
      const user = await createUser(false);
      
      const rsp = await axios.get(`http://localhost:4201/users/${user.id}/lists`,
        {headers: {'Authorization': "Bearer " + user.token}});
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp).to.have.property('data');
      expect(rsp.data).to.be.an('array');
    });

    it('allows a user to follow another user', async () => {
      const user = await createUser(false);
      const targetUser = await createUser(false);
      
      const rsp = await axios.put(`http://localhost:4201/users/${user.id}/follows/${targetUser.id}`,{},
        {headers: {'Authorization': "Bearer " + user.token}});
      expect(rsp).to.have.property('status').and.equal(204);
    });

    it('allows a user to unfollow another user', async () => {
      const user = await createUser(false);
      const targetUser = await createUser(false);
      
      let rsp = await axios.put(`http://localhost:4201/users/${user.id}/follows/${targetUser.id}`,{},
        {headers: {'Authorization': "Bearer " + user.token}});
      expect(rsp).to.have.property('status').and.equal(204);
      
      rsp = await axios.delete(`http://localhost:4201/users/${user.id}/follows/${targetUser.id}`,
        {headers: {'Authorization': "Bearer " + user.token}});
      expect(rsp).to.have.property('status').and.equal(204);
    });

    it('does not expose sensitive user data to other users', async () => {
      const hacker = await createUser(false);
      const victim = await createUser(false);
      
      let rsp = await axios.get(`http://localhost:4201/users/${victim.id}`,
        {headers: {'Authorization': "Bearer " + hacker.token}});
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp).to.have.property('data');

      //complete whitelist
      //add members if public data is added to the user
      expect(Object.keys(rsp.data)).to.have.members([
        'id','name','dateCreated','isAdmin','twitchLink',
        'nicoLink','youtubeLink','twitterLink','bio','selected_badge']);
    });

    it('does not expose sensitive user data to anons', async () => {
      const victim = await createUser(false);
      
      let rsp = await axios.get(`http://localhost:4201/users/${victim.id}`);
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp).to.have.property('data');

      //complete whitelist
      //add members if public data is added to the user
      expect(Object.keys(rsp.data)).to.have.members([
        'id','name','dateCreated','isAdmin','twitchLink',
        'nicoLink','youtubeLink','twitterLink','bio','selected_badge']);
    });

    it('does not expose sensitive user data on the user list to anons', async () => {
      await createUser(false);
      
      let rsp = await axios.get(`http://localhost:4201/users`);
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp).to.have.property('data').and.be.an('array');
      expect(rsp.data.length).to.be.greaterThan(0);

      //complete whitelist
      //add members if public data is added to the user
      expect(Object.keys(rsp.data[0])).to.have.members([
        'id','name','dateCreated','isAdmin','twitchLink',
        'nicoLink','youtubeLink','twitterLink','bio','selected_badge']);
    });

    it('allows retrieval of available badge list', async () => {
      const user = await createUser(false);
      
      let rsp = await axios.get(`http://localhost:4201/users/${user.id}/badges`,
        {headers: {'Authorization': "Bearer " + user.token}});
        expect(rsp).to.have.property('status').and.equal(200);
        expect(rsp).to.have.property('data').and.be.an('array');
  
    });

    it('allows searching for user by name', async () => {
      const user = await createUser(false);
      
      let rsp = await axios.get(`http://localhost:4201/users`,
        {headers: {'Authorization': "Bearer " + user.token},
          params:{name:user.username.substring(3,10)}});
        expect(rsp).to.have.property('status').and.equal(200);
        expect(rsp).to.have.property('data').and.be.an('array');
        expect((rsp.data as any[]).find(u=>u.name===user.username)).to.not.be.null;
    });

    it("includes permissions for self", async () => {
      const user = await createUser(true);
      
      let rsp = await axios.get(`http://localhost:4201/users/${user.id}`,
        {headers: {'Authorization': "Bearer " + user.token}});
        expect(rsp).to.have.property('status').and.equal(200);
        expect(rsp).to.have.property('data').and.be.an('object');
        expect(rsp.data).to.have.property('permissions');
    });

    it("includes permissions for admins", async () => {
      const user = await createUser(true);
      const target_user = await createUser(false);
      
      let rsp = await axios.get(`http://localhost:4201/users/${target_user.id}`,
        {headers: {'Authorization': "Bearer " + user.token}});
        expect(rsp).to.have.property('status').and.equal(200);
        expect(rsp).to.have.property('data').and.be.an('object');
        expect(rsp.data).to.have.property('permissions');
    });

    it("doesn't include permissions if it's not you", async () => {
      const user = await createUser(false);
      const target_user = await createUser(false);
      
      let rsp = await axios.get(`http://localhost:4201/users/${target_user.id}`,
        {headers: {'Authorization': "Bearer " + user.token}});
        expect(rsp).to.have.property('status').and.equal(200);
        expect(rsp).to.have.property('data').and.be.an('object');
        expect(rsp.data).to.not.have.property('permissions');
    });

    it("shows revoked permissions", async () => {
      const user = await createUser(true);
      const target_user = await createUser(false);
      const perm = "CAN_REPORT";
      let revokeRsp = await axios.patch(`http://localhost:4201/users/${target_user.id}/permissions/${perm}`,
        {revoked_until:moment().add(1,'days')},
        {headers: {'Authorization': "Bearer " + user.token}});
      expect(revokeRsp).to.have.property('status').and.equal(200);
      
      let rsp = await axios.get(`http://localhost:4201/users/${target_user.id}`,
        {headers: {'Authorization': "Bearer " + user.token}});
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp).to.have.property('data').and.be.an('object');
      expect(rsp.data).to.have.property('permissions');
      expect(rsp.data.permissions).to.have.property(perm);
      expect(rsp.data.permissions[perm]).to.have.property("revoked_until");
      expect(moment(rsp.data.permissions[perm].revoked_until).isAfter(moment())).to.be.true;
    });
  });