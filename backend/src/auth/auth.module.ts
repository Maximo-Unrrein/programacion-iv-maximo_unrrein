import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ActivityModule } from '../activity/activity.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Global()
@Module({
  imports: [
    UsersModule,
    ActivityModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.getOrThrow<string>('JWT_SECRET');
        // En producción no se arranca con un secreto de ejemplo o fácil de adivinar
        if (process.env.NODE_ENV === 'production' && secret.length < 32) {
          throw new Error('JWT_SECRET es demasiado corto para producción (mínimo 32 caracteres)');
        }
        return { secret, signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '15m') } };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  // UsersModule se re-exporta porque JwtAuthGuard lo necesita en cualquier módulo que lo use
  exports: [JwtModule, JwtAuthGuard, UsersModule],
})
export class AuthModule {}
