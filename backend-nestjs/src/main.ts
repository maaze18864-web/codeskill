import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';
import { ConfigService } from '@nestjs/config';
import { RedisIoAdapter } from './gateway/redis-io.adapter';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { json } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { resolveAllowedCorsOrigins, isOriginAllowed } from './common/cors.util';

async function bootstrap() {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  );

  const winstonTransports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, context, stack }) => {
          return `[${timestamp}] [${level}] ${context ? `[${context}] ` : ''}${message}${stack ? `\n${stack}` : ''}`;
        }),
      ),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileFormat,
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 5,
    }),
  ];

  if (process.env.AXIOM_TOKEN && process.env.AXIOM_DATASET) {
    try {
      const { AxiomWinstonTransport } = require('./observability/logger/axiom.winston-transport');
      winstonTransports.push(
        new AxiomWinstonTransport({
          dataset: process.env.AXIOM_DATASET,
          token: process.env.AXIOM_TOKEN,
          edgeUrl: process.env.AXIOM_EDGE_URL || 'https://eu-central-1.aws.edge.axiom.co',
          service: 'codeskill-backend',
        }),
      );
    } catch {
      // Fail-open if transport cannot be loaded
    }
  }

  const logger = WinstonModule.createLogger({
    transports: winstonTransports,
  });

  process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled Promise Rejection', {
      reason: reason instanceof Error ? reason.message : reason,
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  process.on('uncaughtException', (err: Error) => {
    logger.error('Uncaught Exception', {
      error: err?.message,
      stack: err?.stack,
    });
  });

  const app = await NestFactory.create(AppModule, { logger, bodyParser: false });

  // Trust proxy for managed reverse proxy / AWS Application Load Balancer (ISSUE-SEC-003)
  const expressApp = app.getHttpAdapter().getInstance();
  if (typeof expressApp?.set === 'function') {
    expressApp.set('trust proxy', 'loopback, linklocal, uniquelocal');
  }

  // Screen captures are authenticated JPEG data URLs; allow the compressed
  // payload while keeping a bounded request size.
  app.use(json({ limit: '4mb' }));
  app.enableShutdownHooks();

  // HTTP access logging middleware to file & console
  app.use((req: any, res: any, next: any) => {
    const start = Date.now();
    const { method, originalUrl, ip } = req;
    res.on('finish', () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;
      const logMsg = `${method} ${originalUrl} ${statusCode} in ${duration}ms [${ip}]`;
      if (statusCode >= 500) {
        logger.error(logMsg, { context: 'HTTP', method, url: originalUrl, statusCode, duration, ip });
      } else if (statusCode >= 400) {
        logger.warn(logMsg, { context: 'HTTP', method, url: originalUrl, statusCode, duration, ip });
      } else if (!originalUrl.startsWith('/api/health')) {
        logger.log(logMsg, { context: 'HTTP', method, url: originalUrl, statusCode, duration, ip });
      }
    });
    next();
  });

  // Global prefix
  app.setGlobalPrefix('api');

  // Security
  app.use(helmet());
  app.use(compression());

  // CORS
  const isProd = process.env.NODE_ENV === 'production';
  const allowedOrigins = resolveAllowedCorsOrigins();
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (isOriginAllowed(origin, allowedOrigins, isProd)) {
        callback(null, true);
      } else {
        callback(new Error('CORS origin rejected by security policy'));
      }
    },
    credentials: true,
  });

  // Redis Socket.IO adapter
  const configService = app.get(ConfigService);
  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(configService);
  app.useWebSocketAdapter(redisIoAdapter);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger — disabled in production unless explicitly opted in via SWAGGER_ENABLED=true
  const swaggerEnabled =
    process.env.NODE_ENV !== 'production' ||
    process.env.SWAGGER_ENABLED === 'true';

  const port = process.env.PORT || 5001;

  if (swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('CodeSkill API')
      .setDescription(
        'CodeSkill Online Judge — Chandigarh University Assessment Platform',
      )
      .setVersion('2.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);
  console.log(`\n🚀 CodeSkill NestJS API running on port ${port}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  if (swaggerEnabled) {
    console.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
  } else {
    console.log(`📖 Swagger docs: DISABLED in production (set SWAGGER_ENABLED=true to enable)`);
  }
  console.log('');
}
bootstrap();

