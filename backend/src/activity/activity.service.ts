import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LoginEvent, ProfileVisit } from './activity.schemas';

/** Registra la actividad que se grafica en el dashboard: ingresos y visitas a perfiles. */
@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(LoginEvent.name) private readonly logins: Model<LoginEvent>,
    @InjectModel(ProfileVisit.name) private readonly visits: Model<ProfileVisit>,
  ) {}

  recordLogin(userId: string | Types.ObjectId) {
    return this.logins.create({ user: userId });
  }

  /** Guarda la visita sólo si quien mira no es el dueño del perfil. */
  async recordVisit(profileId: string | Types.ObjectId, visitorId: string) {
    if (String(profileId) === visitorId) return;
    await this.visits.create({ profile: profileId, visitor: visitorId });
  }

  /** Cantidad total de visitas que recibió un perfil (de otros usuarios). */
  visitsTo(profileId: Types.ObjectId) {
    return this.visits.countDocuments({ profile: profileId });
  }
}
