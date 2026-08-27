import { CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '@veloxdesk/common';
import type { JwtPayload } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AssignCategoryDto } from './dto/assign-category.dto.js';
import { AssignTeamDto } from './dto/assign-team.dto.js';
import { AssignTicketDto } from './dto/assign-ticket.dto.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { ListTicketsQueryDto } from './dto/list-tickets-query.dto.js';
import { MergeTicketDto } from './dto/merge-ticket.dto.js';
import { TicketCountsQueryDto } from './dto/ticket-counts-query.dto.js';
import { UpdatePriorityDto } from './dto/update-priority.dto.js';
import { UpdateStatusDto } from './dto/update-status.dto.js';
import { UpdateTicketDto } from './dto/update-ticket.dto.js';
import { TicketsService } from './tickets.service.js';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser() actor: JwtPayload) {
    return this.ticketsService.create(dto, actor);
  }

  @Get()
  list(@Query() query: ListTicketsQueryDto, @CurrentUser() actor: JwtPayload) {
    return this.ticketsService.list(query, actor);
  }

  // Must come before @Get(':id') — otherwise Nest's route matching treats
  // "counts"/"trash" as the :id param and these never get hit.
  @Get('counts')
  getCounts(@Query() query: TicketCountsQueryDto, @CurrentUser() actor: JwtPayload) {
    return this.ticketsService.getCounts(query, actor);
  }

  // Also ahead of @Get(':id') for the same reason. One request each instead
  // of one per team/tag rendered in the sidebar.
  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Get('counts/by-team')
  getCountsByTeam(@CurrentUser() actor: JwtPayload) {
    return this.ticketsService.getCountsByTeam(actor);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Get('counts/by-tag')
  getCountsByTag(@CurrentUser() actor: JwtPayload) {
    return this.ticketsService.getCountsByTag(actor);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Get('trash')
  listTrash(@CurrentUser() actor: JwtPayload) {
    return this.ticketsService.listTrash(actor);
  }

  // Also before @Get(':id') for the same reason, and structurally distinct
  // from it anyway (two path segments vs one) — kept alongside its siblings
  // above for readability.
  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Get('by-number/:ticketNumber')
  findByNumber(@Param('ticketNumber', ParseIntPipe) ticketNumber: number, @CurrentUser() actor: JwtPayload) {
    return this.ticketsService.findByNumber(ticketNumber, actor);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.ticketsService.findOne(id, actor);
  }

  @Get(':id/activity')
  getActivity(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.ticketsService.getActivity(id, actor);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.ticketsService.update(id, dto, actor);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.ticketsService.updateStatus(id, dto, actor);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Patch(':id/priority')
  updatePriority(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriorityDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.ticketsService.updatePriority(id, dto, actor);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Patch(':id/assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTicketDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.ticketsService.assign(id, dto, actor);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Patch(':id/team')
  assignTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTeamDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.ticketsService.assignTeam(id, dto, actor);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Patch(':id/category')
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignCategoryDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.ticketsService.updateCategory(id, dto, actor);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Post(':id/merge')
  merge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MergeTicketDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.ticketsService.merge(id, dto, actor);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.ticketsService.remove(id, actor);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Post(':id/restore')
  restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.ticketsService.restore(id, actor);
  }

  // Permanent — only reachable for a ticket already in Trash (see
  // TicketsService.hardDelete's findDeletedById guard), a real SQL DELETE,
  // not another soft-delete on top of the existing one.
  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/permanent')
  hardDelete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.ticketsService.hardDelete(id, actor);
  }

  // CLIENT included: a client can now follow their own ticket too, same as
  // staff following any ticket — the service methods enforce the client can
  // only ever touch their own (see getOwnedTicketOrThrow-equivalent checks
  // in TicketsService.watch/unwatch/getWatchStatus).
  @Roles(UserRole.OPERATOR, UserRole.ADMIN, UserRole.CLIENT)
  @Get(':id/watch')
  getWatchStatus(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.ticketsService.getWatchStatus(id, actor);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN, UserRole.CLIENT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/watch')
  watch(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.ticketsService.watch(id, actor);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN, UserRole.CLIENT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id/watch')
  unwatch(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.ticketsService.unwatch(id, actor);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Get(':id/export')
  async exportTranscript(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, content } = await this.ticketsService.exportTranscript(id, actor);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Roles(UserRole.OPERATOR, UserRole.ADMIN)
  @Post(':id/send-status')
  sendStatusEmail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.ticketsService.sendStatusEmail(id, actor);
  }
}
