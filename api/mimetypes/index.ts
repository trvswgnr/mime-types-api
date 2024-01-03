import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUrl, makeLink, withClient, type SQLFn, Ok } from "../../util.js";
import { sql } from "@vercel/postgres";
console.log = () => {};
export default async function handler(request: VercelRequest, response: VercelResponse) {
    const url = getUrl(request);
    const { name, page, limit } = request.query;
    // if (typeof name !== "string") {
    //     const perPage = typeof limit === "string" ? parseInt(limit, 10) : 20;
    //     const currentPage = typeof page === "string" ? parseInt(page, 10) : 1;
    //     const { body, status } = await withClient(getAllPaginated(url, currentPage, perPage));
    //     return response
    //         .status(status)
    //         .setHeader("Content-Type", "application/json")
    //         .send(JSON.stringify(body, null, 2));
    // }
    if (typeof name !== "string") {
        return response.status(400).json({ error: "name must be a string" });
    }

    const [res, err] = await getByName(name, url)(sql);
    // const pathnameAndSearch = res.split(url.origin)[1];
    // return response.redirect(pathnameAndSearch);
    return response
        .status(200)
        .setHeader("Content-Type", "application/json")
        .send(JSON.stringify(res, null, 2));
}

function getByName(name: string, url: URL) {
    return async (sql: SQLFn) => {
        const { rows } = await sql<{ id: number; name: string }>`
            SELECT * FROM mime_types WHERE name = ${name};
        `;
        if (!rows.length) {
            return Ok({
                data: [],
                _links: {
                    self: makeLink(url, `/mimetypes?name=${name}`),
                    find: makeLink(url, `/mimetypes/{?name}`, { templated: true }),
                    extension: makeLink(url, `/mimetypes/extensions/{ext}`, { templated: true }),
                },
            });
        }
        const id = rows[0].id;
        const { rows: extRows } = await sql<{ extension: string }>`
            SELECT extension FROM extensions WHERE mime_type_id = ${id};
        `;
        const extensions = extRows.map((row) => row.extension);
        // {"id":27,"mime_type_id":301,"type":"deprecates","link":"text/json"}
        const { rows: linkRows } = await sql<{
            id: number;
            mime_type_id: number;
            type: string;
            link: string;
        }>`
            SELECT id, type, link FROM links WHERE mime_type_id = ${id};
        `;
        const links: Record<string, Record<string, any>[]> = {};
        for (const row of linkRows) {
            const rel = getRel(row.type);
            if (!links[row.type]) links[row.type] = [];
            const _link = makeLink(url, `/mimetypes?name=${row.link}`, rel);
            links[row.type].push(_link);
        }
        let parent: any = links.child_of?.[0]?.href;
        parent = parent ? { href: parent, type: "GET" } : undefined;
        const _links: any = {
            self: makeLink(url, `/mimetypes/${id}`),
            parent,
            extensions: makeLink(url, `/mimetypes/${id}/extensions`),
            find: makeLink(url, `/mimetypes/{?name}`, { templated: true }),
            extension: makeLink(url, `/mimetypes/extensions/{ext}`, { templated: true }),
            ...links,
        };
        if (parent) {
            _links.parent = parent;
        }
        return Ok({
            data: {
                ...rows[0],
                extensions,
            },
            _links: _links,
        });
    };
}

function getAllPaginated(url: URL, currentPage: number, perPage: number) {
    return async (sql: SQLFn) => {
        const offset = (currentPage - 1) * perPage;
        const { rows: countRows } = await sql<{ count: string }>`SELECT COUNT(*) FROM mime_types;`;
        const count = parseInt(countRows[0].count, 10);
        const totalPages = Math.ceil(count / perPage);
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
        const data = rows.map((row) => {
            return {
                id: row.id,
                name: row.name,
                _links: {
                    self: makeLink(url, `/mimetypes/${row.id}`),
                    extensions: makeLink(url, `/mimetypes/${row.id}/extensions`),
                    deprecates: linksFrom(row.deprecates, url, "deprecated"),
                    related_to: linksFrom(row.related_to, url, "related"),
                    parent_of: linksFrom(row.parent_of, url, "child"),
                    alternative_to: linksFrom(row.alternative_to, url, "alternative"),
                },
            };
        });
        return Ok({
            data,
            _links: {
                self: makeLink(url, `/mimetypes?page=${currentPage}&limit=${perPage}`),
                first: makeLink(url, `/mimetypes?page=1&limit=${perPage}`),
                prev: makeLink(url, `/mimetypes?page=${currentPage - 1}&limit=${perPage}`),
                next: makeLink(url, `/mimetypes?page=${currentPage + 1}&limit=${perPage}`),
                last: makeLink(url, `/mimetypes?page=${totalPages}&limit=${perPage}`),
                find: makeLink(url, `/mimetypes/{?type}`, { templated: true }),
                extension: makeLink(url, `/mimetypes/extensions/{ext}`, { templated: true }),
            },
            _meta: {
                current_page: currentPage,
                per_page: perPage,
                total_pages: totalPages,
                total_items: count,
            },
        });
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

function linksFrom(...args: any[]) {
    return args as any;
}

function getRel(type: string) {
    switch (type) {
        case "deprecates":
            return "deprecated";
        case "related_to":
            return "related";
        case "parent_of":
            return "child";
        case "child_of":
            return "parent";
        case "alternative_to":
            return "alternative";
        default:
            return type;
    }
}
