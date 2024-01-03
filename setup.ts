import { type QueryResult, type QueryResultRow } from "@vercel/postgres";
import _mimeTypes from "./mime-types.json";
import { createTable, sql } from "./orm";
import { MimeTypeTable, type MimeTypeSchema } from "./schema/MimeType";

const ogMimeTypes = _mimeTypes as MimeType[];
const mimeTypes: Record<string, any>[] = [];
for (const mimeType of ogMimeTypes) {
    mimeTypes.push(mimeType);
}
for (const mimeType of ogMimeTypes) {
    for (const type in mimeType.links.deprecates) {
        const name = mimeType.links.deprecates[type];
        if (alreadyExists(name)) {
            const existing = getMimeTypeByName(name);
            if (!existing) continue;
            const childOf = existing?.links?.childOf;
            if (!childOf) {
                existing.links.childOf = [mimeType.name];
            }
            if (!childOf?.includes(mimeType.name)) {
                existing.links.childOf.push(mimeType.name);
            }
            existing.deprecated = true;
            continue;
        }
        mimeTypes.push({
            name: name,
            description: "",
            links: {
                childOf: [mimeType.name],
                deprecates: [],
                relatedTo: [],
                parentOf: [],
                alternativeTo: [],
            } as any,
            fileTypes: [],
            furtherReading: [],
            notices: {
                hasNoOfficial: false,
                communityContributed: false,
                popularUsage: null,
            },
            deprecated: true,
        });
    }
    for (const type in mimeType.links.relatedTo) {
        const name = mimeType.links.relatedTo[type];
        if (alreadyExists(name)) {
            const existing = getMimeTypeByName(name);
            if (!existing) continue;
            (existing.links as any).relatedTo.push(mimeType.name);
            continue;
        }
        mimeTypes.push({
            name: name,
            description: "",
            links: {
                childOf: [],
                deprecates: [],
                relatedTo: [mimeType.name],
                parentOf: [],
                alternativeTo: [],
            } as any,
            fileTypes: [],
            furtherReading: [],
            notices: {
                hasNoOfficial: false,
                communityContributed: false,
                popularUsage: null,
            },
        });
    }

    for (const type in mimeType.links.parentOf) {
        const name = mimeType.links.parentOf[type];
        if (alreadyExists(name)) {
            const existing = getMimeTypeByName(name);
            if (!existing) continue;
            (existing.links as any).childOf.push(mimeType.name);
            continue;
        }
        mimeTypes.push({
            name: name,
            description: "",
            links: {
                childOf: [mimeType.name],
                deprecates: [],
                relatedTo: [],
                parentOf: [],
                alternativeTo: [],
            } as any,
            fileTypes: [],
            furtherReading: [],
            notices: {
                hasNoOfficial: false,
                communityContributed: false,
                popularUsage: null,
            },
        });
    }

    for (const type in mimeType.links.alternativeTo) {
        const name = mimeType.links.alternativeTo[type];
        if (alreadyExists(name)) {
            const existing = getMimeTypeByName(name);
            if (!existing) continue;
            (existing.links as any).alternativeTo.push(mimeType.name);
            continue;
        }
        mimeTypes.push({
            name: name,
            description: "",
            links: {
                childOf: [],
                deprecates: [],
                relatedTo: [],
                parentOf: [],
                alternativeTo: [mimeType.name],
            } as any,
            fileTypes: [],
            furtherReading: [],
            notices: {
                hasNoOfficial: false,
                communityContributed: false,
                popularUsage: null,
            },
        });
    }
}

function getMimeTypeByName(name: string) {
    return mimeTypes.find((mimeType) => mimeType.name === name);
}

function alreadyExists(name: string) {
    return mimeTypes.some((mimeType) => mimeType.name === name);
}

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
    await seedDb(mimeTypes as any).catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
}

async function dropTables() {
    console.log("Dropping database tables...");
    await sql(`DROP TABLE notices;`).catch(handleError);
    await sql(`DROP TABLE further_reading;`).catch(handleError);
    await sql(`DROP TABLE extensions;`).catch(handleError);
    await sql(`DROP TYPE link_type;`).catch(handleError);
    await sql(`DROP TABLE links;`).catch(handleError);
    await sql(`DROP TABLE mime_types CASCADE;`).catch(handleError);
    console.log("Database tables dropped!");
}

function handleError(error: Error) {
    console.error(error.message);
}

async function createTables() {
    console.log("Creating database tables...");
    const createMimeTypeTable = () => createTable("mime_types", MimeTypeTable);
    const createLinksTable = async () => {
        await sql(`
            CREATE TYPE link_type AS ENUM (
                'deprecates',
                'related_to',
                'parent_of',
                'child_of',
                'alternative_to'
            );
        `);
        return await sql(`
            CREATE TABLE links (
                id SERIAL PRIMARY KEY,
                mime_type_id INT REFERENCES mime_types(id),
                type link_type NOT NULL,
                link TEXT NOT NULL
            );
        `);
    };

    const createFileTypesTable = async () => {
        await sql(`
            CREATE TABLE extensions (
                id SERIAL PRIMARY KEY,
                mime_type_id INT REFERENCES mime_types(id),
                extension VARCHAR(500) NOT NULL
            );
        `);
    };

    const createFurtherReadingTable = () =>
        sql(`
        CREATE TABLE further_reading (
            id SERIAL PRIMARY KEY,
            mime_type_id INT REFERENCES mime_types(id),
            title VARCHAR(500) NOT NULL,
            url VARCHAR(500) NOT NULL
        );
    `);

    const createNoticesTable = () =>
        sql(`
        CREATE TABLE notices (
            id SERIAL PRIMARY KEY,
            mime_type_id INT REFERENCES mime_types(id),
            has_no_official BOOLEAN DEFAULT FALSE,
            community_contributed BOOLEAN DEFAULT FALSE,
            popular_usage VARCHAR(500)
        );
    `);

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
        return sql<MimeTypeSchema>(
            `
            INSERT INTO mime_types (
                name,
                description,
                deprecated,
                use_instead
            ) VALUES (
                $1,
                $2,
                $3,
                $4
            ) RETURNING id;
        `,
            [mimeType.name, mimeType.description, mimeType.deprecated, mimeType.use_instead]
        );
    };

    const insertLinks = (mimeTypeID: number, links: SnakeCaseKeys<MimeType>["links"]) => {
        const linkTypes = Object.keys(links) as (keyof typeof links)[];
        return Promise.all(
            linkTypes.map(async (linkType) => {
                const link = links[linkType];
                if (!link.length) return;
                for (const url of link) {
                    await sql(
                        `
                        INSERT INTO links (
                            mime_type_id,
                            type,
                            link
                        ) VALUES (
                            $1,
                            $2,
                            $3
                        );
                    `,
                        [mimeTypeID, linkType, url]
                    );
                }
            })
        );
    };

    const insertFileTypes = async (
        mimeTypeID: number,
        fileTypes: SnakeCaseKeys<MimeType>["file_types"]
    ) => {
        for (const fileType of fileTypes) {
            await sql(
                `
                INSERT INTO extensions (
                    mime_type_id,
                    extension
                ) VALUES (
                    $1,
                    $2
                );
            `,
                [mimeTypeID, fileType]
            );
        }
    };

    const insertFurtherReading = async (
        mimeTypeID: number,
        furtherReading: SnakeCaseKeys<MimeType>["further_reading"]
    ) => {
        for (const { title, url } of furtherReading) {
            await sql(
                `
                INSERT INTO further_reading (
                    mime_type_id,
                    title,
                    url
                ) VALUES (
                    $1,
                    $2,
                    $3
                );
            `,
                [mimeTypeID, title, url]
            );
        }
    };

    const insertNotices = (mimeTypeID: number, notices: SnakeCaseKeys<MimeType>["notices"]) => {
        return sql(
            `
            INSERT INTO notices (
                mime_type_id,
                has_no_official,
                community_contributed,
                popular_usage
            ) VALUES (
                $1,
                $2,
                $3,
                $4
            );
        `,
            [
                mimeTypeID,
                notices.has_no_official,
                notices.community_contributed,
                notices.popular_usage,
            ]
        );
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
    const mimeTypeRow = await getOne(sql(`SELECT * FROM mime_types WHERE name = ${type};`));
    if (!mimeTypeRow) throw new Error(`No mime type found for ${type}`);
    const linksRow = await getOne(
        sql(`SELECT * FROM links WHERE mime_type_id = ${mimeTypeRow.id};`)
    );
    if (!linksRow) throw new Error(`No links found for ${type}`);
    const fileTypesRow = await getOne(
        sql(`SELECT * FROM file_types WHERE mime_type_ids LIKE ${`%${mimeTypeRow.id}%`};`)
    );
    if (!fileTypesRow) throw new Error(`No file types found for ${type}`);
    type FurtherReadingRows = {
        id: number;
        mime_type_id: number;
        title: string;
        url: string;
    };
    const furtherReadingRows = await sql<FurtherReadingRows>(
        `SELECT * FROM further_reading WHERE mime_type_id = ${mimeTypeRow.id};`
    );
    if (!furtherReadingRows) throw new Error(`No further reading found for ${type}`);
    const noticesRow = await getOne(
        sql(`SELECT * FROM notices WHERE mime_type_id = ${mimeTypeRow.id};`)
    );
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

async function getOne(arg: Promise<any>): Promise<any>;
async function getOne<O extends QueryResultRow>(arg: Promise<QueryResult<O>>): Promise<O | null>;
async function getOne<O extends QueryResultRow>(arg: Promise<any> | Promise<QueryResult<O>>) {
    if (typeof arg === "string") {
        const result = await sql(arg);
        return result.rows[0] ?? null;
    }
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
