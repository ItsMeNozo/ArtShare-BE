import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { FacebookApiService } from './facebook-api.service';

@Module({
  imports: [HttpModule],
  providers: [FacebookApiService],
  exports: [FacebookApiService],
})
export class FacebookApiModule {}
