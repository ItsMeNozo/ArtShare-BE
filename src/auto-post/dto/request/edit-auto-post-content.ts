import { IsString, MinLength } from 'class-validator';

export class EditAutoPostContent {
  @IsString()
  @MinLength(2)
  seedPrompt: string;
}
