import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { EncryptionModule } from 'src/encryption/encryption.module';
import { PrismaModule } from 'src/prisma.module';
import { PlatformController } from './platform.controller';
import { PlatformScheduler } from './platform.schedule';
import { PlatformService } from './platform.service';

@Module({
  imports: [forwardRef(() => AuthModule), PrismaModule, EncryptionModule],
  controllers: [PlatformController],
  providers: [PlatformService, PlatformScheduler],
  exports: [PlatformService],
})
export class PlatformModule {}
