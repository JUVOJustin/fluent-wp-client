import { z } from 'zod';
/**
 * Base schema shared by all WordPress content response types.
 */
export declare const baseWordPressSchema: z.ZodObject<{
    id: z.ZodNumber;
    date: z.ZodString;
    date_gmt: z.ZodString;
    guid: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    modified: z.ZodString;
    modified_gmt: z.ZodString;
    slug: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodNumber;
    date: z.ZodString;
    date_gmt: z.ZodString;
    guid: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    modified: z.ZodString;
    modified_gmt: z.ZodString;
    slug: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodNumber;
    date: z.ZodString;
    date_gmt: z.ZodString;
    guid: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    modified: z.ZodString;
    modified_gmt: z.ZodString;
    slug: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Schema for content types (posts and pages).
 */
export declare const contentWordPressSchema: z.ZodObject<{
    id: z.ZodNumber;
    date: z.ZodString;
    date_gmt: z.ZodString;
    guid: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    modified: z.ZodString;
    modified_gmt: z.ZodString;
    slug: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
} & {
    content: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    excerpt: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    featured_media: z.ZodOptional<z.ZodNumber>;
    comment_status: z.ZodString;
    ping_status: z.ZodString;
    template: z.ZodString;
    acf: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _embedded: z.ZodOptional<z.ZodAny>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodNumber;
    date: z.ZodString;
    date_gmt: z.ZodString;
    guid: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    modified: z.ZodString;
    modified_gmt: z.ZodString;
    slug: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
} & {
    content: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    excerpt: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    featured_media: z.ZodOptional<z.ZodNumber>;
    comment_status: z.ZodString;
    ping_status: z.ZodString;
    template: z.ZodString;
    acf: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _embedded: z.ZodOptional<z.ZodAny>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodNumber;
    date: z.ZodString;
    date_gmt: z.ZodString;
    guid: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    modified: z.ZodString;
    modified_gmt: z.ZodString;
    slug: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
} & {
    content: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    excerpt: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    featured_media: z.ZodOptional<z.ZodNumber>;
    comment_status: z.ZodString;
    ping_status: z.ZodString;
    template: z.ZodString;
    acf: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _embedded: z.ZodOptional<z.ZodAny>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Default schema for WordPress posts.
 */
export declare const postSchema: z.ZodObject<{
    id: z.ZodNumber;
    date: z.ZodString;
    date_gmt: z.ZodString;
    guid: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    modified: z.ZodString;
    modified_gmt: z.ZodString;
    slug: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
} & {
    content: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    excerpt: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    featured_media: z.ZodOptional<z.ZodNumber>;
    comment_status: z.ZodString;
    ping_status: z.ZodString;
    template: z.ZodString;
    acf: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _embedded: z.ZodOptional<z.ZodAny>;
} & {
    sticky: z.ZodBoolean;
    format: z.ZodString;
    categories: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
    tags: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodNumber;
    date: z.ZodString;
    date_gmt: z.ZodString;
    guid: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    modified: z.ZodString;
    modified_gmt: z.ZodString;
    slug: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
} & {
    content: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    excerpt: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    featured_media: z.ZodOptional<z.ZodNumber>;
    comment_status: z.ZodString;
    ping_status: z.ZodString;
    template: z.ZodString;
    acf: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _embedded: z.ZodOptional<z.ZodAny>;
} & {
    sticky: z.ZodBoolean;
    format: z.ZodString;
    categories: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
    tags: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodNumber;
    date: z.ZodString;
    date_gmt: z.ZodString;
    guid: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    modified: z.ZodString;
    modified_gmt: z.ZodString;
    slug: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
} & {
    content: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    excerpt: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    featured_media: z.ZodOptional<z.ZodNumber>;
    comment_status: z.ZodString;
    ping_status: z.ZodString;
    template: z.ZodString;
    acf: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _embedded: z.ZodOptional<z.ZodAny>;
} & {
    sticky: z.ZodBoolean;
    format: z.ZodString;
    categories: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
    tags: z.ZodDefault<z.ZodArray<z.ZodNumber, "many">>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Default schema for WordPress pages.
 */
export declare const pageSchema: z.ZodObject<{
    id: z.ZodNumber;
    date: z.ZodString;
    date_gmt: z.ZodString;
    guid: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    modified: z.ZodString;
    modified_gmt: z.ZodString;
    slug: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
} & {
    content: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    excerpt: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    featured_media: z.ZodOptional<z.ZodNumber>;
    comment_status: z.ZodString;
    ping_status: z.ZodString;
    template: z.ZodString;
    acf: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _embedded: z.ZodOptional<z.ZodAny>;
} & {
    parent: z.ZodDefault<z.ZodNumber>;
    menu_order: z.ZodDefault<z.ZodNumber>;
    class_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodNumber;
    date: z.ZodString;
    date_gmt: z.ZodString;
    guid: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    modified: z.ZodString;
    modified_gmt: z.ZodString;
    slug: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
} & {
    content: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    excerpt: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    featured_media: z.ZodOptional<z.ZodNumber>;
    comment_status: z.ZodString;
    ping_status: z.ZodString;
    template: z.ZodString;
    acf: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _embedded: z.ZodOptional<z.ZodAny>;
} & {
    parent: z.ZodDefault<z.ZodNumber>;
    menu_order: z.ZodDefault<z.ZodNumber>;
    class_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodNumber;
    date: z.ZodString;
    date_gmt: z.ZodString;
    guid: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    modified: z.ZodString;
    modified_gmt: z.ZodString;
    slug: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
} & {
    content: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    excerpt: z.ZodObject<{
        rendered: z.ZodString;
        protected: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
        protected: boolean;
    }, {
        rendered: string;
        protected: boolean;
    }>;
    featured_media: z.ZodOptional<z.ZodNumber>;
    comment_status: z.ZodString;
    ping_status: z.ZodString;
    template: z.ZodString;
    acf: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _embedded: z.ZodOptional<z.ZodAny>;
} & {
    parent: z.ZodDefault<z.ZodNumber>;
    menu_order: z.ZodDefault<z.ZodNumber>;
    class_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Schema for WordPress media items.
 */
export declare const mediaSchema: z.ZodObject<{
    id: z.ZodNumber;
    date: z.ZodString;
    date_gmt: z.ZodString;
    guid: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    modified: z.ZodString;
    modified_gmt: z.ZodString;
    slug: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
} & {
    comment_status: z.ZodString;
    ping_status: z.ZodString;
    alt_text: z.ZodString;
    caption: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    description: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    media_type: z.ZodString;
    mime_type: z.ZodString;
    media_details: z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
        file: z.ZodString;
        filesize: z.ZodOptional<z.ZodNumber>;
        sizes: z.ZodRecord<z.ZodString, z.ZodObject<{
            file: z.ZodString;
            width: z.ZodNumber;
            height: z.ZodNumber;
            filesize: z.ZodOptional<z.ZodNumber>;
            mime_type: z.ZodString;
            source_url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>>;
        image_meta: z.ZodAny;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
        file: string;
        sizes: Record<string, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>;
        filesize?: number | undefined;
        image_meta?: any;
    }, {
        width: number;
        height: number;
        file: string;
        sizes: Record<string, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>;
        filesize?: number | undefined;
        image_meta?: any;
    }>;
    source_url: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodNumber;
    date: z.ZodString;
    date_gmt: z.ZodString;
    guid: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    modified: z.ZodString;
    modified_gmt: z.ZodString;
    slug: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
} & {
    comment_status: z.ZodString;
    ping_status: z.ZodString;
    alt_text: z.ZodString;
    caption: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    description: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    media_type: z.ZodString;
    mime_type: z.ZodString;
    media_details: z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
        file: z.ZodString;
        filesize: z.ZodOptional<z.ZodNumber>;
        sizes: z.ZodRecord<z.ZodString, z.ZodObject<{
            file: z.ZodString;
            width: z.ZodNumber;
            height: z.ZodNumber;
            filesize: z.ZodOptional<z.ZodNumber>;
            mime_type: z.ZodString;
            source_url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>>;
        image_meta: z.ZodAny;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
        file: string;
        sizes: Record<string, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>;
        filesize?: number | undefined;
        image_meta?: any;
    }, {
        width: number;
        height: number;
        file: string;
        sizes: Record<string, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>;
        filesize?: number | undefined;
        image_meta?: any;
    }>;
    source_url: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodNumber;
    date: z.ZodString;
    date_gmt: z.ZodString;
    guid: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    modified: z.ZodString;
    modified_gmt: z.ZodString;
    slug: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
} & {
    comment_status: z.ZodString;
    ping_status: z.ZodString;
    alt_text: z.ZodString;
    caption: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    description: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    media_type: z.ZodString;
    mime_type: z.ZodString;
    media_details: z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
        file: z.ZodString;
        filesize: z.ZodOptional<z.ZodNumber>;
        sizes: z.ZodRecord<z.ZodString, z.ZodObject<{
            file: z.ZodString;
            width: z.ZodNumber;
            height: z.ZodNumber;
            filesize: z.ZodOptional<z.ZodNumber>;
            mime_type: z.ZodString;
            source_url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>>;
        image_meta: z.ZodAny;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
        file: string;
        sizes: Record<string, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>;
        filesize?: number | undefined;
        image_meta?: any;
    }, {
        width: number;
        height: number;
        file: string;
        sizes: Record<string, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>;
        filesize?: number | undefined;
        image_meta?: any;
    }>;
    source_url: z.ZodString;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Schema for WordPress categories and taxonomies.
 */
export declare const categorySchema: z.ZodObject<{
    id: z.ZodNumber;
    count: z.ZodNumber;
    description: z.ZodString;
    link: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    taxonomy: z.ZodString;
    parent: z.ZodDefault<z.ZodNumber>;
    meta: z.ZodUnion<[z.ZodArray<z.ZodAny, "many">, z.ZodRecord<z.ZodString, z.ZodAny>]>;
    acf: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _embedded: z.ZodOptional<z.ZodAny>;
    _links: z.ZodAny;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodNumber;
    count: z.ZodNumber;
    description: z.ZodString;
    link: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    taxonomy: z.ZodString;
    parent: z.ZodDefault<z.ZodNumber>;
    meta: z.ZodUnion<[z.ZodArray<z.ZodAny, "many">, z.ZodRecord<z.ZodString, z.ZodAny>]>;
    acf: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _embedded: z.ZodOptional<z.ZodAny>;
    _links: z.ZodAny;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodNumber;
    count: z.ZodNumber;
    description: z.ZodString;
    link: z.ZodString;
    name: z.ZodString;
    slug: z.ZodString;
    taxonomy: z.ZodString;
    parent: z.ZodDefault<z.ZodNumber>;
    meta: z.ZodUnion<[z.ZodArray<z.ZodAny, "many">, z.ZodRecord<z.ZodString, z.ZodAny>]>;
    acf: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _embedded: z.ZodOptional<z.ZodAny>;
    _links: z.ZodAny;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Schema for WordPress embedded media in `_embedded` responses.
 */
export declare const embeddedMediaSchema: z.ZodObject<{
    id: z.ZodNumber;
    date: z.ZodString;
    slug: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    featured_media: z.ZodNumber;
    caption: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    alt_text: z.ZodString;
    media_type: z.ZodString;
    mime_type: z.ZodString;
    media_details: z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
        file: z.ZodString;
        filesize: z.ZodOptional<z.ZodNumber>;
        sizes: z.ZodRecord<z.ZodString, z.ZodObject<{
            file: z.ZodString;
            width: z.ZodNumber;
            height: z.ZodNumber;
            filesize: z.ZodOptional<z.ZodNumber>;
            mime_type: z.ZodString;
            source_url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>>;
        image_meta: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
        file: string;
        sizes: Record<string, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>;
        filesize?: number | undefined;
        image_meta?: any;
    }, {
        width: number;
        height: number;
        file: string;
        sizes: Record<string, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>;
        filesize?: number | undefined;
        image_meta?: any;
    }>;
    source_url: z.ZodString;
    acf: z.ZodOptional<z.ZodAny>;
    _links: z.ZodOptional<z.ZodAny>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodNumber;
    date: z.ZodString;
    slug: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    featured_media: z.ZodNumber;
    caption: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    alt_text: z.ZodString;
    media_type: z.ZodString;
    mime_type: z.ZodString;
    media_details: z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
        file: z.ZodString;
        filesize: z.ZodOptional<z.ZodNumber>;
        sizes: z.ZodRecord<z.ZodString, z.ZodObject<{
            file: z.ZodString;
            width: z.ZodNumber;
            height: z.ZodNumber;
            filesize: z.ZodOptional<z.ZodNumber>;
            mime_type: z.ZodString;
            source_url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>>;
        image_meta: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
        file: string;
        sizes: Record<string, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>;
        filesize?: number | undefined;
        image_meta?: any;
    }, {
        width: number;
        height: number;
        file: string;
        sizes: Record<string, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>;
        filesize?: number | undefined;
        image_meta?: any;
    }>;
    source_url: z.ZodString;
    acf: z.ZodOptional<z.ZodAny>;
    _links: z.ZodOptional<z.ZodAny>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodNumber;
    date: z.ZodString;
    slug: z.ZodString;
    type: z.ZodString;
    link: z.ZodString;
    title: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    author: z.ZodNumber;
    featured_media: z.ZodNumber;
    caption: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    alt_text: z.ZodString;
    media_type: z.ZodString;
    mime_type: z.ZodString;
    media_details: z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
        file: z.ZodString;
        filesize: z.ZodOptional<z.ZodNumber>;
        sizes: z.ZodRecord<z.ZodString, z.ZodObject<{
            file: z.ZodString;
            width: z.ZodNumber;
            height: z.ZodNumber;
            filesize: z.ZodOptional<z.ZodNumber>;
            mime_type: z.ZodString;
            source_url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>>;
        image_meta: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
        file: string;
        sizes: Record<string, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>;
        filesize?: number | undefined;
        image_meta?: any;
    }, {
        width: number;
        height: number;
        file: string;
        sizes: Record<string, {
            mime_type: string;
            width: number;
            height: number;
            file: string;
            source_url: string;
            filesize?: number | undefined;
        }>;
        filesize?: number | undefined;
        image_meta?: any;
    }>;
    source_url: z.ZodString;
    acf: z.ZodOptional<z.ZodAny>;
    _links: z.ZodOptional<z.ZodAny>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Schema for ability execution annotations exposed by WordPress.
 */
export declare const abilityAnnotationsSchema: z.ZodObject<{
    instructions: z.ZodOptional<z.ZodString>;
    readonly: z.ZodOptional<z.ZodBoolean>;
    destructive: z.ZodOptional<z.ZodBoolean>;
    idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    instructions: z.ZodOptional<z.ZodString>;
    readonly: z.ZodOptional<z.ZodBoolean>;
    destructive: z.ZodOptional<z.ZodBoolean>;
    idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    instructions: z.ZodOptional<z.ZodString>;
    readonly: z.ZodOptional<z.ZodBoolean>;
    destructive: z.ZodOptional<z.ZodBoolean>;
    idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Schema for one WordPress ability definition.
 */
export declare const abilitySchema: z.ZodObject<{
    name: z.ZodString;
    label: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    input_schema: z.ZodOptional<z.ZodAny>;
    output_schema: z.ZodOptional<z.ZodAny>;
    meta: z.ZodOptional<z.ZodObject<{
        annotations: z.ZodOptional<z.ZodObject<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        annotations: z.ZodOptional<z.ZodObject<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        annotations: z.ZodOptional<z.ZodObject<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    name: z.ZodString;
    label: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    input_schema: z.ZodOptional<z.ZodAny>;
    output_schema: z.ZodOptional<z.ZodAny>;
    meta: z.ZodOptional<z.ZodObject<{
        annotations: z.ZodOptional<z.ZodObject<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        annotations: z.ZodOptional<z.ZodObject<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        annotations: z.ZodOptional<z.ZodObject<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    name: z.ZodString;
    label: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    input_schema: z.ZodOptional<z.ZodAny>;
    output_schema: z.ZodOptional<z.ZodAny>;
    meta: z.ZodOptional<z.ZodObject<{
        annotations: z.ZodOptional<z.ZodObject<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
        annotations: z.ZodOptional<z.ZodObject<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
        annotations: z.ZodOptional<z.ZodObject<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, "passthrough", z.ZodTypeAny, z.objectOutputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">, z.objectInputType<{
            instructions: z.ZodOptional<z.ZodString>;
            readonly: z.ZodOptional<z.ZodBoolean>;
            destructive: z.ZodOptional<z.ZodBoolean>;
            idempotent: z.ZodOptional<z.ZodNullable<z.ZodBoolean>>;
        }, z.ZodTypeAny, "passthrough">>>;
    }, z.ZodTypeAny, "passthrough">>>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Schema for one WordPress ability category.
 */
export declare const abilityCategorySchema: z.ZodObject<{
    slug: z.ZodString;
    label: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    meta: z.ZodOptional<z.ZodAny>;
    _links: z.ZodOptional<z.ZodAny>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    slug: z.ZodString;
    label: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    meta: z.ZodOptional<z.ZodAny>;
    _links: z.ZodOptional<z.ZodAny>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    slug: z.ZodString;
    label: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    meta: z.ZodOptional<z.ZodAny>;
    _links: z.ZodOptional<z.ZodAny>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Schema for WordPress users/authors.
 */
export declare const authorSchema: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    url: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    description: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    link: z.ZodString;
    slug: z.ZodString;
    avatar_urls: z.ZodRecord<z.ZodString, z.ZodString>;
    meta: z.ZodDefault<z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodAny, "many">, z.ZodRecord<z.ZodString, z.ZodAny>]>>>;
    _links: z.ZodAny;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodNumber;
    name: z.ZodString;
    url: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    description: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    link: z.ZodString;
    slug: z.ZodString;
    avatar_urls: z.ZodRecord<z.ZodString, z.ZodString>;
    meta: z.ZodDefault<z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodAny, "many">, z.ZodRecord<z.ZodString, z.ZodAny>]>>>;
    _links: z.ZodAny;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodNumber;
    name: z.ZodString;
    url: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    description: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    link: z.ZodString;
    slug: z.ZodString;
    avatar_urls: z.ZodRecord<z.ZodString, z.ZodString>;
    meta: z.ZodDefault<z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodAny, "many">, z.ZodRecord<z.ZodString, z.ZodAny>]>>>;
    _links: z.ZodAny;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Schema for WordPress comments.
 */
export declare const commentSchema: z.ZodObject<{
    id: z.ZodNumber;
    post: z.ZodNumber;
    parent: z.ZodNumber;
    author: z.ZodNumber;
    author_name: z.ZodString;
    author_url: z.ZodOptional<z.ZodString>;
    date: z.ZodString;
    date_gmt: z.ZodString;
    content: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    link: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodNumber;
    post: z.ZodNumber;
    parent: z.ZodNumber;
    author: z.ZodNumber;
    author_name: z.ZodString;
    author_url: z.ZodOptional<z.ZodString>;
    date: z.ZodString;
    date_gmt: z.ZodString;
    content: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    link: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodNumber;
    post: z.ZodNumber;
    parent: z.ZodNumber;
    author: z.ZodNumber;
    author_name: z.ZodString;
    author_url: z.ZodOptional<z.ZodString>;
    date: z.ZodString;
    date_gmt: z.ZodString;
    content: z.ZodObject<{
        rendered: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        rendered: string;
    }, {
        rendered: string;
    }>;
    link: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    meta: z.ZodOptional<z.ZodUnion<[z.ZodRecord<z.ZodString, z.ZodAny>, z.ZodArray<z.ZodAny, "many">]>>;
    _links: z.ZodAny;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Schema for writable scalar fields shared by create and update post payloads.
 */
export declare const updatePostFieldsSchema: z.ZodObject<{
    date: z.ZodOptional<z.ZodString>;
    date_gmt: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["publish", "draft", "pending", "private", "future"]>>;
    password: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodNumber>;
    featured_media: z.ZodOptional<z.ZodNumber>;
    comment_status: z.ZodOptional<z.ZodString>;
    ping_status: z.ZodOptional<z.ZodString>;
    format: z.ZodOptional<z.ZodString>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    sticky: z.ZodOptional<z.ZodBoolean>;
    template: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    parent: z.ZodOptional<z.ZodNumber>;
    menu_order: z.ZodOptional<z.ZodNumber>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    date: z.ZodOptional<z.ZodString>;
    date_gmt: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["publish", "draft", "pending", "private", "future"]>>;
    password: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodNumber>;
    featured_media: z.ZodOptional<z.ZodNumber>;
    comment_status: z.ZodOptional<z.ZodString>;
    ping_status: z.ZodOptional<z.ZodString>;
    format: z.ZodOptional<z.ZodString>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    sticky: z.ZodOptional<z.ZodBoolean>;
    template: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    parent: z.ZodOptional<z.ZodNumber>;
    menu_order: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    date: z.ZodOptional<z.ZodString>;
    date_gmt: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["publish", "draft", "pending", "private", "future"]>>;
    password: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodNumber>;
    featured_media: z.ZodOptional<z.ZodNumber>;
    comment_status: z.ZodOptional<z.ZodString>;
    ping_status: z.ZodOptional<z.ZodString>;
    format: z.ZodOptional<z.ZodString>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    sticky: z.ZodOptional<z.ZodBoolean>;
    template: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    parent: z.ZodOptional<z.ZodNumber>;
    menu_order: z.ZodOptional<z.ZodNumber>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Shared base schema for post create and update action inputs.
 */
export declare const postWriteBaseSchema: z.ZodObject<{
    date: z.ZodOptional<z.ZodString>;
    date_gmt: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["publish", "draft", "pending", "private", "future"]>>;
    password: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodNumber>;
    featured_media: z.ZodOptional<z.ZodNumber>;
    comment_status: z.ZodOptional<z.ZodString>;
    ping_status: z.ZodOptional<z.ZodString>;
    format: z.ZodOptional<z.ZodString>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    sticky: z.ZodOptional<z.ZodBoolean>;
    template: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    parent: z.ZodOptional<z.ZodNumber>;
    menu_order: z.ZodOptional<z.ZodNumber>;
} & {
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    excerpt: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    date: z.ZodOptional<z.ZodString>;
    date_gmt: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["publish", "draft", "pending", "private", "future"]>>;
    password: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodNumber>;
    featured_media: z.ZodOptional<z.ZodNumber>;
    comment_status: z.ZodOptional<z.ZodString>;
    ping_status: z.ZodOptional<z.ZodString>;
    format: z.ZodOptional<z.ZodString>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    sticky: z.ZodOptional<z.ZodBoolean>;
    template: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    parent: z.ZodOptional<z.ZodNumber>;
    menu_order: z.ZodOptional<z.ZodNumber>;
} & {
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    excerpt: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    date: z.ZodOptional<z.ZodString>;
    date_gmt: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["publish", "draft", "pending", "private", "future"]>>;
    password: z.ZodOptional<z.ZodString>;
    author: z.ZodOptional<z.ZodNumber>;
    featured_media: z.ZodOptional<z.ZodNumber>;
    comment_status: z.ZodOptional<z.ZodString>;
    ping_status: z.ZodOptional<z.ZodString>;
    format: z.ZodOptional<z.ZodString>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    sticky: z.ZodOptional<z.ZodBoolean>;
    template: z.ZodOptional<z.ZodString>;
    categories: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    tags: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    parent: z.ZodOptional<z.ZodNumber>;
    menu_order: z.ZodOptional<z.ZodNumber>;
} & {
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    excerpt: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * Schema for WordPress REST API error responses.
 */
export declare const wordPressErrorSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    data: z.ZodOptional<z.ZodObject<{
        status: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: number;
    }, {
        status: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    data?: {
        status: number;
    } | undefined;
}, {
    code: string;
    message: string;
    data?: {
        status: number;
    } | undefined;
}>;
/**
 * Schema for WordPress site settings.
 */
export declare const settingsSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    url: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    timezone: z.ZodString;
    date_format: z.ZodString;
    time_format: z.ZodString;
    start_of_week: z.ZodNumber;
    language: z.ZodString;
    use_smilies: z.ZodBoolean;
    default_category: z.ZodNumber;
    default_post_format: z.ZodString;
    posts_per_page: z.ZodNumber;
    show_on_front: z.ZodString;
    page_on_front: z.ZodNumber;
    page_for_posts: z.ZodNumber;
    default_ping_status: z.ZodString;
    default_comment_status: z.ZodString;
    site_logo: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    site_icon: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    description: string;
    url: string;
    timezone: string;
    date_format: string;
    time_format: string;
    start_of_week: number;
    language: string;
    use_smilies: boolean;
    default_category: number;
    default_post_format: string;
    posts_per_page: number;
    show_on_front: string;
    page_on_front: number;
    page_for_posts: number;
    default_ping_status: string;
    default_comment_status: string;
    email?: string | undefined;
    site_logo?: number | null | undefined;
    site_icon?: number | null | undefined;
}, {
    title: string;
    description: string;
    url: string;
    timezone: string;
    date_format: string;
    time_format: string;
    start_of_week: number;
    language: string;
    use_smilies: boolean;
    default_category: number;
    default_post_format: string;
    posts_per_page: number;
    show_on_front: string;
    page_on_front: number;
    page_for_posts: number;
    default_ping_status: string;
    default_comment_status: string;
    email?: string | undefined;
    site_logo?: number | null | undefined;
    site_icon?: number | null | undefined;
}>;
export type WordPressBase = z.infer<typeof baseWordPressSchema>;
export type WordPressContent = z.infer<typeof contentWordPressSchema>;
export type WordPressPost = z.infer<typeof postSchema>;
export type WordPressPage = z.infer<typeof pageSchema>;
export type WordPressMedia = z.infer<typeof mediaSchema>;
export type WordPressCategory = z.infer<typeof categorySchema>;
export type WordPressEmbeddedMedia = z.infer<typeof embeddedMediaSchema>;
export type WordPressAbilityAnnotations = z.infer<typeof abilityAnnotationsSchema>;
export type WordPressAbility = z.infer<typeof abilitySchema>;
export type WordPressAbilityCategory = z.infer<typeof abilityCategorySchema>;
export type WordPressAuthor = z.infer<typeof authorSchema>;
export type WordPressComment = z.infer<typeof commentSchema>;
export type WordPressPostWriteFields = z.infer<typeof updatePostFieldsSchema>;
export type WordPressPostWriteBase = z.infer<typeof postWriteBaseSchema>;
export type WordPressError = z.infer<typeof wordPressErrorSchema>;
export type WordPressSettings = z.infer<typeof settingsSchema>;
/**
 * WordPress tag type aliases category response shape.
 */
export type WordPressTag = WordPressCategory;
