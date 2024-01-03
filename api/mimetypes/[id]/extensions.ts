import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";
import { getUrl, makeLink } from "../../../util.js";

const DELIMITER = ",";

export default async function handler(request: VercelRequest, response: VercelResponse) {
    const url = getUrl(request);
    const { id } = request.query;
    if (typeof id !== "string") {
        return response.status(400).json({ error: "type must be a string" });
    }
    return await getFileExtensions(id)
        .then((fileExtensions) => {
            console.log(fileExtensions);
            return response.status(200).json({
                data: fileExtensions,
                links: {
                    parent: makeLink(url, `/mimetypes/${id}`),
                    self: makeLink(url, `/mimetypes/${id}/extensions`),
                },
            });
        })
        .catch((error) => {
            return response.status(404).json({ error: error.message });
        });
}

async function getFileExtensions(
    id: string
): Promise<{ id: number; name: string; parents: number[] }[]> {
    const { rows } = await sql<{ id: number; file_type: string; mime_type_ids: string }>`
        SELECT * FROM file_types WHERE mime_type_ids LIKE ${`%${id}%`};
    `;
    return rows.map((row) => ({
        id: row.id,
        name: row.file_type,
        parents: row.mime_type_ids
            .split(DELIMITER)
            .filter(Boolean)
            .map((id) => parseInt(id)),
    }));
}
