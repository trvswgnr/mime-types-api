import type { VercelRequest, VercelResponse } from "@vercel/node";
import { sql } from "@vercel/postgres";
import { getOne, getUrl, makeLink, type MimeTypeRow } from "../../../util.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
    const url = getUrl(request);
    const { id } = request.query;
    if (typeof id !== "string") {
        return response.status(400).json({ error: "type must be a string" });
    }
    return await getMimeType(id)
        .then((mimeType) => {
            const id = mimeType.id;
            return response.status(200).json({
                data: mimeType,
                _links: {
                    links: makeLink(url, id, "/links"),
                    extensions: makeLink(url, id, "/extensions"),
                    self: makeLink(url, id),
                },
            });
        })
        .catch((error) => {
            return response.status(404).json({ error: error.message });
        });
}

async function getMimeType(id: string): Promise<MimeTypeRow> {
    const mimeTypeRow = await getOne(sql<MimeTypeRow>`
        SELECT * FROM mime_types WHERE id = ${id};
    `);
    if (!mimeTypeRow) throw new Error(`No mime type found for ${id}`);
    return mimeTypeRow;
    // const linksRow = await getOne(sql`
    //     SELECT * FROM links WHERE mime_type_id = ${mimeTypeRow.id};
    // `);
    // if (!linksRow) throw new Error(`No links found for ${id}`);
    // const fileTypesRow = await getOne(sql`
    //     SELECT * FROM file_types WHERE mime_type_ids LIKE ${`%${mimeTypeRow.id}%`};
    // `);
    // if (!fileTypesRow) throw new Error(`No file types found for ${id}`);
    // const furtherReadingRows = await sql`
    //     SELECT * FROM further_reading WHERE mime_type_id = ${mimeTypeRow.id};
    // `;
    // if (!furtherReadingRows) throw new Error(`No further reading found for ${id}`);
    // const noticesRow = await getOne(sql`
    //     SELECT * FROM notices WHERE mime_type_id = ${mimeTypeRow.id};
    // `);
    // if (!noticesRow) throw new Error(`No notices found for ${id}`);

    // const mimeType: MimeType = {
    //     name: mimeTypeRow.name,
    //     description: mimeTypeRow.description,
    //     links: {
    //         deprecates: linksRow.deprecates.split(DELIMITER).filter(Boolean),
    //         relatedTo: linksRow.related_to.split(DELIMITER).filter(Boolean),
    //         parentOf: linksRow.parent_of.split(DELIMITER).filter(Boolean),
    //         alternativeTo: linksRow.alternative_to.split(DELIMITER).filter(Boolean),
    //     },
    //     fileTypes: fileTypesRow.file_type.split(DELIMITER).filter(Boolean),
    //     furtherReading: furtherReadingRows.rows.map((row) => ({
    //         title: row.title,
    //         url: row.url,
    //     })),
    //     notices: {
    //         hasNoOfficial: noticesRow.has_no_official,
    //         communityContributed: noticesRow.community_contributed,
    //         popularUsage: noticesRow.popular_usage,
    //     },
    // };

    // return mimeType;
}
