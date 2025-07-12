import { ISafeSearchAnnotation } from 'src/safe-search/types/safe-search-annotation.type';

export class AdultDetectionResponseDto {
  isAdult: boolean;
  annotation: ISafeSearchAnnotation;
}
