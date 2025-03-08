import { Controller, Get } from '@nestjs/common';
import { ExampleService } from './example.service';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller('example')
@ApiTags('users')
export class ExampleController {
  constructor(private exampleService: ExampleService) { }
  
  @Get()
  @ApiOperation({ summary: 'Get example' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Return all example.' })
  async findAll() {
    return await this.exampleService.findAll();
  }
}