import type { VercelRequest, VercelResponse } from "@vercel/node";
import { VercelClient, createClient, sql } from "@vercel/postgres";
import {
    Ok,
    Err,
    ResponseError,
    getQueryParam,
    makeLink,
    type SQLFn,
    type BodyFn,
    type ResponseResult,
    withClient,
} from "../../util.js";

const DELIMITER = ",";

export default async function handler(request: VercelRequest, response: VercelResponse) {
    if (!request.method || request.method !== "GET") return response.status(405);
    if (!request.url) return response.status(400);
    const protocol = request.headers.referer?.split("://")[0] ?? "http";
    const url = new URL(request.url, `${protocol}://${request.headers.host}`);
    const ext = getQueryParam("ext", request.query);
    const { body, status } = await withClient(getMimeTypesForExtension(ext, url));
    return response.status(status).json(body);
}

function getMimeTypesForExtension(extension: string | null, url: URL) {
    return async (sql: SQLFn) => {
        if (!extension) {
            return Err(new ResponseError("no extension provided", 400));
        }
        if (!extension.startsWith(".")) {
            extension = "." + extension;
        }
        const { rows } = await sql<{ mime_type_ids: string }>`
            SELECT mime_type_ids FROM file_types WHERE file_type = ${extension};
        `;
        if (!rows.length) {
            return Err(new ResponseError(`no MIME type found for ${extension}`, 404));
        }
        const mime_type_ids = `{${rows[0].mime_type_ids}}`;
        const { rows: mimeTypes } = await sql<{ id: number; name: string }>`
            SELECT id, name FROM mime_types WHERE id = ANY(${mime_type_ids});
        `;
        const ids = mimeTypes.map((mimeType) => mimeType.id);
        const parentId = ids[0];
        const idsStr = `{${ids.join(DELIMITER)}}`;
        const names = mimeTypes.map((mimeType) => mimeType.name);
        const { rows: childRows } = await sql<{ parent_of: string }>`
            SELECT links.parent_of as parent_of FROM mime_types
                LEFT JOIN links ON mime_types.id = links.mime_type_id
                WHERE mime_types.id = ANY(${idsStr});
        `;
        for (const row of childRows) {
            const parentOf = row.parent_of.split(DELIMITER);
            names.push(...parentOf);
        }
        return Ok({
            data: names,
            _links: {
                parent: makeLink(url, `/mimetypes/${parentId}`),
            },
        });
    };
}
