
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import ms from 'ms';
import Config from '../model/config';

let config: Config = require('../config/config.json');

export default class AuthModule {
  public getSecret(): string {
    return config.app_jwt_secret;
  }

  public getToken(username: string, id: number, isAdmin: boolean) {
    return jwt.sign(
        {
          username,
          isAdmin,
          //useExp is when the token can actually be used
          //if before now, then a new token should be regenerated
          //based on user's current access and sent back
          useExp:Math.floor((Date.now() + ms("15 minutes")) / 1000)
        },
        this.getSecret(),
        {
          //after this much time, the token needs to be discarded and the
          //user must log in again with username/password
          expiresIn: "45 days",
          subject: ""+id
        }
    );
  }

  public async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password,config.bcrypt_rounds);
  }

  public async verifyPassword(hash: string, password: string): Promise<boolean> {
    if (!password) return false;
    return await bcrypt.compare(password,hash.replace(/^\$2y/, "$2a"));
  }
}