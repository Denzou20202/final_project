import { validate } from 'class-validator';
import { CreateTicketDto } from './create-ticket.dto.js';
import { UpdateTicketDto } from './update-ticket.dto.js';

describe('Ticket DTOs description validation', () => {
  it('rejects description longer than 50,000 characters in CreateTicketDto', async () => {
    const dto = new CreateTicketDto();
    dto.title = 'Valid title';
    dto.description = 'a'.repeat(50001);

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const descError = errors.find((e) => e.property === 'description');
    expect(descError).toBeDefined();
    expect(descError?.constraints).toHaveProperty('maxLength');
  });

  it('accepts valid description <= 50,000 characters in CreateTicketDto', async () => {
    const dto = new CreateTicketDto();
    dto.title = 'Valid title';
    dto.description = 'a'.repeat(50000);

    const errors = await validate(dto);
    const descError = errors.find((e) => e.property === 'description');
    expect(descError).toBeUndefined();
  });

  it('rejects description longer than 50,000 characters in UpdateTicketDto', async () => {
    const dto = new UpdateTicketDto();
    dto.description = 'a'.repeat(50001);

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const descError = errors.find((e) => e.property === 'description');
    expect(descError).toBeDefined();
    expect(descError?.constraints).toHaveProperty('maxLength');
  });
});
