import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TagsRepository } from './tags.repository.js';
import { TagsService } from './tags.service.js';

describe('TagsService.remove', () => {
  let tagsRepository: jest.Mocked<Pick<TagsRepository, 'findById' | 'countTicketsForTag' | 'deleteIfUnused'>>;
  let service: TagsService;

  beforeEach(() => {
    tagsRepository = {
      findById: jest.fn(),
      countTicketsForTag: jest.fn(),
      deleteIfUnused: jest.fn(),
    };
    service = new TagsService(tagsRepository as unknown as TagsRepository, {} as never, {} as never, {} as never);
  });

  it('throws for a nonexistent tag', async () => {
    tagsRepository.findById.mockResolvedValue(null);
    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    expect(tagsRepository.deleteIfUnused).not.toHaveBeenCalled();
  });

  it('rejects deleting a tag that still has tickets', async () => {
    tagsRepository.findById.mockResolvedValue({ id: 'tag-1', name: 'Срочно', createdAt: new Date() } as never);
    tagsRepository.deleteIfUnused.mockResolvedValue(false);
    tagsRepository.countTicketsForTag.mockResolvedValue(3);

    await expect(service.remove('tag-1')).rejects.toThrow(BadRequestException);
    expect(tagsRepository.deleteIfUnused).toHaveBeenCalledWith('tag-1');
  });

  it('deletes a tag with zero tickets', async () => {
    tagsRepository.findById.mockResolvedValue({ id: 'tag-1', name: 'Срочно', createdAt: new Date() } as never);
    tagsRepository.deleteIfUnused.mockResolvedValue(true);

    await service.remove('tag-1');

    expect(tagsRepository.deleteIfUnused).toHaveBeenCalledWith('tag-1');
    expect(tagsRepository.countTicketsForTag).not.toHaveBeenCalled();
  });
});

describe('TagsService.rename', () => {
  let tagsRepository: jest.Mocked<Pick<TagsRepository, 'findById' | 'findByName' | 'updateName'>>;
  let service: TagsService;

  beforeEach(() => {
    tagsRepository = {
      findById: jest.fn(),
      findByName: jest.fn(),
      updateName: jest.fn(),
    };
    service = new TagsService(tagsRepository as unknown as TagsRepository, {} as never, {} as never, {} as never);
  });

  it('throws for a nonexistent tag', async () => {
    tagsRepository.findById.mockResolvedValue(null);
    await expect(service.rename('missing', 'Новое имя')).rejects.toThrow(NotFoundException);
    expect(tagsRepository.updateName).not.toHaveBeenCalled();
  });

  it('rejects renaming to a name another tag already has', async () => {
    tagsRepository.findById.mockResolvedValue({ id: 'tag-1', name: 'Срочно', createdAt: new Date() } as never);
    tagsRepository.findByName.mockResolvedValue({ id: 'tag-2', name: 'VIP', createdAt: new Date() } as never);

    await expect(service.rename('tag-1', 'VIP')).rejects.toThrow(BadRequestException);
    expect(tagsRepository.updateName).not.toHaveBeenCalled();
  });

  it('is a no-op when the name is unchanged', async () => {
    tagsRepository.findById.mockResolvedValue({ id: 'tag-1', name: 'Срочно', createdAt: new Date() } as never);

    await service.rename('tag-1', 'Срочно');

    expect(tagsRepository.findByName).not.toHaveBeenCalled();
    expect(tagsRepository.updateName).not.toHaveBeenCalled();
  });

  it('renames a tag to a free name', async () => {
    tagsRepository.findById.mockResolvedValue({ id: 'tag-1', name: 'Срочно', createdAt: new Date() } as never);
    tagsRepository.findByName.mockResolvedValue(null);

    const result = await service.rename('tag-1', '  Очень срочно  ');

    expect(tagsRepository.updateName).toHaveBeenCalledWith('tag-1', 'Очень срочно', null, null);
    expect(result.name).toBe('Очень срочно');
  });

  it('allows renaming when collision returns the same tag id (case-only change)', async () => {
    tagsRepository.findById.mockResolvedValue({ id: 'tag-1', name: 'admin-tag', createdAt: new Date() } as never);
    tagsRepository.findByName.mockResolvedValue({ id: 'tag-1', name: 'admin-tag', createdAt: new Date() } as never);

    const result = await service.rename('tag-1', 'Admin-Tag');

    expect(tagsRepository.updateName).toHaveBeenCalledWith('tag-1', 'Admin-Tag', null, null);
    expect(result.name).toBe('Admin-Tag');
  });
});

describe('TagsService.addToTicket case-insensitivity', () => {
  let tagsRepository: {
    findByName: jest.Mock;
    findOrCreateByName: jest.Mock;
    isLinked: jest.Mock;
    linkToTicket: jest.Mock;
  };
  let ticketsService: { assertAccess: jest.Mock };
  let activityRepository: { log: jest.Mock };
  let searchIndexProducer: { enqueueTicket: jest.Mock };
  let service: TagsService;

  beforeEach(() => {
    tagsRepository = {
      findByName: jest.fn(),
      findOrCreateByName: jest.fn(),
      isLinked: jest.fn().mockResolvedValue(false),
      linkToTicket: jest.fn().mockResolvedValue(undefined),
    };
    ticketsService = { assertAccess: jest.fn().mockResolvedValue(undefined) };
    activityRepository = { log: jest.fn().mockResolvedValue(undefined) };
    searchIndexProducer = { enqueueTicket: jest.fn().mockResolvedValue(undefined) };

    service = new TagsService(
      tagsRepository as never,
      ticketsService as never,
      activityRepository as never,
      searchIndexProducer as never,
    );
  });

  it('allows operator to attach existing tag when entered in uppercase (ADMIN-TAG vs admin-tag)', async () => {
    const existingTag = { id: 'tag-1', name: 'admin-tag', createdAt: new Date() };
    tagsRepository.findByName.mockResolvedValue(existingTag);

    const actor = { sub: 'op-1', email: 'op@example.com', role: 'operator' as never };
    const result = await service.addToTicket('ticket-1', 'ADMIN-TAG', actor);

    expect(tagsRepository.findByName).toHaveBeenCalledWith('ADMIN-TAG');
    expect(tagsRepository.findOrCreateByName).not.toHaveBeenCalled();
    expect(tagsRepository.linkToTicket).toHaveBeenCalledWith('ticket-1', 'tag-1');
    expect(result.name).toBe('admin-tag');
  });

  it('rejects operator trying to create a genuinely new tag', async () => {
    tagsRepository.findByName.mockResolvedValue(null);

    const actor = { sub: 'op-1', email: 'op@example.com', role: 'operator' as never };
    await expect(service.addToTicket('ticket-1', 'NON-EXISTENT', actor)).rejects.toThrow(BadRequestException);
  });
});
