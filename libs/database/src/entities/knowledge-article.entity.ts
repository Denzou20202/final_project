import { KnowledgeArticleStatus } from '@veloxdesk/types';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './user.entity.js';

@Entity('knowledge_articles')
export class KnowledgeArticleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  // Auto-filled via DeepL on create/edit, editable before save — see
  // TicketStatusEntity.nameUk's comment. Only the title translates; `content`
  // (the actual article body) stays admin-language-only by design.
  @Column({ name: 'title_uk', type: 'varchar', length: 255, nullable: true })
  titleUk?: string | null;

  @Column({ name: 'title_en', type: 'varchar', length: 255, nullable: true })
  titleEn?: string | null;

  @Column({ type: 'text' })
  content!: string;

  @Index()
  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'author_id' })
  author!: UserEntity;

  // Indexed — ArticlesRepository.findPage filters on this for every public
  // FAQ listing and the admin article list.
  @Index()
  @Column({ type: 'enum', enum: KnowledgeArticleStatus, default: KnowledgeArticleStatus.DRAFT })
  status!: KnowledgeArticleStatus;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt?: Date | null;

  // Bumped once per public read (see ArticlesRepository.incrementViewCount)
  // — an atomic UPDATE ... SET view_count = view_count + 1, never a
  // read-modify-write, so concurrent viewers can't clobber each other's
  // increment. Also the sort key behind the FAQ's "популярное" ordering
  // (indexed for that ORDER BY + the offset pagination in findPage).
  @Index()
  @Column({ name: 'view_count', type: 'integer', default: 0 })
  viewCount!: number;

  // Anonymous "полезно/не полезно" tally from the public FAQ — there's no
  // visitor identity to key a vote on (the FAQ is unauthenticated by
  // design), so this is a simple counter pair, not a per-user vote table.
  // The client-side soft-dedup (localStorage) lives in client-portal only.
  @Column({ name: 'helpful_count', type: 'integer', default: 0 })
  helpfulCount!: number;

  @Column({ name: 'not_helpful_count', type: 'integer', default: 0 })
  notHelpfulCount!: number;

  // Gates anonymous /faq visibility: true = visible on the unauthenticated
  // public FAQ; false = requires an authenticated client/operator/admin
  // token (see OptionalJwtAuthGuard on PublicArticlesController). Independent
  // of `status` — a private article can still be published, just not
  // reachable by a logged-out visitor.
  @Column({ name: 'is_public', type: 'boolean', default: false })
  isPublic!: boolean;

  // Indexed — the default sort field for findPage's keyset pagination, same
  // reasoning as the AddCreatedAtIndexes migration's treatment of
  // tickets/comments/ticket_activities (this table just didn't get it then).
  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
