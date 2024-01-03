import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";
import { getOne, getUrl, makeLink, type LinksRow, type MimeTypeRow } from "../../../util.js";


export default async function handler(request: VercelRequest, response: VercelResponse) {
    const url = getUrl(request);
    const { id } = request.query;
    if (typeof id !== "string") {
        return response.status(400).json({ error: "type must be a string" });
    }
    return await getLinks(id)
        .then((links) => {
            const mime_type_id = links.mime_type_id;
            return response.status(200).json({
                data: links,
                _links: {
                    parent: makeLink(url, mime_type_id),
                    self: makeLink(url, mime_type_id, "/links"),
                },
            });
        })
        .catch((error) => {
            return response.status(404).json({ error: error.message });
        });
}

async function getLinks(id: string): Promise<LinksRow> {
    const linksRow = await getOne(sql<LinksRow>`
        SELECT * FROM links WHERE mime_type_id = ${id};
    `);
    if (!linksRow) throw new Error(`No links found for ${id}`);
    return linksRow;
}
