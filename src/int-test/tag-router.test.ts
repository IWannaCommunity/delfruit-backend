import axios from 'axios';
import chai from 'chai';
import { fail } from 'assert';
import { getConTest, createUser } from './test-lib';
import FormData from 'form-data';
var Moniker = require('moniker');

var expect = chai.expect;

var taggen = Moniker.generator([Moniker.adjective]);

function randomName() {
  return taggen.choose();
}

describe('tag endpoint', function () {
  const ctx = this.ctx;
  
    before(() => {
      getConTest(ctx);
    });
  
    it('prevents anons from creating tags', async () => {
      try {
        await axios.post('http://localhost:4201/tags',
        {name:randomName()});
      } catch (err) {
        expect(err).to.have.property('response');
        expect(err.response).to.have.property('status').and.equal(401);
        return
      }
      fail('should not have worked')
    });

    it('allows users to create tags', async () => {
      const user = await createUser(false);

      const nm = randomName();

      const rsp = await axios.post('http://localhost:4201/tags',
        {name:nm},
        {headers: {'Authorization': "Bearer " + user.token}});

        expect(rsp).to.have.property('status').and.equal(200);
        expect(rsp).to.have.property('data');
        expect(rsp.data).to.have.property('id').and.be.a('number');
        expect(rsp.data).to.have.property('name').and.equal(nm);
    });

    it('allows searching of tags starting with name', async () => {
      const user = await createUser(false);

      const nm = randomName();

      const rsp = await axios.post('http://localhost:4201/tags',
        {name:nm},
        {headers: {'Authorization': "Bearer " + user.token}});
        expect(rsp).to.have.property('status').and.equal(200);

      const rsp2 = await axios.get(`http://localhost:4201/tags?q=${nm.substr(1,15)}`);
      expect(rsp2).to.have.property('status').and.equal(200);
      expect(rsp2).to.have.property('data');
      expect(rsp2.data[0]).to.have.property('name');
      expect(rsp2.data[0].name).to.equal(nm);
    });
  });