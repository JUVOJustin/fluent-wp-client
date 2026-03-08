import type { WordPressRequestOptions, WordPressRequestResult } from './client-types.js';
import type { WordPressStandardSchema } from './validation.js';
import { type ContentResourceClient, type DeleteOptions, type FetchResult, type PaginatedResponse, type PaginationParams, type QueryParams, type TermsResourceClient, type TermWriteInput, type WordPressDeleteResult, type WordPressWritePayload } from './types.js';
/**
 * Runtime hooks required for generic content and term method groups.
 */
export interface ContentTermMethodDependencies {
    fetchAPI: <T>(endpoint: string, params?: Record<string, string>) => Promise<T>;
    fetchAPIPaginated: <T>(endpoint: string, params?: Record<string, string>) => Promise<FetchResult<T>>;
    request: <T = unknown>(options: WordPressRequestOptions) => Promise<WordPressRequestResult<T>>;
    executeMutation: <T>(options: WordPressRequestOptions, responseSchema?: WordPressStandardSchema<T>) => Promise<T>;
}
/**
 * Creates generic content and taxonomy method groups used by the main client.
 */
export declare function createContentTermMethods(dependencies: ContentTermMethodDependencies): {
    getContentCollection: <TContent = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        date: import("zod").ZodString;
        date_gmt: import("zod").ZodString;
        guid: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        modified: import("zod").ZodString;
        modified_gmt: import("zod").ZodString;
        slug: import("zod").ZodString;
        status: import("zod").ZodString;
        type: import("zod").ZodString;
        link: import("zod").ZodString;
        title: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        author: import("zod").ZodNumber;
        meta: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _links: import("zod").ZodAny;
    } & {
        content: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        excerpt: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        featured_media: import("zod").ZodOptional<import("zod").ZodNumber>;
        comment_status: import("zod").ZodString;
        ping_status: import("zod").ZodString;
        template: import("zod").ZodString;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
    }, import("zod").ZodTypeAny, "passthrough">>(resource: string, filter?: QueryParams) => Promise<TContent[]>;
    getAllContentCollection: <TContent = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        date: import("zod").ZodString;
        date_gmt: import("zod").ZodString;
        guid: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        modified: import("zod").ZodString;
        modified_gmt: import("zod").ZodString;
        slug: import("zod").ZodString;
        status: import("zod").ZodString;
        type: import("zod").ZodString;
        link: import("zod").ZodString;
        title: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        author: import("zod").ZodNumber;
        meta: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _links: import("zod").ZodAny;
    } & {
        content: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        excerpt: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        featured_media: import("zod").ZodOptional<import("zod").ZodNumber>;
        comment_status: import("zod").ZodString;
        ping_status: import("zod").ZodString;
        template: import("zod").ZodString;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
    }, import("zod").ZodTypeAny, "passthrough">>(resource: string, filter?: Omit<QueryParams, "page">) => Promise<TContent[]>;
    getContentCollectionPaginated: <TContent = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        date: import("zod").ZodString;
        date_gmt: import("zod").ZodString;
        guid: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        modified: import("zod").ZodString;
        modified_gmt: import("zod").ZodString;
        slug: import("zod").ZodString;
        status: import("zod").ZodString;
        type: import("zod").ZodString;
        link: import("zod").ZodString;
        title: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        author: import("zod").ZodNumber;
        meta: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _links: import("zod").ZodAny;
    } & {
        content: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        excerpt: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        featured_media: import("zod").ZodOptional<import("zod").ZodNumber>;
        comment_status: import("zod").ZodString;
        ping_status: import("zod").ZodString;
        template: import("zod").ZodString;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
    }, import("zod").ZodTypeAny, "passthrough">>(resource: string, filter?: QueryParams & PaginationParams) => Promise<PaginatedResponse<TContent>>;
    getContent: <TContent = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        date: import("zod").ZodString;
        date_gmt: import("zod").ZodString;
        guid: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        modified: import("zod").ZodString;
        modified_gmt: import("zod").ZodString;
        slug: import("zod").ZodString;
        status: import("zod").ZodString;
        type: import("zod").ZodString;
        link: import("zod").ZodString;
        title: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        author: import("zod").ZodNumber;
        meta: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _links: import("zod").ZodAny;
    } & {
        content: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        excerpt: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        featured_media: import("zod").ZodOptional<import("zod").ZodNumber>;
        comment_status: import("zod").ZodString;
        ping_status: import("zod").ZodString;
        template: import("zod").ZodString;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
    }, import("zod").ZodTypeAny, "passthrough">>(resource: string, id: number) => Promise<TContent>;
    getContentBySlug: <TContent = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        date: import("zod").ZodString;
        date_gmt: import("zod").ZodString;
        guid: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        modified: import("zod").ZodString;
        modified_gmt: import("zod").ZodString;
        slug: import("zod").ZodString;
        status: import("zod").ZodString;
        type: import("zod").ZodString;
        link: import("zod").ZodString;
        title: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        author: import("zod").ZodNumber;
        meta: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _links: import("zod").ZodAny;
    } & {
        content: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        excerpt: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        featured_media: import("zod").ZodOptional<import("zod").ZodNumber>;
        comment_status: import("zod").ZodString;
        ping_status: import("zod").ZodString;
        template: import("zod").ZodString;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
    }, import("zod").ZodTypeAny, "passthrough">>(resource: string, slug: string) => Promise<TContent | undefined>;
    createContent: <TContent = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        date: import("zod").ZodString;
        date_gmt: import("zod").ZodString;
        guid: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        modified: import("zod").ZodString;
        modified_gmt: import("zod").ZodString;
        slug: import("zod").ZodString;
        status: import("zod").ZodString;
        type: import("zod").ZodString;
        link: import("zod").ZodString;
        title: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        author: import("zod").ZodNumber;
        meta: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _links: import("zod").ZodAny;
    } & {
        content: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        excerpt: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        featured_media: import("zod").ZodOptional<import("zod").ZodNumber>;
        comment_status: import("zod").ZodString;
        ping_status: import("zod").ZodString;
        template: import("zod").ZodString;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
    }, import("zod").ZodTypeAny, "passthrough">, TInput extends WordPressWritePayload = WordPressWritePayload>(resource: string, input: TInput, responseSchema?: WordPressStandardSchema<TContent>) => Promise<TContent>;
    updateContent: <TContent = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        date: import("zod").ZodString;
        date_gmt: import("zod").ZodString;
        guid: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        modified: import("zod").ZodString;
        modified_gmt: import("zod").ZodString;
        slug: import("zod").ZodString;
        status: import("zod").ZodString;
        type: import("zod").ZodString;
        link: import("zod").ZodString;
        title: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        author: import("zod").ZodNumber;
        meta: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _links: import("zod").ZodAny;
    } & {
        content: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        excerpt: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        featured_media: import("zod").ZodOptional<import("zod").ZodNumber>;
        comment_status: import("zod").ZodString;
        ping_status: import("zod").ZodString;
        template: import("zod").ZodString;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
    }, import("zod").ZodTypeAny, "passthrough">, TInput extends WordPressWritePayload = WordPressWritePayload>(resource: string, id: number, input: TInput, responseSchema?: WordPressStandardSchema<TContent>) => Promise<TContent>;
    deleteContent: (resource: string, id: number, options?: DeleteOptions) => Promise<WordPressDeleteResult>;
    getTermCollection: <TTerm = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        count: import("zod").ZodNumber;
        description: import("zod").ZodString;
        link: import("zod").ZodString;
        name: import("zod").ZodString;
        slug: import("zod").ZodString;
        taxonomy: import("zod").ZodString;
        parent: import("zod").ZodDefault<import("zod").ZodNumber>;
        meta: import("zod").ZodUnion<[import("zod").ZodArray<import("zod").ZodAny, "many">, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>]>;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
        _links: import("zod").ZodAny;
    }, import("zod").ZodTypeAny, "passthrough">>(resource: string, filter?: QueryParams) => Promise<TTerm[]>;
    getAllTermCollection: <TTerm = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        count: import("zod").ZodNumber;
        description: import("zod").ZodString;
        link: import("zod").ZodString;
        name: import("zod").ZodString;
        slug: import("zod").ZodString;
        taxonomy: import("zod").ZodString;
        parent: import("zod").ZodDefault<import("zod").ZodNumber>;
        meta: import("zod").ZodUnion<[import("zod").ZodArray<import("zod").ZodAny, "many">, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>]>;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
        _links: import("zod").ZodAny;
    }, import("zod").ZodTypeAny, "passthrough">>(resource: string, filter?: Omit<QueryParams, "page">) => Promise<TTerm[]>;
    getTermCollectionPaginated: <TTerm = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        count: import("zod").ZodNumber;
        description: import("zod").ZodString;
        link: import("zod").ZodString;
        name: import("zod").ZodString;
        slug: import("zod").ZodString;
        taxonomy: import("zod").ZodString;
        parent: import("zod").ZodDefault<import("zod").ZodNumber>;
        meta: import("zod").ZodUnion<[import("zod").ZodArray<import("zod").ZodAny, "many">, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>]>;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
        _links: import("zod").ZodAny;
    }, import("zod").ZodTypeAny, "passthrough">>(resource: string, filter?: QueryParams & PaginationParams) => Promise<PaginatedResponse<TTerm>>;
    getTerm: <TTerm = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        count: import("zod").ZodNumber;
        description: import("zod").ZodString;
        link: import("zod").ZodString;
        name: import("zod").ZodString;
        slug: import("zod").ZodString;
        taxonomy: import("zod").ZodString;
        parent: import("zod").ZodDefault<import("zod").ZodNumber>;
        meta: import("zod").ZodUnion<[import("zod").ZodArray<import("zod").ZodAny, "many">, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>]>;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
        _links: import("zod").ZodAny;
    }, import("zod").ZodTypeAny, "passthrough">>(resource: string, id: number) => Promise<TTerm>;
    getTermBySlug: <TTerm = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        count: import("zod").ZodNumber;
        description: import("zod").ZodString;
        link: import("zod").ZodString;
        name: import("zod").ZodString;
        slug: import("zod").ZodString;
        taxonomy: import("zod").ZodString;
        parent: import("zod").ZodDefault<import("zod").ZodNumber>;
        meta: import("zod").ZodUnion<[import("zod").ZodArray<import("zod").ZodAny, "many">, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>]>;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
        _links: import("zod").ZodAny;
    }, import("zod").ZodTypeAny, "passthrough">>(resource: string, slug: string) => Promise<TTerm | undefined>;
    createTerm: <TTerm = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        count: import("zod").ZodNumber;
        description: import("zod").ZodString;
        link: import("zod").ZodString;
        name: import("zod").ZodString;
        slug: import("zod").ZodString;
        taxonomy: import("zod").ZodString;
        parent: import("zod").ZodDefault<import("zod").ZodNumber>;
        meta: import("zod").ZodUnion<[import("zod").ZodArray<import("zod").ZodAny, "many">, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>]>;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
        _links: import("zod").ZodAny;
    }, import("zod").ZodTypeAny, "passthrough">, TInput extends WordPressWritePayload = TermWriteInput>(resource: string, input: TInput, responseSchema?: WordPressStandardSchema<TTerm>) => Promise<TTerm>;
    updateTerm: <TTerm = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        count: import("zod").ZodNumber;
        description: import("zod").ZodString;
        link: import("zod").ZodString;
        name: import("zod").ZodString;
        slug: import("zod").ZodString;
        taxonomy: import("zod").ZodString;
        parent: import("zod").ZodDefault<import("zod").ZodNumber>;
        meta: import("zod").ZodUnion<[import("zod").ZodArray<import("zod").ZodAny, "many">, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>]>;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
        _links: import("zod").ZodAny;
    }, import("zod").ZodTypeAny, "passthrough">, TInput extends WordPressWritePayload = TermWriteInput>(resource: string, id: number, input: TInput, responseSchema?: WordPressStandardSchema<TTerm>) => Promise<TTerm>;
    deleteTerm: (resource: string, id: number, options?: DeleteOptions) => Promise<WordPressDeleteResult>;
    content: <TResource = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        date: import("zod").ZodString;
        date_gmt: import("zod").ZodString;
        guid: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        modified: import("zod").ZodString;
        modified_gmt: import("zod").ZodString;
        slug: import("zod").ZodString;
        status: import("zod").ZodString;
        type: import("zod").ZodString;
        link: import("zod").ZodString;
        title: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
        }, {
            rendered: string;
        }>;
        author: import("zod").ZodNumber;
        meta: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _links: import("zod").ZodAny;
    } & {
        content: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        excerpt: import("zod").ZodObject<{
            rendered: import("zod").ZodString;
            protected: import("zod").ZodBoolean;
        }, "strip", import("zod").ZodTypeAny, {
            rendered: string;
            protected: boolean;
        }, {
            rendered: string;
            protected: boolean;
        }>;
        featured_media: import("zod").ZodOptional<import("zod").ZodNumber>;
        comment_status: import("zod").ZodString;
        ping_status: import("zod").ZodString;
        template: import("zod").ZodString;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
    }, import("zod").ZodTypeAny, "passthrough">, TCreate extends WordPressWritePayload = WordPressWritePayload, TUpdate extends WordPressWritePayload = TCreate>(resource: string, responseSchema?: WordPressStandardSchema<TResource>) => ContentResourceClient<TResource, TCreate, TUpdate>;
    terms: <TResource = import("zod").objectOutputType<{
        id: import("zod").ZodNumber;
        count: import("zod").ZodNumber;
        description: import("zod").ZodString;
        link: import("zod").ZodString;
        name: import("zod").ZodString;
        slug: import("zod").ZodString;
        taxonomy: import("zod").ZodString;
        parent: import("zod").ZodDefault<import("zod").ZodNumber>;
        meta: import("zod").ZodUnion<[import("zod").ZodArray<import("zod").ZodAny, "many">, import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>]>;
        acf: import("zod").ZodOptional<import("zod").ZodUnion<[import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodAny>, import("zod").ZodArray<import("zod").ZodAny, "many">]>>;
        _embedded: import("zod").ZodOptional<import("zod").ZodAny>;
        _links: import("zod").ZodAny;
    }, import("zod").ZodTypeAny, "passthrough">, TCreate extends WordPressWritePayload = TermWriteInput, TUpdate extends WordPressWritePayload = TCreate>(resource: string, responseSchema?: WordPressStandardSchema<TResource>) => TermsResourceClient<TResource, TCreate, TUpdate>;
};
