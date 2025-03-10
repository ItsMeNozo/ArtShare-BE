import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { SemanticSearchService } from './semantic-search.service';

@Controller('semantic-search')
export class SemanticSearchController {
  constructor(private readonly semanticSearchService: SemanticSearchService) {}

  @Post()
  async createArtwork(@Body() createArtworkDto: { title: string; description: string; url: string }) {
    return this.semanticSearchService.createArtwork(createArtworkDto);
  }

  @Post('search')
  async searchArtworks(@Body() searchArtworkDto: { query: string}) {
    return this.semanticSearchService.searchArtworks(searchArtworkDto);
  }
}
