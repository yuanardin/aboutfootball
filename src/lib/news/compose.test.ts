import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { composeNewsGrid } from './compose';
import type { NewsArticle } from '@/lib/types';

const DUPLICATE_ID = 'a-risk-not-worth-taking-pl-execs-not-expecting-clubs-to-vote-1xdtdol';

function story(overrides: Partial<NewsArticle> & { id: string; title: string }): NewsArticle {
  return {
    excerpt: `${overrides.title} excerpt`,
    source: 'Live source',
    date: 'Recently',
    imageId: 'news-1',
    category: 'Football',
    ...overrides,
  };
}

// The exact browser case: the provider returned the same story twice, so the
// identical id reaches the client twice.
function feedWithDuplicate(): NewsArticle[] {
  return [
    story({ id: 'top-story-abc123', title: 'Top story' }),
    story({ id: DUPLICATE_ID, title: 'A risk not worth taking' }),
    story({ id: DUPLICATE_ID, title: 'A risk not worth taking' }),
    story({ id: 'other-story-def456', title: 'Other story' }),
  ];
}

function assertUniqueIds(articles: readonly NewsArticle[], scope: string) {
  const ids = articles.map((article) => article.id);
  assert.deepEqual(
    [...new Set(ids)],
    ids,
    `${scope} must not contain a duplicate id`
  );
}

describe('composeNewsGrid regression: duplicate provider entry', () => {
  it('final grid contains the duplicated id only once', () => {
    const { gridArticles, featuredArticle } = composeNewsGrid(feedWithDuplicate(), {
      searchTerm: '',
      activeCategory: 'All',
    });

    const rendered = [...(featuredArticle ? [featuredArticle] : []), ...gridArticles];
    assert.equal(
      rendered.filter((article) => article.id === DUPLICATE_ID).length,
      1
    );
    assertUniqueIds(gridArticles, 'gridArticles');
  });

  it('two distinct articles remain two', () => {
    const { gridArticles, featuredArticle } = composeNewsGrid(
      [
        story({ id: 'story-one-111', title: 'Story one' }),
        story({ id: 'story-two-222', title: 'Story two' }),
      ],
      { searchTerm: '', activeCategory: 'All' }
    );

    const rendered = [...(featuredArticle ? [featuredArticle] : []), ...gridArticles];
    assert.equal(rendered.length, 2);
    assertUniqueIds(rendered, 'rendered stories');
  });

  it('featured article is not duplicated into the grid', () => {
    const { gridArticles, featuredArticle } = composeNewsGrid(feedWithDuplicate(), {
      searchTerm: '',
      activeCategory: 'All',
    });

    assert.ok(featuredArticle);
    assert.ok(
      !gridArticles.some((article) => article.id === featuredArticle.id),
      'featured story must not appear in the grid'
    );
  });

  it('repeated refresh / search / filter cycles never create duplicates', () => {
    const feed = feedWithDuplicate();
    const cycles: Array<{ searchTerm: string; activeCategory: string }> = [
      { searchTerm: '', activeCategory: 'All' },
      { searchTerm: 'risk', activeCategory: 'All' },
      { searchTerm: '', activeCategory: 'Football' },
      { searchTerm: 'story', activeCategory: 'All' },
      { searchTerm: '', activeCategory: 'All' },
    ];

    for (const filters of cycles) {
      const { gridArticles, featuredArticle } = composeNewsGrid(feed, filters);
      const rendered = [...(featuredArticle ? [featuredArticle] : []), ...gridArticles];
      assertUniqueIds(rendered, `rendered stories (${JSON.stringify(filters)})`);
    }

    // Same feed composed twice (refresh / remount) yields the same clean list.
    const first = composeNewsGrid(feed, { searchTerm: '', activeCategory: 'All' });
    const second = composeNewsGrid(feed, { searchTerm: '', activeCategory: 'All' });
    assert.deepEqual(
      second.gridArticles.map((article) => article.id),
      first.gridArticles.map((article) => article.id)
    );
  });
});
