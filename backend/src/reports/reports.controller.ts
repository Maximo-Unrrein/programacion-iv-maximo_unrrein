import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { CreateReportDto, ReportsQueryDto, ResolveReportDto } from './reports.dto';
import { ReportsService } from './reports.service';

/** Moderación: cualquier usuario reporta; sólo los administradores ven la cola y resuelven. */
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** Reporta una publicación o un comentario. Responde 201. */
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateReportDto) {
    return this.reports.create(user.sub, dto);
  }

  /** Cola de moderación agrupada por contenido. `?status=pendiente|resuelto|descartado` */
  @Get()
  @Roles('admin')
  queue(@Query() query: ReportsQueryDto) {
    return this.reports.queue(query.status);
  }

  @Get('pending-count')
  @Roles('admin')
  pendingCount() {
    return this.reports.pendingCount();
  }

  /** `{ action: 'eliminar' | 'descartar' }` sobre todas las denuncias pendientes del contenido. */
  @Post(':targetId/resolve')
  @Roles('admin')
  @HttpCode(200)
  resolve(@Param('targetId') targetId: string, @CurrentUser() user: JwtPayload, @Body() dto: ResolveReportDto) {
    return this.reports.resolve(targetId, dto.action, user);
  }
}
