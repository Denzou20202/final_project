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
});
