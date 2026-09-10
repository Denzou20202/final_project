import { NotificationEntity, TicketEntity, UserEntity } from '@veloxdesk/database';
import { Locale, NotificationChannel, NotificationJobPayload, NOTIFICATIONS_QUEUE_NAME } from '@veloxdesk/types';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { MailerService } from './mailer.service.js';
import { renderNotificationEmail } from './notification-templates.js';

@Processor(NOTIFICATIONS_QUEUE_NAME)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly mailer: MailerService,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectRepository(TicketEntity)
    private readonly ticketsRepository: Repository<TicketEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notificationsRepository: Repository<NotificationEntity>,
  ) {
    super();
  }

  async process(job: Job<NotificationJobPayload>): Promise<void> {
    const { type, userId, ticketId } = job.data;

    const [user, ticket] = await Promise.all([
      this.usersRepository.findOne({ where: { id: userId } }),
      this.ticketsRepository.findOne({ where: { id: ticketId }, relations: ['status'] }),
    ]);

    if (!user) {
      this.logger.warn(`Skipping notification ${job.id}: user ${userId} not found`);
      return;
    }
    if (!ticket) {
      this.logger.warn(`Skipping notification ${job.id}: ticket ${ticketId} not found`);
      return;
    }

    const email = renderNotificationEmail(
      type,
      {
        recipientName: user.fullName,
        ticketTitle: ticket.title,
        ticketStatusName: ticket.status.name,
      },
      user.locale ?? Locale.RU,
    );

    // Record before send, not after — this job has up to 3 BullMQ retries
    // on any thrown error. Sending first meant a DB write failure right
    // after a successful send (a transient Postgres blip, a crash) still
    // threw, so the retry resent an email that had already gone out. If the
    // record write itself fails now, nothing has been sent yet, so the
    // retry is a clean first attempt. The only residual case — send fails
    // after a successful record write — just leaves one extra notification
    // row behind on the eventual successful retry, which is harmless.
    //
    // Only written on the first attempt (attemptsMade === 0), though: without
    // this guard, a transient failure on attempt 1 followed by a successful
    // attempt 2/3 would leave 1-2 extra rows behind too, each asserting an
    // email was sent that never was — not harmless, since it's a false
    // record rather than just a duplicate. NotificationEntity has no job-id/
    // idempotency-key column to look up "does attempt 0's row already
    // exist", so retries just skip the write entirely rather than attempt
    // that lookup; the send itself is still retried below regardless.
    if (job.attemptsMade === 0) {
      const record = this.notificationsRepository.create({
        userId,
        type,
        channel: NotificationChannel.EMAIL,
        isRead: false,
        ticketId,
      });
      await this.notificationsRepository.save(record);
    }

    await this.mailer.send(user.email, email.subject, email.text);

    this.logger.log(`Sent ${type} notification for ticket ${ticketId} to ${user.email}`);
  }
}
