import type { WordPressAuthor, WordPressCategory, WordPressMedia, WordPressPost, WordPressTag } from './schemas.js';
/**
 * Supported relation names for fluent post hydration.
 */
export type PostRelation = 'author' | 'categories' | 'tags' | 'terms' | 'featuredMedia';
/**
 * Client surface required by the post relation hydrator.
 */
export interface PostRelationClient {
    getPost: (id: number) => Promise<WordPressPost>;
    getPostBySlug: (slug: string) => Promise<WordPressPost | undefined>;
    getUser: (id: number) => Promise<WordPressAuthor>;
    getUsers?: (filter?: {
        include?: number[];
        perPage?: number;
    }) => Promise<WordPressAuthor[]>;
    getCategories: (filter?: {
        include?: number[];
    }) => Promise<WordPressCategory[]>;
    getTags: (filter?: {
        include?: number[];
    }) => Promise<WordPressTag[]>;
    getMediaItem: (id: number) => Promise<WordPressMedia>;
}
/**
 * Helper map used to derive relation result types.
 */
interface PostRelationMap {
    author: WordPressAuthor | null;
    categories: WordPressCategory[];
    tags: WordPressTag[];
    terms: {
        categories: WordPressCategory[];
        tags: WordPressTag[];
    };
    featuredMedia: WordPressMedia | null;
}
/**
 * Simplifies intersection output for cleaner consumer hover types.
 */
type Simplify<T> = {
    [K in keyof T]: T[K];
} & {};
/**
 * Converts a union to an intersection for selected relation keys.
 */
type UnionToIntersection<T> = (T extends unknown ? (value: T) => void : never) extends ((value: infer R) => void) ? R : never;
/**
 * Builds the selected relation result type for fluent relation calls.
 */
export type SelectedPostRelations<TRelations extends readonly PostRelation[]> = [TRelations[number]] extends [never] ? {} : Simplify<UnionToIntersection<TRelations[number] extends infer K ? K extends keyof PostRelationMap ? {
    [P in K]: PostRelationMap[P];
} : never : never>>;
/**
 * Fluent builder that hydrates one post and selected related entities.
 */
export declare class PostRelationQueryBuilder<TRelations extends readonly PostRelation[] = []> {
    private readonly client;
    private readonly selector;
    private readonly relationSet;
    constructor(client: PostRelationClient, selector: {
        id?: number;
        slug?: string;
    }, relations?: readonly PostRelation[]);
    /**
     * Adds relation names to the hydration plan.
     */
    with<TNext extends readonly PostRelation[]>(...relations: TNext): PostRelationQueryBuilder<[...TRelations, ...TNext]>;
    /**
     * Fetches the selected post and resolves requested relations.
     */
    get(): Promise<WordPressPost & {
        related: SelectedPostRelations<TRelations>;
    }>;
}
export {};
