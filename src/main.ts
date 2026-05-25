import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    ...(process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',').map((u) => u.trim())
      : []),
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });



  
  // Global pipes, filters, interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // API versioning prefix
  app.setGlobalPrefix('api/v1');

  // Swagger (non-production only)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('MediSync API')
      .setDescription('Medical Management System API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`MediSync API running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
