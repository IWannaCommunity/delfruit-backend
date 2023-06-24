import axios from 'axios';
import chai from 'chai';
import { fail } from 'assert';
import { getConTest, createUser, genUsername } from './test-lib';
import FormData from 'form-data';
var Moniker = require('moniker');

var expect = chai.expect;
var usergen = Moniker.generator(['src/int-test/usernames']);

describe('api endpoint', function () {
  const ctx = this.ctx;
  
  before(() => {
    getConTest(ctx);

  });

  it('returns a 401 if the token is invalid', async () => {
    try {
      await axios.get('http://localhost:4201/api/users',
        {headers: {'Authorization': "Bearer xyz"}});
    } catch (err) {
      expect(err).to.have.property('response');
      expect(err.response).to.have.property('status').and.equal(401);
    }
  });

  it("returns a 403 if the user isn't an admin", async () => {
    const user = await createUser(false);
    try {
      await axios.get('http://localhost:4201/api/users',
        {headers: {'Authorization': "Bearer "+user.token}});
    } catch (err) {
      expect(err).to.have.property('response');
      expect(err.response).to.have.property('status').and.equal(403);
    }
  });

  it("returns user list if user is an admin", async () => {
    const user = await createUser(true);
    const rsp = await axios.get('http://localhost:4201/api/users',
      {headers: {'Authorization': "Bearer "+user.token}});
    expect(rsp).to.have.property('status').and.equal(200);
    expect(rsp).to.have.property('data');
  });
  
});