import "./instrument";
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, BadRequestException } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const fs = require('fs');
        const logMessage = `[${new Date().toISOString()}] Validation Errors: ${JSON.stringify(errors, null, 2)}\n`;
        fs.appendFileSync('validation-errors.log', logMessage);
        return new BadRequestException(errors);
      },
    }),
  );

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 1000);
}
bootstrap();
