import type { VercelRequest } from "@vercel/node";
import type { QueryResult, QueryResultRow } from "@vercel/postgres";

export async function getOne<O extends QueryResultRow>(
    arg: Promise<QueryResult<O>>
): Promise<O | null> {
    const result = await arg;
    return result.rows[0] ?? null;
}

export function getUrl(request: VercelRequest): URL {
    if (!request.url) throw new Error("Request has no URL");
    const protocol = getProtocol(request);
    const url = new URL(request.url, `${protocol}://${request.headers.host}`);
    return url;
}

function getProtocol(request: VercelRequest): string {
    let forwarded = request.headers["x-forwarded-proto"];
    forwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    if (forwarded) {
        return forwarded;
    }
    return request.headers.referer?.split("://")[0] ?? "http";
}

export function makeLink(
    url: URL,
    id: number,
    endpoint: `/${string}` = "/",
    method = "GET",
    type = "application/json"
) {
    const _endpoint: string = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
    let href = `${url.origin}/api/${id}/${_endpoint}`;
    if (href.endsWith("/")) {
        href = href.slice(0, -1);
    }
    return {
        href,
        type,
        method,
    };
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
