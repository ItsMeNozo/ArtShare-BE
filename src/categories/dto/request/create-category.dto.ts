import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
export enum CategoryType {
  MEDIUM = 'MEDIUM',
  ATTRIBUTE = 'ATTRIBUTE',
}

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Name must be at least 3 characters long' })
  name: string;

  @IsArray()
  @IsString({ each: true })
  example_images: string[];

  @IsEnum(CategoryType)
  type: CategoryType;

  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'Description must be at least 10 characters long' })
  description: string;
}
