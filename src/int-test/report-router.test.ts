import axios from 'axios';
import chai from 'chai';
import { fail, ok } from 'assert';
import { createUser, createGame, getConTest } from './test-lib';
import { Report } from '../model/Report';

var expect = chai.expect;

async function createReport(parameters?: any): Promise<Report> {
  const user = await createUser(false);
  const game = await createGame();

  if (parameters == undefined) {
    parameters = {
      report:"game sux",
      type:"game",
      targetId:game.id
    };
  }
  
  const rsp = await axios.post('http://localhost:4201/reports', parameters,
    {headers: {'Authorization': "Bearer " + user.token}});
  expect(rsp).to.have.property('status').and.equal(200);
  expect(rsp).to.have.property('data');
  return rsp.data as Report;
}

describe('report endpoint', function () {
  before(getConTest(this.ctx));

  it('allows anyone to add reports', async() => {
    const user = await createUser(false);
    
    const rsp = await axios.post('http://localhost:4201/reports', {
      report:"game sux",
      type:"game",
      targetId:1
    },
    {headers: {'Authorization': "Bearer " + user.token}});
  expect(rsp).to.have.property('status').and.equal(200);
  expect(rsp).to.have.property('data');
    expect(rsp.data).to.have.property('id').and.be.a('number');
    expect(rsp.data).to.have.property('targetId').and.equal(1);
    expect(rsp.data).to.have.property('type').and.equal("game");
    expect(rsp.data).to.have.property('report').and.equal("game sux");
    expect(rsp.data).to.have.property('dateCreated').and.be.a('string');
    expect(rsp.data).to.have.property('reporterId').and.equal(user.id);
  });

  it('prevents anons from viewing reports', async() => {
    try {
      await axios.get('http://localhost:4201/reports');
    } catch (err) {
      expect(err).to.have.property('response');
      expect(err.response).to.have.property('status').and.equal(401);
      return;
    }
    fail('get should have failed')
  });

  it('prevents users from viewing reports', async() => {
    const user = await createUser(false);
    try {
      await axios.get('http://localhost:4201/reports',
        {headers: {'Authorization': "Bearer " + user.token}});
    } catch (err) {
      expect(err).to.have.property('response');
      expect(err.response).to.have.property('status').and.equal(403);
      return;
    }
    fail('get should have failed')
  });
  
  it('returns a list of reports for admins', async() => {
    const admin = await createUser(true);
    await createReport();
    
    const rsp = await axios.get('http://localhost:4201/reports',
    {headers: {'Authorization': "Bearer " + admin.token}});
    expect(rsp).to.have.property('status').and.equal(200);
    expect(rsp).to.have.property('data').and.be.an('array');
  });
  
  it('allows admins to filter reports by type', async() => {
    const admin = await createUser(true);
    const report = await createReport({
      report:"admin sux",
      type:"user",
      targetId:admin.id
    });
    
    let rsp = await axios.get('http://localhost:4201/reports', {
      params: {type: 'user', id: report.id},
      headers: {'Authorization': "Bearer " + admin.token}
    });
    expect(rsp).to.have.property('status').and.equal(200);
    expect(rsp).to.have.property('data').and.be.an('array');
    const matchedReports = rsp.data as Report[];
    
    rsp = await axios.get('http://localhost:4201/reports', {
      params: {type: 'game', id: report.id},
      headers: {'Authorization': "Bearer " + admin.token}
    });
    expect(rsp).to.have.property('status').and.equal(200);
    expect(rsp).to.have.property('data').and.be.an('array');
    const unmatchedReports = rsp.data as Report[];

    return expect(matchedReports  .find(o => o.id == report.id)).to.not.be.undefined 
        && expect(unmatchedReports.find(o => o.id == report.id)).to    .be.undefined;
  });

  it('returns a report by id for admins', async() => {
    const admin = await createUser(true);
    const report = await createReport();
    
    const rsp = await axios.get(`http://localhost:4201/reports/${report.id}`,
    {headers: {'Authorization': "Bearer " + admin.token}});
    expect(rsp).to.have.property('status').and.equal(200);
    expect(rsp).to.have.property('data')
    expect(rsp.data).to.have.property('id').and.equal(report.id);
  });

  it('allows admins to update reports', async() => {
    const admin = await createUser(true);
    const report = await createReport();
    
    const rsp = await axios.patch(`http://localhost:4201/reports/${report.id}`,
      {answeredById: admin.id},
      {headers: {'Authorization': "Bearer " + admin.token}});
    expect(rsp).to.have.property('status').and.equal(200);
    expect(rsp).to.have.property('data')
    expect(rsp.data).to.have.property('id').and.equal(report.id);
    expect(rsp.data).to.have.property('answeredById').and.equal(admin.id);
  });

  it('prevents users from updating reports', async() => {
    const user = await createUser(false);
    const report = await createReport();
    
    try {
      await axios.patch(`http://localhost:4201/reports/${report.id}`,
        {answeredById: user.id},
        {headers: {'Authorization': "Bearer " + user.token}});
    } catch (err) {
      expect(err).to.have.property('response');
      expect(err.response).to.have.property('status').and.equal(403);
      return;
    }
    fail('get should have failed')
  });
});
