import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { UsageService } from './usage.service';
import { FeatureKey } from 'src/common/enum/subscription-feature-key.enum';

// usage: curl -X POST http://localhost:3000/test/consume-credits   -H "Content-Type: application/json"   -d '{"userId": USER_ID, "amount": 8}'
@Controller('test')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Post('consume-credits')
  @HttpCode(HttpStatus.OK)
  async consumeCredits(
    @Body() body: { userId: string; amount: number; featureKey?: FeatureKey },
  ): Promise<{ success: boolean; message: string }> {
    const { userId, amount, featureKey } = body;
    // Default to AI_CREDITS for testing if not provided
    await this.usageService.handleCreditUsage(userId, featureKey || FeatureKey.AI_CREDITS, amount);
    return { success: true, message: `Consumed ${amount} credits for user ${userId}` };
  }
}
