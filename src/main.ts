import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { UPLOAD_ROOT } from './common/storage/storage.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Railway sits behind a proxy — needed so req.hostname reflects the real domain.
  app.set('trust proxy', 1);

  // Redirect naked domain → www (301 permanent, preserves path).
  app.use((req: any, res: any, next: any) => {
    if (req.hostname === 'lifecarecorp.in') {
      return res.redirect(301, `https://www.lifecarecorp.in${req.originalUrl}`);
    }
    next();
  });

  // Serve uploaded report files from /uploads (outside the /api/v1 prefix).
  app.useStaticAssets(UPLOAD_ROOT, { prefix: '/uploads/' });

  // Security — allow cross-origin file embeds (PDF preview) from the SPA.
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({
    origin: '*',
    credentials: false,
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
  await app.listen(port, '0.0.0.0');
  console.log(`MediSync API running on http://0.0.0.0:${port}`);
}
bootstrap();
