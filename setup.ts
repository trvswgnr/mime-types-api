import { sql, type QueryResult, type QueryResultRow } from "@vercel/postgres";
import mimeTypes from "./mime-types.json";

const DELIMITER = ",";

const args = process.argv.slice(2);

if (args.includes("help")) {
    console.log("Usage: bun setup.ts [create | seed | drop]");
}

if (args.includes("drop")) {
    await dropTables();
}

if (args.includes("create")) {
    await createTables();
}

if (args.includes("seed")) {
    await seedDb(mimeTypes).catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}

async function dropTables() {
    console.log("Dropping database tables...");
    await sql`DROP TABLE notices;`.catch(handleError);
    await sql`DROP TABLE further_reading;`.catch(handleError);
    await sql`DROP TABLE file_types;`.catch(handleError);
    await sql`DROP TABLE links;`.catch(handleError);
    await sql`DROP TABLE mime_types CASCADE;`.catch(handleError);
    console.log("Database tables dropped!");
}

function handleError(error: Error) {
    console.error(error.message);
}

async function createTables() {
    console.log("Creating database tables...");
    const createMimeTypeTable = () => sql`
        CREATE TABLE mime_types (
            id SERIAL PRIMARY KEY,
            name VARCHAR(500) NOT NULL UNIQUE,
            description TEXT,
            deprecated BOOLEAN DEFAULT FALSE,
            use_instead VARCHAR(500)
        );
    `;

    const createLinksTable = () => sql`
        CREATE TABLE links (
            id SERIAL PRIMARY KEY,
            mime_type_id INT REFERENCES mime_types(id),
            deprecates VARCHAR(500),
            related_to VARCHAR(500),
            parent_of VARCHAR(500),
            alternative_to VARCHAR(500)
        );
    `;

    const createFileTypesTable = async () => {
        await sql`
            CREATE TABLE file_types (
                id SERIAL PRIMARY KEY,
                file_type VARCHAR(500) NOT NULL UNIQUE,
                mime_type_ids VARCHAR(500) NOT NULL
            );
        `;
    };

    const createFurtherReadingTable = () => sql`
        CREATE TABLE further_reading (
            id SERIAL PRIMARY KEY,
            mime_type_id INT REFERENCES mime_types(id),
            title VARCHAR(500) NOT NULL,
            url VARCHAR(500) NOT NULL
        );
    `;

    const createNoticesTable = () => sql`
        CREATE TABLE notices (
            id SERIAL PRIMARY KEY,
            mime_type_id INT REFERENCES mime_types(id),
            has_no_official BOOLEAN DEFAULT FALSE,
            community_contributed BOOLEAN DEFAULT FALSE,
            popular_usage VARCHAR(500)
        );
    `;

    await createMimeTypeTable();
    const results = await Promise.allSettled([
        createLinksTable(),
        createFileTypesTable(),
        createFurtherReadingTable(),
        createNoticesTable(),
    ]);

    if (results.every((result) => result.status === "fulfilled")) {
        console.log("Database tables created!");
    } else {
        console.log("Database table creation failed:");
        results.forEach((result) => {
            if (result.status === "rejected") {
                console.log(result.reason.message);
            }
        });
    }
}

async function seedDb(mimeTypes: MimeType[]): Promise<void> {
    console.log("Seeding database...");
    const insertMimeType = (mimeType: SnakeCaseKeys<MimeType>) => {
        return sql<{ id: number }>`
            INSERT INTO mime_types (
                name,
                description,
                deprecated,
                use_instead
            ) VALUES (
                ${mimeType.name},
                ${mimeType.description},
                ${mimeType.deprecated},
                ${mimeType.use_instead}
            ) RETURNING id;
        `;
    };

    const insertLinks = (mimeTypeID: number, links: SnakeCaseKeys<MimeType>["links"]) => {
        return sql`
            INSERT INTO links (
                mime_type_id,
                deprecates,
                related_to,
                parent_of,
                alternative_to
            ) VALUES (
                ${mimeTypeID},
                ${links.deprecates.join(DELIMITER)},
                ${links.related_to.join(DELIMITER)},
                ${links.parent_of.join(DELIMITER)},
                ${links.alternative_to.join(DELIMITER)}
            );
        `;
    };

    const insertFileTypes = async (
        mimeTypeID: number,
        fileTypes: SnakeCaseKeys<MimeType>["file_types"]
    ) => {
        for (const fileType of fileTypes) {
            // first, check if the file type already exists in the file_types table
            const { rows: existingMimeTypeIds } = await sql<{ mime_type_ids: string }>`
                SELECT mime_type_ids FROM file_types WHERE file_type = ${fileType};
            `;
            if (existingMimeTypeIds.length) {
                // if the file type already exists, add the mime type id to the mime_type_ids array
                const mime_type_ids = existingMimeTypeIds[0].mime_type_ids;
                await sql`
                    UPDATE file_types SET mime_type_ids = ${mime_type_ids + DELIMITER + mimeTypeID}
                        WHERE file_type = ${fileType};
                `;
                continue;
            }
            // if the file type doesn't exist yet, insert it into the file_types table
            await sql<{ id: number }>`
                INSERT INTO file_types (
                    file_type,
                    mime_type_ids
                ) VALUES (
                    ${fileType},
                    ${mimeTypeID}
                ) on conflict (file_type) do update set mime_type_ids = file_types.mime_type_ids || ${
                    DELIMITER + mimeTypeID
                }
            `;
        }
    };

    const insertFurtherReading = async (
        mimeTypeID: number,
        furtherReading: SnakeCaseKeys<MimeType>["further_reading"]
    ) => {
        for (const { title, url } of furtherReading) {
            await sql`
                INSERT INTO further_reading (
                    mime_type_id,
                    title,
                    url
                ) VALUES (
                    ${mimeTypeID},
                    ${title},
                    ${url}
                );
            `;
        }
    };

    const insertNotices = (mimeTypeID: number, notices: SnakeCaseKeys<MimeType>["notices"]) => {
        return sql`
            INSERT INTO notices (
                mime_type_id,
                has_no_official,
                community_contributed,
                popular_usage
            ) VALUES (
                ${mimeTypeID},
                ${notices.has_no_official},
                ${notices.community_contributed},
                ${notices.popular_usage}
            );
        `;
    };

    let lastId = -1;
    const results = await Promise.allSettled(
        mimeTypes.map(async (_mimeType) => {
            const mimeType = convertKeysToSnakeCase(_mimeType);
            const mimeTypeResult = await insertMimeType(mimeType);
            const mimeTypeID = mimeTypeResult.rows[0].id;
            lastId = mimeTypeID;

            await insertLinks(mimeTypeID, mimeType.links);
            await insertFileTypes(mimeTypeID, mimeType.file_types);
            await insertFurtherReading(mimeTypeID, mimeType.further_reading);
            await insertNotices(mimeTypeID, mimeType.notices);
        })
    );

    if (results.every((result) => result.status === "fulfilled")) {
        console.log("Database seeding complete");
        return;
    }
    console.log("Database seeding failed 👎");
    const message = results
        .filter((result) => result.status === "rejected")
        .map((result: any) => result.reason.message)
        .join("\n");
    throw new Error(message);
}

type MimeType = {
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

if (args.includes("test")) {
    const rows = await getMimeType("audio/vnd.wav");
    console.log(rows);
}

async function getMimeType(type: string): Promise<MimeType> {
    const mimeTypeRow = await getOne(sql<MimeTypeRow>`
        SELECT * FROM mime_types WHERE name = ${type};
    `);
    if (!mimeTypeRow) throw new Error(`No mime type found for ${type}`);
    const linksRow = await getOne(sql`
        SELECT * FROM links WHERE mime_type_id = ${mimeTypeRow.id};
    `);
    if (!linksRow) throw new Error(`No links found for ${type}`);
    const fileTypesRow = await getOne(sql`
        SELECT * FROM file_types WHERE mime_type_ids LIKE ${`%${mimeTypeRow.id}%`};
    `);
    if (!fileTypesRow) throw new Error(`No file types found for ${type}`);
    const furtherReadingRows = await sql`
        SELECT * FROM further_reading WHERE mime_type_id = ${mimeTypeRow.id};
    `;
    if (!furtherReadingRows) throw new Error(`No further reading found for ${type}`);
    const noticesRow = await getOne(sql`
        SELECT * FROM notices WHERE mime_type_id = ${mimeTypeRow.id};
    `);
    if (!noticesRow) throw new Error(`No notices found for ${type}`);

    const mimeType: MimeType = {
        name: mimeTypeRow.name,
        description: mimeTypeRow.description,
        links: {
            deprecates: linksRow.deprecates.split(DELIMITER).filter(Boolean),
            relatedTo: linksRow.related_to.split(DELIMITER).filter(Boolean),
            parentOf: linksRow.parent_of.split(DELIMITER).filter(Boolean),
            alternativeTo: linksRow.alternative_to.split(DELIMITER).filter(Boolean),
        },
        fileTypes: fileTypesRow.file_type.split(DELIMITER).filter(Boolean),
        furtherReading: furtherReadingRows.rows.map((row) => ({
            title: row.title,
            url: row.url,
        })),
        notices: {
            hasNoOfficial: noticesRow.has_no_official,
            communityContributed: noticesRow.community_contributed,
            popularUsage: noticesRow.popular_usage,
        },
    };

    return mimeType;
}

async function getOne<O extends QueryResultRow>(arg: Promise<QueryResult<O>>): Promise<O | null> {
    const result = await arg;
    return result.rows[0] ?? null;
}

function convertToCamelCase(str: string) {
    return str.replace(/_([a-z])/g, (letter) => letter.toUpperCase());
}

function convertToSnakeCase(str: string) {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

// recursively convert all keys in an object to snake case. if the value is an array of objects, convert the keys of those objects to snake case as well
function convertKeysToSnakeCase<T extends object>(obj: T): SnakeCaseKeys<T> {
    const snakeCaseObj: any = {};
    for (const key in obj) {
        const snakeCaseKey = convertToSnakeCase(key);
        if (Array.isArray(obj[key])) {
            snakeCaseObj[snakeCaseKey] = (obj[key] as any[]).map((item) => {
                if (typeof item === "object") {
                    return convertKeysToSnakeCase(item);
                }
                return item;
            });
        } else if (typeof obj[key] === "object") {
            snakeCaseObj[snakeCaseKey] = convertKeysToSnakeCase(obj[key] as any);
        } else {
            snakeCaseObj[snakeCaseKey] = obj[key];
        }
    }
    return snakeCaseObj;
}

type SnakeCaseKeys<T> = {
    [K in keyof T as CamelToSnakeCase<string & K>]: T[K] extends (infer R)[]
        ? R extends object
            ? SnakeCaseKeys<R>[]
            : T[K]
        : T[K] extends object
        ? SnakeCaseKeys<T[K]>
        : T[K];
};

type CamelToSnakeCase<S extends string> = S extends `${infer P1}${infer P2}`
    ? `${P1 extends Capitalize<P1> ? "_" : ""}${Lowercase<P1>}${CamelToSnakeCase<P2>}`
    : S;

type MimeTypeRow = {
    id: number;
    name: string;
    description: string;
    deprecated: boolean;
    use_instead: string;
};
