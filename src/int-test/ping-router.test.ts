import axios from 'axios';
import chai from 'chai';
import { getConTest } from './test-lib';

var expect = chai.expect;

describe('ping endpoint', function () {
  before(getConTest(this.ctx));

  it('responds with pong', async () => {
    const rsp = await axios.get('http://localhost:4201/ping');
    expect(rsp).to.have.property('data').and.equal('pong');
  });
});