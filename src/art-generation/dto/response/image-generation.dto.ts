export class ImageGenerationResponseDto {
  id: number;
  userId: string;
  userPrompt: string;
  finalPrompt: string;
  modelKey: string;
  numberOfImagesGenerated: number;
  imageUrls: string[];
  aspectRatio: string;
  style: string | null;
  lighting: string | null;
  camera: string | null;
  createdAt: Date;
}