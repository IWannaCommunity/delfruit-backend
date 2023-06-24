import axios from 'axios';
import chai from 'chai';
import { fail, ok } from 'assert';
import { createUser, createGame, getConTest, addReview } from './test-lib';
import FormData from 'form-data';
import fs from 'fs';
import { hashSync } from 'bcrypt';
import { News } from '../model/News';

var expect = chai.expect;

async function createNews(): Promise<News> {
  const admin = await createUser(true);
    
  const rsp = await axios.post('http://localhost:4201/news', {
      title:"news title",
      short:"check me out",
      news:"long news article"
    },
    {headers: {'Authorization': "Bearer " + admin.token}});
  expect(rsp).to.have.property('status').and.equal(200);
  expect(rsp).to.have.property('data');
  return rsp.data as News;
}

describe('news endpoint', function () {
  before(getConTest(this.ctx));

  it('allows admins to add news', async() => {
    const admin = await createUser(true);
    
    const rsp = await axios.post('http://localhost:4201/news', {
        title:"news title",
        short:"check me out",
        news:"long news article"
      },
      {headers: {'Authorization': "Bearer " + admin.token}});
    expect(rsp).to.have.property('status').and.equal(200);
    expect(rsp).to.have.property('data');
    expect(rsp.data).to.have.property('id').and.be.a('number');
    expect(rsp.data).to.have.property('posterId').and.equal(admin.id);
    expect(rsp.data).to.have.property('title').and.equal("news title");
    expect(rsp.data).to.have.property('short').and.equal("check me out");
    expect(rsp.data).to.have.property('news').and.equal("long news article");
    expect(rsp.data).to.have.property('dateCreated').and.be.a('string');
  });

  it('allows admins to edit news');

  it('allows admins to remove news', async() => {
    const news = await createNews();
    const admin = await createUser(true);
    
    const rsp = await axios.delete(`http://localhost:4201/news/${news.id}`,
    {headers: {'Authorization': "Bearer " + admin.token}});
    expect(rsp).to.have.property('status').and.equal(204);

    try {
      await axios.get(`http://localhost:4201/news/${news.id}`);
    } catch (err) {
      expect(err).to.have.property('response');
      expect(err.response).to.have.property('status').and.equal(404);
      return;
    }
    fail('get should have failed')
  });

  it('prevents anons from adding news', async() => {
    try {
      await axios.post('http://localhost:4201/news', {
          title:"news title",
          short:"check me out",
          news:"long news article"
        });
    } catch (err) {
      expect(err).to.have.property('response');
      expect(err.response).to.have.property('status').and.equal(401);
      return;
    }
    fail('post should have failed')
  });

  it('prevents users from adding news', async() => {
    const user = await createUser(false);
    try {
      await axios.post('http://localhost:4201/news', {
          title:"news title",
          short:"check me out",
          news:"long news article"
        },
        {headers: {'Authorization': "Bearer " + user.token}});
    } catch (err) {
      expect(err).to.have.property('response');
      expect(err.response).to.have.property('status').and.equal(403);
      return;
    }
    fail('post should have failed')
  });
  
  it('returns a list of news for anons', async() => {
    await createNews();
    
    const rsp = await axios.get('http://localhost:4201/news');
    expect(rsp).to.have.property('status').and.equal(200);
    expect(rsp).to.have.property('data').and.be.an('array');
  });

  it('returns an article by id for anons', async() => {
    const article = await createNews();
    
    const rsp = await axios.get(`http://localhost:4201/news/${article.id}`);
    expect(rsp).to.have.property('status').and.equal(200);
    expect(rsp).to.have.property('data')
    expect(rsp.data).to.have.property('id').and.equal(article.id);
  });

  it('returns the single, latest article', async() => {
    await createNews();
    
    const rsp = await axios.get('http://localhost:4201/news',{
      params: {limit: 1, orderCol: 'date_created', orderDir: 'DESC'}
    });
    expect(rsp).to.have.property('status').and.equal(200);
    expect(rsp).to.have.property('data').and.be.an('array');
    expect(rsp.data.length).to.equal(1);
  });
});