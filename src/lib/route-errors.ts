export type ErrorCopy = { title: string; description: string };

export function errorState(message?: string): ErrorCopy {
  const text = (message ?? '').toLowerCase();

  if (text.includes('newsapi') || text.includes('news feed')) {
    return {
      title: 'The newsroom is unreachable',
      description:
        'The live news provider could not be reached. Try again in a moment — we only feature real, up-to-the-minute stories.',
    };
  }

  if (text.includes('football-data') || text.includes('standings') || text.includes('results')) {
    return {
      title: 'The live feed is unavailable',
      description:
        'The football data provider returned no usable data. Try again shortly — we only show live, up-to-date records.',
    };
  }

  if (text.includes('timeout') || text.includes('network')) {
    return {
      title: 'Connection trouble',
      description: 'The request timed out or the network connection dropped. Check your connection and try again.',
    };
  }

  return {
    title: 'Something went wrong',
    description:
      'An unexpected error occurred while rendering this page. Try again, or head back to the homepage.',
  };
}