import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../types/jwtPayload.type';

@Injectable()
export class AtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('AT_SECRET');
    
    if (!secret) {
      throw new Error('AT_SECRET is not defined in configuration');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
    });
  }

  validate(req: Request, payload: JwtPayload) {
    const result = {
      userId: payload.userId,
      email: payload.email,
      roles: payload.roles,
    };
    
    console.log('AT Strategy returning:', result);
    return result;
  }
}
