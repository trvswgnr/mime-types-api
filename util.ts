import type { VercelRequest, VercelRequestQuery, VercelResponse } from "@vercel/node";
import {
    VercelClient,
    type QueryResult,
    type QueryResultRow,
    createClient,
} from "@vercel/postgres";

export async function getOne<O extends QueryResultRow>(
    arg: Promise<QueryResult<O>>
): Promise<O | null> {
    const result = await arg;
    return result.rows[0] ?? null;
}

export function getQueryParam(key: string, query: VercelRequestQuery): string | null {
    const value = query[key];
    if (Array.isArray(value)) {
        return value[0];
    }
    return value ?? null;
}

export function getUrl(request: VercelRequest): URL {
    if (!request.url) throw new Error("Request has no URL");
    const protocol = request.headers.referer?.split("://")[0] ?? "http";
    const url = new URL(request.url, `${protocol}://${request.headers.host}`);
    return url;
}
type Link = {
    href: string;
    type?: string;
    rel?: string;
    templated?: boolean;
};
type VerbsUpper = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type VerbsLower = Lowercase<VerbsUpper>;
type Verbs = VerbsUpper | VerbsLower;
export function makeLink(
    url: URL,
    endpoint: `/${string}`,
    relOrData?: string | { templated?: true; rel?: string; href?: string; type?: Verbs },
    maybeType: Verbs = "GET"
): Link {
    const href = `${url.origin}/api${endpoint}`;
    const type = typeof relOrData === "object" ? relOrData?.type ?? maybeType : maybeType;
    const rel = typeof relOrData === "string" ? relOrData : relOrData?.rel;
    const templated = typeof relOrData === "string" ? false : relOrData?.templated;
    const link: Link = { href };
    if (rel) link.rel = rel;
    if (templated) link.templated = true;
    if (type) link.type = type;
    return link;
}

export type MimeTypeJSON = {
    name: string;
    description: string;
    links: {
        deprecates: Array<string>;
        relatedTo: Array<string>;
        parentOf: Array<string>;
        alternativeTo: Array<string>;
    };
    fileTypes: Array<string>;
    furtherReading: Array<{ title: string; url: string }>;
    notices: {
        hasNoOfficial: boolean;
        communityContributed: boolean;
        popularUsage: string | null;
    };
    deprecated?: boolean;
    useInstead?: string;
};

export type MimeTypeRow = {
    id: number;
    name: string;
    description: string;
    deprecated: boolean;
    use_instead: string;
};

export type LinksRow = {
    mime_type_id: number;
    deprecates: string;
    related_to: string;
    parent_of: string;
    alternative_to: string;
};

export type Result<T, E> = readonly [T, null] | readonly [null, E];

export function Ok<T>(value: T) {
    return [value, null] as const;
}

export function Err<E>(error: E) {
    return [null, error] as const;
}

export class ResponseError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export type ResponseResult = Result<Body, ResponseError>;
export type Body = string | number | boolean | { [key: string]: Body } | Body[];
export type BodyFn = (sql: SQLFn) => Promise<ResponseResult>;
export type SQLFn = VercelClient["sql"];

type Ret<T extends BodyFn> =
    | {
          body: Awaited<ReturnType<T>>;
          status: 200;
      }
    | {
          body: { error: string };
          status: number;
        };
export async function withClient<const T extends BodyFn>(fn: T): Promise<Ret<T>> {
    const client = createClient();
    await client.connect();
    const sql = client.sql.bind(client);
    try {
        const [body, error] = await fn(sql);
        if (error) {
            return { body: { error: error.message }, status: error.status };
        }
        return { body, status: 200 } as any;
    } catch (err) {
        const error = err instanceof Error ? err : new Error("unknown error");
        return { body: { error: error.message }, status: 500 };
    } finally {
        await client.end();
    }
}
