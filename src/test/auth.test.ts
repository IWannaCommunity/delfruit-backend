/*import chai from 'chai';
import AuthModule from '../lib/auth';
import jwt from 'jsonwebtoken';

var expect = chai.expect;

describe('auth module', function () {
  it('hashes and verifies', async () => {
    const auth = new AuthModule();
    const hash = await auth.hashPassword('test');
    const success = await auth.verifyPassword(hash,'test');
    return expect(success).to.be.true;
  });

  it('includes a useExp date at least 10 minutes from now', async () => {
    const auth = new AuthModule();
    const tokenstr = auth.getToken('test',1,false)
    const token = <any>jwt.verify(tokenstr,auth.getSecret());
    expect(token).to.have.property('useExp').and.be.a('number');
    expect(token.useExp).to.be.greaterThan(Date.now()/1000 + 10*60);
  });

  it('includes the user id as the subject', async () => {
    const auth = new AuthModule();
    const tokenstr = auth.getToken('test',1,false)
    const token = <any>jwt.verify(tokenstr,auth.getSecret());
    expect(token).to.have.property('sub').and.be.a('string');
    expect(token.sub).to.equal("1");
  });

  it('includes the username under username', async () => {
    const auth = new AuthModule();
    const tokenstr = auth.getToken('test',1,false)
    const token = <any>jwt.verify(tokenstr,auth.getSecret());
    expect(token).to.have.property('username').and.be.a('string');
    expect(token.username).to.equal("test");
  });
});*/