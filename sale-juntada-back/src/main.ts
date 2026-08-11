import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3001);
  const frontendOrigins = (
    process.env.FRONTEND_URLS ??
    process.env.FRONTEND_URL ??
    "http://localhost:5173"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.setGlobalPrefix("api");
  app.use(helmet());
  app.enableCors({
    origin: frontendOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (process.env.ENABLE_SWAGGER !== "false") {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("Sale Juntada API")
      .setDescription(
        "API para coordinar juntadas y encontrar horarios compatibles.",
      )
      .setVersion("0.1")
      .build();
    SwaggerModule.setup(
      "api/docs",
      app,
      SwaggerModule.createDocument(app, swaggerConfig),
    );
  }

  await app.listen(port, "0.0.0.0");
}

void bootstrap();
