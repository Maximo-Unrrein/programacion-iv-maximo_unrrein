import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LoginEvent, LoginEventSchema, ProfileVisit, ProfileVisitSchema } from './activity.schemas';
import { ActivityService } from './activity.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LoginEvent.name, schema: LoginEventSchema },
      { name: ProfileVisit.name, schema: ProfileVisitSchema },
    ]),
  ],
  providers: [ActivityService],
  // Se exportan también los modelos para que Estadísticas pueda agregarlos
  exports: [ActivityService, MongooseModule],
})
export class ActivityModule {}
