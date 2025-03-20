import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: '*', // Change this to your frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allow specific HTTP methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
    credentials: true, // Allow cookies or authorization headers to be sent
  });

  // Start the application on the desired port (either from environment or 3000)
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
