import { JwtPayload } from '@veloxdesk/common';
import { UserRole } from '@veloxdesk/types';
import { NotFoundException } from '@nestjs/common';
import { CustomFieldsService } from './custom-fields.service.js';

function makeActor(): JwtPayload {
  return { sub: 'operator-1', email: 'operator@veloxdesk.local', role: UserRole.OPERATOR, restrictToDepartments: true };
}

describe('CustomFieldsService — ticket access scoping', () => {
  let customFieldsRepository: { findById: jest.Mock };
  let valuesRepository: { findByTicket: jest.Mock; upsert: jest.Mock; delete: jest.Mock };
  let ticketsService: { assertAccess: jest.Mock };
  let settingsAuditLog: { log: jest.Mock };
  let attachmentsRepository: { findOne: jest.Mock };
  let service: CustomFieldsService;

  beforeEach(() => {
    customFieldsRepository = {
      findById: jest.fn().mockResolvedValue({ id: 'field-1', fieldType: 'text' }),
    };
    valuesRepository = { findByTicket: jest.fn().mockResolvedValue([]), upsert: jest.fn(), delete: jest.fn() };
    ticketsService = { assertAccess: jest.fn().mockResolvedValue(undefined) };
    settingsAuditLog = { log: jest.fn() };
    attachmentsRepository = { findOne: jest.fn() };
    service = new CustomFieldsService(
      customFieldsRepository as never,
      valuesRepository as never,
      ticketsService as never,
      settingsAuditLog as never,
      attachmentsRepository as never,
    );
  });

  it('checks ticket access before reading values when called with an actor', async () => {
    await service.getValuesForTicket('ticket-1', makeActor());
    expect(ticketsService.assertAccess).toHaveBeenCalledWith('ticket-1', makeActor());
  });

  it('rejects reading values for a ticket outside the actor scope', async () => {
    ticketsService.assertAccess.mockRejectedValue(new NotFoundException());
    await expect(service.getValuesForTicket('ticket-1', makeActor())).rejects.toThrow(NotFoundException);
    expect(valuesRepository.findByTicket).not.toHaveBeenCalled();
  });

  it('checks ticket access before writing a value when called with an actor', async () => {
    await service.setValue('ticket-1', 'field-1', 'hello', makeActor());
    expect(ticketsService.assertAccess).toHaveBeenCalledWith('ticket-1', makeActor());
    expect(valuesRepository.upsert).toHaveBeenCalledWith('ticket-1', 'field-1', 'hello');
  });

  it('skips the access check for the automation engine (no actor)', async () => {
    await service.getValuesForTicket('ticket-1');
    await service.setValue('ticket-1', 'field-1', 'hello');
    expect(ticketsService.assertAccess).not.toHaveBeenCalled();
  });
});

describe('CustomFieldsService — value validation by field type', () => {
  let customFieldsRepository: { findById: jest.Mock };
  let valuesRepository: { findByTicket: jest.Mock; upsert: jest.Mock; delete: jest.Mock };
  let attachmentsRepository: { findOne: jest.Mock };
  let service: CustomFieldsService;

  beforeEach(() => {
    customFieldsRepository = { findById: jest.fn() };
    valuesRepository = { findByTicket: jest.fn().mockResolvedValue([]), upsert: jest.fn(), delete: jest.fn() };
    attachmentsRepository = { findOne: jest.fn() };
    service = new CustomFieldsService(
      customFieldsRepository as never,
      valuesRepository as never,
      { assertAccess: jest.fn() } as never,
      { log: jest.fn() } as never,
      attachmentsRepository as never,
    );
  });

  it('rejects a checkbox value that is not "true"/"false"', async () => {
    customFieldsRepository.findById.mockResolvedValue({ id: 'f1', label: 'Согласие', fieldType: 'checkbox' });
    await expect(service.setValue('ticket-1', 'f1', 'yes')).rejects.toThrow();
    expect(valuesRepository.upsert).not.toHaveBeenCalled();
  });

  it('accepts a checkbox value of "true"', async () => {
    customFieldsRepository.findById.mockResolvedValue({ id: 'f1', label: 'Согласие', fieldType: 'checkbox' });
    await service.setValue('ticket-1', 'f1', 'true');
    expect(valuesRepository.upsert).toHaveBeenCalledWith('ticket-1', 'f1', 'true');
  });

  it('rejects a regex value that does not match the pattern', async () => {
    customFieldsRepository.findById.mockResolvedValue({
      id: 'f1',
      label: 'Телефон',
      fieldType: 'regex',
      pattern: '^\\d{10}$',
    });
    await expect(service.setValue('ticket-1', 'f1', 'not-a-phone')).rejects.toThrow();
  });

  it('accepts a regex value that matches the pattern', async () => {
    customFieldsRepository.findById.mockResolvedValue({
      id: 'f1',
      label: 'Телефон',
      fieldType: 'regex',
      pattern: '^\\d{10}$',
    });
    await service.setValue('ticket-1', 'f1', '0991234567');
    expect(valuesRepository.upsert).toHaveBeenCalledWith('ticket-1', 'f1', '0991234567');
  });

  it('rejects a file value that references an attachment on a different ticket', async () => {
    customFieldsRepository.findById.mockResolvedValue({ id: 'f1', label: 'Скан', fieldType: 'file' });
    attachmentsRepository.findOne.mockResolvedValue({ id: 'att-1', ticketId: 'other-ticket' });
    await expect(service.setValue('ticket-1', 'f1', 'att-1')).rejects.toThrow();
  });

  it('accepts a file value that references an attachment on this ticket', async () => {
    customFieldsRepository.findById.mockResolvedValue({ id: 'f1', label: 'Скан', fieldType: 'file' });
    attachmentsRepository.findOne.mockResolvedValue({ id: 'att-1', ticketId: 'ticket-1' });
    await service.setValue('ticket-1', 'f1', 'att-1');
    expect(valuesRepository.upsert).toHaveBeenCalledWith('ticket-1', 'f1', 'att-1');
  });

  it('rejects a hierarchical select value not allowed for the parent field\'s current value', async () => {
    customFieldsRepository.findById.mockResolvedValue({
      id: 'child',
      label: 'Подкатегория',
      fieldType: 'select',
      dependsOnFieldId: 'parent',
      optionsByParent: { Software: ['Windows', 'macOS'] },
    });
    valuesRepository.findByTicket.mockResolvedValue([{ fieldId: 'parent', value: 'Software' }]);
    await expect(service.setValue('ticket-1', 'child', 'Printers')).rejects.toThrow();
  });

  it('accepts a hierarchical select value allowed for the parent field\'s current value', async () => {
    customFieldsRepository.findById.mockResolvedValue({
      id: 'child',
      label: 'Подкатегория',
      fieldType: 'select',
      dependsOnFieldId: 'parent',
      optionsByParent: { Software: ['Windows', 'macOS'] },
    });
    valuesRepository.findByTicket.mockResolvedValue([{ fieldId: 'parent', value: 'Software' }]);
    await service.setValue('ticket-1', 'child', 'Windows');
    expect(valuesRepository.upsert).toHaveBeenCalledWith('ticket-1', 'child', 'Windows');
  });
});
