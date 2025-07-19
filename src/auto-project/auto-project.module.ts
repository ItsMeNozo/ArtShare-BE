import { Module } from '@nestjs/common';
import { ArtGenerationModule } from 'src/art-generation/art-generation.module';
import { AuthModule } from 'src/auth/auth.module';
import { UsageModule } from 'src/usage/usage.module';
import { AutoProjectReadService } from './auto-project-read.service';
import { AutoProjectWriteService } from './auto-project-write.service';
import { AutoProjectController } from './auto-project.controller';

@Module({
  imports: [AuthModule, UsageModule, ArtGenerationModule],
  providers: [AutoProjectWriteService, AutoProjectReadService],
  controllers: [AutoProjectController],
})
export class AutoProjectModule {}
