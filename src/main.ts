import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import metadata from './metadata';
import * as express from 'express';
import helmet from 'helmet';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const compression = require('compression');
import rateLimit from 'express-rate-limit';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { WebSocketJwtAuthGuard } from './auth/websocket-jwt-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'fatal', 'error', 'warn', 'debug', 'verbose'],
  });
  
  // Configure Socket.IO adapter for WebSocket support
  app.useWebSocketAdapter(new IoAdapter(app));
  
  // Trust proxy for rate limiting and IP detection
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);
  
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const logger = new Logger('Bootstrap');

  // Security Headers with Helmet
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Note: unsafe-eval may be needed for some libs
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        fontSrc: ["'self'", "https:"],
        connectSrc: ["'self'", "https:", "wss:", "ws:"],
        mediaSrc: ["'self'", "https:", "blob:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable if you have cross-origin resources
    hsts: isProduction ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false,
  }));

  // Compression
  app.use(compression());

  // Rate Limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProduction ? 1000 : 10000, // Limit each IP to 1000 requests per windowMs in production
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // API-specific rate limiting (more restrictive)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isProduction ? 500 : 5000, // Limit each IP to 500 API requests per windowMs in production
    message: {
      error: 'Too many API requests from this IP, please try again later.',
      retryAfter: '15 minutes'
    },
    skip: (req: express.Request) => req.path.startsWith('/api/stripe/webhook'), // Skip webhook endpoints
  });
  app.use('/api', apiLimiter);

  // Enable CORS with security considerations
  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      const allowedOrigins = [
        configService.get<string>('FRONTEND_URL') || 'http://localhost:5173',
        configService.get<string>('ADMIN_FRONTEND_URL') || 'http://localhost:1574',
      ];
      
      // Allow same-origin requests and specified origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else if (!isProduction) {
        // In development, allow localhost with any port
        if (origin.match(/^https?:\/\/localhost:\d+$/)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'Accept',
      'Origin',
      'Cache-Control',
      'X-File-Name'
    ],
    credentials: true,
    maxAge: 86400, // Cache preflight response for 24 hours
  });

  // Enhanced Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      disableErrorMessages: isProduction, // Hide detailed validation errors in production
      validateCustomDecorators: true,
      always: true,
    }),
  );

  // Request size limits
  app.use(express.json({ 
    limit: '10mb',
    verify: (req: any, res, buf) => {
      // Log large requests in production
      if (isProduction && buf.length > 1024 * 1024) { // > 1MB
        logger.warn(`Large request body: ${buf.length} bytes from ${req.ip}`);
      }
    }
  }));
  
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb' 
  }));

  // Swagger setup (disable in production for security)
  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle('Art Sharing API')
      .setDescription('The Art Sharing API description')
      .setVersion('1.0')
      .addTag('artsharing')
      .addBearerAuth() // Add authentication to swagger
      .build();
    
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    await SwaggerModule.loadPluginMetadata(metadata);
    SwaggerModule.setup('api', app, documentFactory, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    logger.log('Swagger documentation available at /api');
  }

  // Webhook middleware (before other body parsing)
  const webhookRawBodyMiddleware = express.raw({ type: 'application/json' });
  app.use(
    '/api/stripe/webhook',
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      // Enhanced webhook logging
      logger.log(`Webhook request received: ${req.method} ${req.originalUrl} from ${req.ip}`);
      webhookRawBodyMiddleware(req, res, next);
    },
  );

  // Security logging
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Log suspicious requests
    if (req.headers['user-agent']?.includes('bot') || 
        req.headers['user-agent']?.includes('crawler') ||
        req.path.includes('admin') ||
        req.path.includes('..') ||
        req.path.includes('wp-') ||
        req.path.includes('php')) {
      logger.warn(`Suspicious request: ${req.method} ${req.path} from ${req.ip} - User-Agent: ${req.headers['user-agent']}`);
    }
    next();
  });

  const webSocketGuard = app.get(WebSocketJwtAuthGuard);
  app.useGlobalGuards(webSocketGuard);
  await app.listen(port, '0.0.0.0');
  
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`🔒 Security: ${isProduction ? 'Production' : 'Development'} mode`);
  logger.log(`📊 Environment: ${configService.get<string>('NODE_ENV')}`);
}

bootstrap().catch((error) => {
  console.error('❌ Error starting the application:', error);
  process.exit(1);
});