import { OmitType } from '@nestjs/swagger';
import { SearchPostDto } from './search-post.dto';

export class GetPostsDto extends OmitType(SearchPostDto, ['q'] as const) {}
