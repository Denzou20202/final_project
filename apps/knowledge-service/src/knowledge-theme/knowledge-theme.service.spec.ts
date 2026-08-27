import { KnowledgeThemeService } from './knowledge-theme.service.js';

describe('KnowledgeThemeService', () => {
  let repository: { findTheme: jest.Mock; upsertTheme: jest.Mock };
  let service: KnowledgeThemeService;

  beforeEach(() => {
    repository = { findTheme: jest.fn(), upsertTheme: jest.fn() };
    service = new KnowledgeThemeService(repository as never);
  });

  it('returns nulls when nothing has ever been saved', async () => {
    repository.findTheme.mockResolvedValue({ id: 1, customCss: null, customJs: null });
    expect(await service.get()).toEqual({ customCss: null, customJs: null });
  });

  it('passes through saved values', async () => {
    repository.findTheme.mockResolvedValue({ id: 1, customCss: '.faq{color:red}', customJs: 'console.log(1)' });
    expect(await service.get()).toEqual({ customCss: '.faq{color:red}', customJs: 'console.log(1)' });
  });

  it('treats an empty string as clearing the field, not literally saving ""', async () => {
    repository.upsertTheme.mockResolvedValue({ id: 1, customCss: null, customJs: null });
    await service.update({ customCss: '', customJs: '' });
    expect(repository.upsertTheme).toHaveBeenCalledWith(null, null);
  });

  it('saves real content as-is', async () => {
    repository.upsertTheme.mockResolvedValue({ id: 1, customCss: '.faq{color:red}', customJs: null });
    await service.update({ customCss: '.faq{color:red}' });
    expect(repository.upsertTheme).toHaveBeenCalledWith('.faq{color:red}', null);
  });
});
