export default {
	name: "OpenLibrary API Wrapper",
	tags: [""],
};

export async function fetchBookInfo() {
	const url = "https://openlibrary.org/people/aurob9599/lists/OL261887L/seeds.json";
	const response = await fetch(url);
	return await response.json();
}

export async function updateCache(env) {
	const bookInfo = await fetchBookInfo();
	await env.DUMP.put("cache/ol_books.json", JSON.stringify(bookInfo));
}

export async function getCachedBooks(env) {
	const response = await env.DUMP.get("cache/ol_books.json");
	if (!response) return null;
	const text = await response.text();
	return JSON.parse(text);
}

export function fuzzySearch(query, books) {
	return books.filter((book) => {
		const bookTitle = book.title.toLowerCase();
		const queryLower = query.toLowerCase();
		let similarity = 0;
		let maxSimilarity = Math.max(bookTitle.length, queryLower.length);
		for (let i = 0; i < bookTitle.length; i++) {
			for (let j = 0; j < queryLower.length; j++) {
				if (bookTitle[i] === queryLower[j]) {
					similarity++;
					break;
				}
			}
		}
		const similarityRatio = similarity / maxSimilarity;
		return similarityRatio > 0.6;
	});
}

export async function handleBooksRequest(env, query) {
    let books = await getCachedBooks(env);
    if (!books) {
        await updateCache(env);
        return { message: "Cache updated. Try again in a few seconds." };
    }
    if (!query.q) {
        return books;
    }
    return fuzzySearch(query.q, books);
}
