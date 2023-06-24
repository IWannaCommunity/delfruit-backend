import axios from 'axios';
import chai from 'chai';
import { createUser, getConTest } from './test-lib';

var expect = chai.expect;

describe('message endpoint', function () {
    before(getConTest(this.ctx));
  
    it('allows the user to send a new message', async () => {
      const sender = await createUser(false);
      const recipient = await createUser(false);

      //send
      const rsp = await axios.post('http://localhost:4201/message',
          {
            userToId:recipient.id,
            subject:"neat message",
            body:"wow this is neat"
          },
          {headers: {'Authorization': "Bearer " + sender.token}});
      expect(rsp).to.have.property('status').and.equal(204);
    });

    it('allows the user to send a new message and the recipient to read it', async () => {
      const sender = await createUser(false);
      const recipient = await createUser(false);

      //send
      const rsp = await axios.post('http://localhost:4201/message',
          {
            userToId:recipient.id,
            subject:"neat message",
            body:"wow this is neat"
          },
          {headers: {'Authorization': "Bearer " + sender.token}});
      expect(rsp).to.have.property('status').and.equal(204);

      //check receipt
      const rcpt = await axios.get('http://localhost:4201/message/inbox',
          {headers: {'Authorization': "Bearer " + recipient.token}});
      expect(rcpt).to.have.property('status').and.equal(200);
      expect(rcpt).to.have.property('data');
      expect(rcpt.data[0]).to.have.property('subject').and.equal("neat message");
      expect(rcpt.data[0]).to.have.property('body').and.equal("wow this is neat");
    });

    /*it('creates a thread when a user replies', async () => {
      const sender = await createUser(false);
      const recipient = await createUser(false);

      //send
      const msg = await axios.post('http://localhost:4201/message',
          {
            userToId:recipient.id,
            subject:"neat message",
            body:"wow this is neat"
          },
          {headers: {'Authorization': "Bearer " + sender.token}});
      expect(msg).to.have.property('status').and.equal(204);

      //check receipt
      const rcpt = await axios.get('http://localhost:4201/message/inbox',
          {headers: {'Authorization': "Bearer " + recipient.token}});
      expect(rcpt).to.have.property('status').and.equal(200);
      expect(rcpt).to.have.property('data');
      expect(rcpt.data[0]).to.have.property('id').and.be.a('number');

      //reply
      const rply = await axios.post('http://localhost:4201/message',
      {
        userToId:sender.id,
        subject:"my reply",
        body:"yes, totally neat",
        replyToId:rcpt.data[0].id
      },
      {headers: {'Authorization': "Bearer " + recipient.token}});
      expect(rply).to.have.property('status').and.equal(204);

      //check receipt
      const rcpt2 = await axios.get('http://localhost:4201/message/inbox',
          {headers: {'Authorization': "Bearer " + sender.token}});
      expect(rcpt2).to.have.property('status').and.equal(200);
      expect(rcpt2).to.have.property('data');
      expect(rcpt2.data[0]).to.have.property('threadId').and.equal(rcpt.data[0].id);
    });*/
  });