import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";
import { getUrl, makeLink } from "../../util.js";

const DELIMITER = ",";

export default async function handler(request: VercelRequest, response: VercelResponse) {
    const url = getUrl(request);
    if (request.method === "GET") {
        const { ext } = request.query;
        if (typeof ext !== "string") {
            return response.status(400).json({ error: "ext must be a string" });
        }
        const mimeTypes = await getMimeTypesForExtension(ext, url);
        const space = request.query.pretty ? 4 : undefined;
        const body = {
            ...mimeTypes,
            headers: request.headers,
        };
        return response
            .status(200)
            .setHeader("Content-Type", "application/json")
            .send(JSON.stringify(body, undefined, space));
    }
}

async function getMimeTypesForExtension(extension: string, url: URL) {
    if (!extension.startsWith(".")) {
        extension = "." + extension;
    }
    const { rows } = await sql<{ mime_type_ids: string }>`
        SELECT mime_type_ids FROM file_types WHERE file_type = ${extension};
    `;
    if (!rows.length) {
        return [];
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
    return {
        data: names.filter(Boolean),
        links: {
            parent: makeLink(url, parentId),
        },
    };
}
