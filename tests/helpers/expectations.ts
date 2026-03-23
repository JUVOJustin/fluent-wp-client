import { expect } from 'vitest';

/**
 * Asserts author relation behavior for environments that expose or mask author IDs.
 *
 * WordPress environments vary in how they expose author data. Some return author ID 0
 * for posts with no explicit author, while others mask the ID entirely. This helper
 * normalizes these differences for consistent test assertions.
 *
 * @param authorId - The raw author ID from the post object
 * @param relatedAuthor - The hydrated author object from relation resolution
 */
export function expectAuthorRelation(
  authorId: number,
  relatedAuthor: { slug?: string } | null,
): void {
  if (authorId === 0) {
    expect(relatedAuthor).toBeNull();
    return;
  }

  expect(relatedAuthor).toBeTruthy();
  expect(relatedAuthor?.slug).toBe('admin');
}
