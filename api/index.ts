import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";
import { getUrl, makeLink, withClient, type SQLFn, Ok, type LinksRow } from "../util.js";
const DELIMITER = ",";
export default async function handler(request: VercelRequest, response: VercelResponse) {
    const url = getUrl(request);
    const { type, page, limit } = request.query;
    if (typeof type !== "string") {
        const perPage = typeof limit === "string" ? parseInt(limit, 10) : 20;
        const currentPage = typeof page === "string" ? parseInt(page, 10) : 1;
        const { body, status } = await withClient(getAllPaginated(url, currentPage, perPage));
        return response
            .status(status)
            .setHeader("Content-Type", "application/json")
            .send(JSON.stringify(body, null, 2));
    }
    return response.status(200).json({ success: true });
    // const { body, status } = await withClient(getMimeTypesForType(type, url));
    // return response.status(status).json(body);
}

function getAllPaginated(url: URL, currentPage: number, perPage: number) {
    return async (sql: SQLFn) => {
        const offset = (currentPage - 1) * perPage;
        const { rows } = await sql<MimeTypeWithLinks>`
            SELECT
                mime_types.id,
                mime_types.name,
                links.deprecates,
                links.related_to,
                links.parent_of,
                links.alternative_to
            FROM mime_types
                LEFT JOIN links ON mime_types.id = links.mime_type_id
                ORDER BY mime_types.id ASC
                LIMIT ${perPage}
                OFFSET ${offset};
        `;
        const data = rows.map((row) => ({
            id: row.id,
            name: row.name,
            _links: {
                deprecates: row.deprecates.split(DELIMITER).filter(Boolean),
                related_to: row.related_to.split(DELIMITER).filter(Boolean),
                parent_of: row.parent_of.split(DELIMITER).filter(Boolean),
                alternative_to: row.alternative_to.split(DELIMITER).filter(Boolean),
            },
        }));
        return Ok(data);
    };
}

type MimeTypeWithLinks = {
    id: number;
    name: string;
    deprecates: string;
    related_to: string;
    parent_of: string;
    alternative_to: string;
};
