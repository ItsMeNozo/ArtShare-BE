import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { EncryptionModule } from 'src/encryption/encryption.module';
import { FacebookApiModule } from 'src/facebook-api/facebook-api.module';
import { PrismaModule } from 'src/prisma.module';
import { PlatformController } from './platform.controller';
import { PlatformScheduler } from './platform.schedule';
import { PlatformService } from './platform.service';

@Module({
  imports: [
    PrismaModule,
    EncryptionModule,
    FacebookApiModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformScheduler],
  exports: [PlatformService],
})
export class PlatformModule {}
