export default {
	name: "D1 General Data SQL Wrapper",
	tags: [""],
};

export async function test(env) {
    const testq = await env.GENERAL.prepare(`
    SELECT 
        name
    FROM 
        sqlite_schema
    WHERE 
        type ='table' AND 
        name NOT LIKE '_cf%';
    `).all();
    return testq.results;
}

export async function insertData(env, tableName, title, content, type, tags) {
    if (!title) {
        throw new Error("Title is required and cannot be null.");
    }

    if (tags && !Array.isArray(tags)) {
        tags = tags.split(',');
    } else if (!tags) {
        tags = [];
    }

    const tagIds = [];
    for (let tag of tags) {
        tag = tag.trim().toLowerCase();
        const tagTitleQuery = await env.GENERAL.prepare(`
            SELECT id FROM Tag WHERE title = ?;
        `).bind(tag).all();

        if (tagTitleQuery.results.length === 0) {
            let description = '';
            const insertTagQuery = await env.GENERAL.prepare(`
                INSERT INTO Tag (title, description) VALUES (?, ?);
            `).bind(tag, description).run();
            tagIds.push(insertTagQuery.meta.last_row_id);
        } else {
            tagIds.push(tagTitleQuery.results[0].id);
        }
    }

    const insertMainQuery = await env.GENERAL.prepare(`
        INSERT INTO ${tableName} (title, content, type)
        VALUES (?, ?, ?);
    `).bind(title, content, type).run();

    const mainId = insertMainQuery.meta.last_row_id;

    for (let tagId of tagIds) {
        console.log(mainId, tagId)
        if(tagId == undefined) continue;
        await env.GENERAL.prepare(`
            INSERT INTO TagLink (tag_id, main_id) VALUES (?, ?);
        `).bind(tagId, mainId).run();
    }

    return {result: insertMainQuery.success, other:mainId}
}


export async function deleteData(env, tableName, condition) {
    const deleteQuery = await env.GENERAL.prepare(`
        DELETE FROM ${tableName}
        WHERE ${condition};
    `).run();

    return deleteQuery.success;
}

export async function dropData(env) {
    const dropQuery1 = await env.GENERAL.prepare(`
        DELETE FROM Main;
    `).run();
    const dropQuery2 = await env.GENERAL.prepare(`
        DELETE FROM Tag;
    `).run();
    const dropQuery3 = await env.GENERAL.prepare(`
        DELETE FROM TagLink;
    `).run();
    return dropQuery1.success;
}

export async function queryTag(env, tags, matchAllTags = false) {
    let tagIds = [];
    for (let tag of tags) {
        if (!isNaN(tag)) {
            const tagIdQuery = await env.GENERAL.prepare(`
                SELECT id FROM Tag WHERE id = ?;
            `).bind(parseInt(tag)).all();

            tagIds.push(parseInt(tag));
        } else {
            const tagTitleQuery = await env.GENERAL.prepare(`
                SELECT id FROM Tag WHERE title LIKE ?;
            `).bind(`%${tag}%`).all();
            if (tagTitleQuery.results.length === 0) {
                continue; // Skip if the tag title does not exist
            }
            tagIds = tagIds.concat(tagTitleQuery.results.map(result => result.id));
        }
    }

    if (tagIds.length === 0) {
        return []; // Return an empty list if no valid tag ids are found
    }

    const mainIdToTagsMap = new Map();
    for (let tagId of tagIds) {
        const mainQuery = await env.GENERAL.prepare(`
            SELECT Main.id, Tag.title FROM Main
            JOIN TagLink ON Main.id = TagLink.main_id
            JOIN Tag ON Tag.id = TagLink.tag_id
            WHERE TagLink.tag_id = ?
        `).bind(tagId).all();
        
        mainQuery.results.forEach(result => {
            if (!mainIdToTagsMap.has(result.id)) {
                mainIdToTagsMap.set(result.id, { main: null, tags: new Set() });
            }
            mainIdToTagsMap.get(result.id).tags.add(result.title);
        });
    }

    const results = [];
    for (let [mainId, data] of mainIdToTagsMap.entries()) {
        const mainRecordQuery = await env.GENERAL.prepare(`
            SELECT title, content, type FROM Main WHERE id = ?
        `).bind(mainId).all();
        
        if (mainRecordQuery.results.length > 0) {
            data.main = mainRecordQuery.results[0];
            data.main.matchedTags = Array.from(data.tags);
            results.push(data.main);
        }
    }

    return results;
}

export async function queryTitle(env, tableName, column, title) {
    const titleQuery = await env.GENERAL.prepare(`
        SELECT * FROM ${tableName}
        WHERE ${column} LIKE ?;
    `).bind(`%${title}%`).all();

    return titleQuery.results;
}

export async function selectAll(env, tableName) {
    const allQuery = await env.GENERAL.prepare(`
        SELECT * FROM ${tableName};
    `).all();

    return allQuery.results;
}

export async function listTags(env, includeCount = false) {
    let query = `
        SELECT Tag.title
        FROM Tag
    `;

    if (includeCount) {
        query = `
            SELECT Tag.title, COUNT(DISTINCT Main.id) as count
            FROM Tag
            JOIN TagLink ON Tag.id = TagLink.tag_id
            JOIN Main ON Main.id = TagLink.main_id
            GROUP BY Tag.id
        `;
    }

    const tagsQuery = await env.GENERAL.prepare(query).all();

    return [...new Set(tagsQuery.results.map(tag => tag.title))];
}
