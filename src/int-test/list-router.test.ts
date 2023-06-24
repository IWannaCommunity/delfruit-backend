import axios from 'axios';
import chai from 'chai';
import { fail } from 'assert';
import { getConTest, createUser } from './test-lib';

var expect = chai.expect;

describe('list endpoint', function () {
  before(getConTest(this.ctx));

  it('allows users to create a list', async () => {
    const user = await createUser(false);
    const rsp = await axios.post('http://localhost:4201/lists',
      {
        name:"new list",
        description:"very new list"
      },
      {headers: {'Authorization': "Bearer " + user.token}});
    expect(rsp).to.have.property('status').and.equal(200);
    expect(rsp).to.have.property('data');
    expect(rsp.data).to.have.property('id').and.be.a('number');
    expect(rsp.data).to.have.property('name').and.equal("new list");
    expect(rsp.data).to.have.property('description').and.equal("very new list");
    expect(rsp.data).to.have.property('userId').and.equal(user.id);
  });
  
  it('allows users to add games to a list', async () => {
  });

  it('allows users to remove games from a list', async () => {
  });

  it('rejects adding games that do not exist', async () => {
  });

  it('rejects adding games to a list that does not exist', async () => {
  });

  it('requires you to be logged in', async () => {
    try {
      await axios.post('http://localhost:4201/lists',
        {
          name:"new list"
        });
    } catch (err) {
      expect(err).to.have.property('response');
      expect(err.response).to.have.property('status').and.equal(401);
      return;
    }
    fail("add should not have been successful");
  });
});