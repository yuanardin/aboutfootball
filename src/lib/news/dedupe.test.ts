import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeArticlesById } from './dedupe';

type Story = { id: string; title: string };

// Mirrors deterministicId(title, url): same title + same URL => same id.
const duplicatePair: Story[] = [
  {
    id: 'a-risk-not-worth-taking-pl-execs-not-expecting-clubs-to-vote-1xdtdol',
    title: 'A risk not worth taking',
  },
  {
    id: 'a-risk-not-worth-taking-pl-execs-not-expecting-clubs-to-vote-1xdtdol',
    title: 'A risk not worth taking',
  },
];

describe('dedupeArticlesById', () => {
  it('collapses provider duplicate entries to a single card, keeping the first occurrence', () => {
    const articles: Story[] = [
      { id: 'top-story-abc123', title: 'Top story' },
      ...duplicatePair,
      { id: 'other-story-def456', title: 'Other story' },
    ];

    const result = dedupeArticlesById(articles);

    assert.deepEqual(
      result.map((article) => article.id),
      [
        'top-story-abc123',
        'a-risk-not-worth-taking-pl-execs-not-expecting-clubs-to-vote-1xdtdol',
        'other-story-def456',
      ]
    );
  });

  it('never removes distinct articles', () => {
    const articles: Story[] = [
      { id: 'story-one-111', title: 'Story one' },
      { id: 'story-two-222', title: 'Story two' },
      { id: 'story-three-333', title: 'Story three' },
    ];

    assert.equal(dedupeArticlesById(articles).length, 3);
  });

  it('returns an empty list untouched', () => {
    assert.deepEqual(dedupeArticlesById([]), []);
  });
});
