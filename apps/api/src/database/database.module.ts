import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaService } from "./prisma.service";
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < 32 || secret.includes("replace-with"))
          throw new Error(
            "Set JWT_SECRET to a random value of at least 32 characters",
          );
        const issuer = process.env.JWT_ISSUER ?? "topic4",
          audience = process.env.JWT_AUDIENCE ?? "topic4-api";
        return {
          secret,
          signOptions: {
            expiresIn: "15m",
            algorithm: "HS256",
            issuer,
            audience,
          },
          verifyOptions: { algorithms: ["HS256"], issuer, audience },
        };
      },
    }),
  ],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
