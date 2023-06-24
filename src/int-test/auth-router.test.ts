import axios from 'axios';
import chai from 'chai';
import { fail, ok } from 'assert';
import { getConTest, createUser, setUserToken, genUsername } from './test-lib';
import AuthModule from '../lib/auth';
import jwt from 'jsonwebtoken';

var expect = chai.expect;

describe('auth endpoint', function () {
    before(getConTest(this.ctx));
    const usernameA = genUsername();
  
    it('allows the user to log in', async () => {
      //register
      const reg = await axios.post('http://localhost:4201/users',
          {username:usernameA,password:"test-pw",email:"test@example.com"});
      expect(reg).to.have.property('status').and.equal(200);
      expect(reg).to.have.property('data');
      expect(reg.data).to.have.property('token').and.be.a('string');
  
      //login
      const login = await axios.post('http://localhost:4201/auth/login',
          {username:usernameA,password:"test-pw"});
      expect(login).to.have.property('status').and.equal(200);
      expect(login).to.have.property('data');
      expect(login.data).to.have.property('token').and.be.a('string');
    });

    it("doesn't allow login with a bad password", async () => {
      const user = await createUser(false);
  
      //login
      try {
        await axios.post('http://localhost:4201/auth/login',
            {username:user.username,password:"this is the wrong password"});
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(401);
        return;
      }
    });
    
    it('allows the user to refresh their token', async () => {
      const user = await createUser(false);
  
      //login
      const result = await axios.post('http://localhost:4201/auth/refresh',
      {},
      {headers: {'Authorization': "Bearer " + user.token}});
      expect(result).to.have.property('status').and.equal(200);
      expect(result).to.have.property('data');
      expect(result.data).to.have.property('token').and.be.a('string');
      expect(user.token).to.not.equal(result.data.token)
      //TODO: assert expiration date is newer than original token
    });
    
    it('sends a new token in the response header', async () => {
      const user = await createUser(false);
  
      //login
      const login = await axios.post('http://localhost:4201/auth/login',
          {username:user.username,password:user.password});
      expect(login).to.have.property('status').and.equal(200);
      expect(login).to.have.property('data');
      expect(login.data).to.have.property('token').and.be.a('string');
      expect(login.headers).to.have.property('token').and.be.a('string');
    });
    
    it('refreshes the token with each request', async () => {
      const user = await createUser(false);
      
      const auth = new AuthModule();
      const originalToken = <any>jwt.verify(user.token,auth.getSecret());
  
      //wait a second so the new timeout is later
      await new Promise(res => setTimeout(res, 1100));

      const rsp = await axios.get('http://localhost:4201/users',
        {headers: {'Authorization': "Bearer " + user.token}});
      expect(rsp).to.have.property('status').and.equal(200);
      expect(rsp.headers).to.have.property('token').and.be.a('string');
      const newToken = <any>jwt.verify(rsp.headers.token,auth.getSecret());
      expect(newToken.useExp).to.be.greaterThan(originalToken.useExp);
      expect(newToken.exp).to.be.greaterThan(originalToken.exp);
    });

    it('allows the user to request a password reset', async () => {
      const user = await createUser(false);
  
      //login
      const login = await axios.post('http://localhost:4201/auth/request-reset',
          {username:user.username, email: user.email});
      expect(login).to.have.property('status').and.equal(204);
    });

    it("doesn't allow password reset request without email", async () => {
      const user = await createUser(false);
      try {
        await axios.post('http://localhost:4201/auth/request-reset',
            {username:user.username});
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(400);
        return;
      }
      fail("reset should not have been successful");
    });

    it("doesn't allow password reset for blank requests", async () => {
      try {
        await axios.post('http://localhost:4201/auth/reset',{});
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(401);
        return;
      }
      fail("reset should not have been successful");
    });

    it('allows the user to reset their password', async () => {
      const user = await createUser(false);

      await setUserToken(user,"test-token");

      const req = await axios.post('http://localhost:4201/auth/reset',{
        username:user.username,
        token:"test-token",
        password:"new-password"
      });
      expect(req).to.have.property('status').and.equal(200);
      expect(req.headers).to.have.property('token').and.be.a('string');
      expect(req).to.have.property('data');
      expect(req.data).to.have.property('token').and.be.a('string');
    }).timeout(5000);
  });