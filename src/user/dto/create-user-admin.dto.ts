import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Role as RoleEnum } from 'src/auth/enums/role.enum';
import { UserStatus } from 'src/generated';

export class CreateUserAdminDTO {
  @ApiProperty({
    example: 'someFirebaseUniqueId123',
    description:
      'The Firebase UID of the user. This will be the primary ID in the local database.',
  })
  @IsNotEmpty()
  @IsString()
  id: string;

  @ApiProperty({ example: 'new_user_john' })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({ example: 'new.john@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ required: false, example: 'New User John Doe' })
  @IsOptional()
  @IsString()
  full_name?: string;

  @ApiProperty({ required: false, example: 'https://i.pravatar.cc/150?img=10' })
  @IsOptional()
  @IsString()
  profile_picture_url?: string;

  @ApiProperty({ required: false, example: 'Bio of the new user.' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({
    required: false,
    type: String,
    example: '1990-05-15',
    format: 'date',
  })
  @IsOptional()
  @IsDateString()
  birthday?: string;

  @ApiProperty({ enum: RoleEnum, isArray: true, example: [RoleEnum.USER] })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(RoleEnum, { each: true })
  roles: RoleEnum[];

  @ApiProperty({
    enum: UserStatus,
    required: false,
    example: UserStatus.ACTIVE,
    description: "The user's account status.",
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
