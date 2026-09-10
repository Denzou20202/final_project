import type { ReactNode } from 'react';

// Elasticsearch wraps matches in <em>...</em>; splitting on that marker and
// rendering plain-text segments (rather than dangerouslySetInnerHTML) keeps
// React's normal text-escaping in place — article content is operator-
// authored but still shouldn't be trusted as raw HTML on a public page.
export function renderHighlight(fragment: string): ReactNode {
  return fragment.split(/(<em>.*?<\/em>)/g).map((part, index) => {
    const match = /^<em>(.*)<\/em>$/.exec(part);
    if (match) {
      return (
        <mark key={index} className="rounded bg-brand-100 px-0.5 text-brand-700">
          {match[1]}
        </mark>
      );
    }
    return part;
  });
}
