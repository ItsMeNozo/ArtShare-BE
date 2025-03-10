import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import axios from 'axios';
import { MediaType } from '@prisma/client';

@Injectable()
export class SemanticSearchService {
  constructor(private prisma: PrismaService) { }

  private qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
  private collectionName = 'artshare';

  private textWeight = 0.1;
  private imageWeight = 0.8;
  private titleWeight = 0.1;

  async createArtwork(data: { title: string; description: string; url: string }) {
    const combinedEmbedding = await this.generateCombinedEmbedding(data.title, data.description, data.url);
    // console.log('Combined embedding:', combinedEmbedding);

    const artwork = await this.prisma.media.create({
      data: {
        user_id: 1,
        post_id: 1,
        media_type: MediaType.image,
        description: data.description,
        url: data.url,
        creator: 'Unknown',
      },
    });

    console.log('Artwork created:', artwork);

    const qdrantRes = await axios.put(`${this.qdrantUrl}/collections/${this.collectionName}/points`, {
      points: [
        {
          id: artwork.id,
          vector: combinedEmbedding,
          payload: { artworkId: artwork.id },
        },
      ],
    });
    console.log('Artwork added to Qdrant.', qdrantRes);

    return artwork;
  }

  async searchArtworks(data: { query: string }) {
    // Generate a text embedding for the query
    const queryEmbedding = await this.generateEmbeddingFromText(data.query);

    // Query Qdrant for similar points
    const searchResponse = await axios.post(`${this.qdrantUrl}/collections/${this.collectionName}/points/search`, {
      vector: queryEmbedding,
      limit: 10,
      with_payload: true,
    });
    console.log('Search response:', searchResponse.data);

    const pointIds: number[] = searchResponse.data.result.map((point: { id: any; }) => point.id);

    const artworks = await this.prisma.media.findMany({
      where: { id: { in: pointIds } },
    });

    // Sort the artworks in the same order as pointIds.
    const sortedArtworks = pointIds.map(pointId =>
      artworks.find(artwork => artwork.id === pointId)
    );

    return sortedArtworks;
  }

  // Generates a combined embedding from text (title + description) and image content.
  async generateCombinedEmbedding(title: string, description: string, imageUrl: string): Promise<number[]> {
    // const text = `${title}. ${description}`;
    const text = description;
    const textEmbedding = await this.generateEmbeddingFromText(text);

    const imageEmbedding = await this.generateEmbeddingFromImage(imageUrl);

    const combined = textEmbedding.map((val, idx) =>
      this.textWeight * val + this.imageWeight * imageEmbedding[idx]
    );
    
    return textEmbedding;
  }

  async generateEmbeddingFromText(text: string): Promise<number[]> {
    const response = await axios.post(
      'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
      { inputs: text },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.HF_API_TOKEN}`,
        },
      }
    );
    return response.data;
  }

  async generateEmbeddingFromImage(imageUrl: string): Promise<number[]> {
    const response = await axios.post(
      'https://api.example.com/image-embeddings',
      { imageUrl },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
    return response.data.embedding;
  }
}
