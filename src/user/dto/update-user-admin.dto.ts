import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Role } from 'src/auth/enums/role.enum';
import { UserStatus } from 'src/generated';

export class UpdateUserAdminDTO {
  @ApiProperty({ example: 'new_username', required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username?: string;

  @ApiProperty({ example: 'new.email@example.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'New Full Name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    required: false,
    description: 'New profile picture file to upload.',
  })
  profilePictureFile?: any;

  @ApiProperty({
    type: String,
    nullable: true,
    required: false,
    description: 'URL of the profile picture, or data URI, or null to remove.',
  })
  @IsOptional()
  @IsString()
  profilePictureUrl?: string | null;

  @ApiProperty({
    example: 'New bio here.',
    required: false,
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @ApiProperty({
    description:
      "Array of user roles (e.g., ['USER', 'EDITOR']). Only for admin updates.",
    example: [Role.USER],
    enum: Role,
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Role, {
    each: true,
    message: 'Each role must be a valid Role enum value.',
  })
  roles?: Role[];

  @ApiProperty({
    example: '1995-08-22',
    description: "User's birthday in YYYY-MM-DD format.",
    required: false,
    type: String,
    nullable: true,
  })
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'Birthday must be a valid date string in YYYY-MM-DD format.' },
  )
  birthday?: string | null;

  @ApiProperty({
    enum: UserStatus,
    required: false,
    example: UserStatus.ACTIVE,
    description: "Update the user's account status.",
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
