// src/index.js
const corsHeaders = {
	'Access-Control-Allow-Headers': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Origin': '*',
};

// Cloudflare API endpoint and authentication
const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4';
const DNS_TOKEN = 'wSmPDZaaJjTPqJQn5JvAwjVrAZWXmsoVcX084ElY'

// Fetch DNS records for a specific zone (including subdomains)
async function fetchDNSRecords(env) {
	const zoneId = '05b743e57d82001c42b7a2d7d8f7d27f';
	const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records`, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${DNS_TOKEN}`,
			'Content-Type': 'application/json'
		}
	});
	const data = await response.json();
	return data.result || [];
}

async function handleResponse(data) {
	return new Response(JSON.stringify(data), {
		headers: {
			"Content-Type": "application/json",
			...corsHeaders
		}
	});
}

async function handleRequest(request, env) {
	if (request.method === "OPTIONS") {
		return new Response("OK", { headers: corsHeaders });
	}

	const url = new URL(request.url);
	const urlParams = url.searchParams;
	const path = url.pathname;
	const query = Object.fromEntries(urlParams);

	const data = {
		path,
		// query,
		time: (new Date()).toISOString()
	};

	try {
		if (path === "/books") {
			const books = await import("books.js");
			data.books = await books.handleBooksRequest(env, query);
		}
		else if (path === "/films") {
			const films = await import("films.js");
			data.films = await films.fetchLetterboxdRSS(env, query);
		}
		else if (path === "/todo") {
			const todo = await import("todo.js");
			data.todo = await todo.get_srht_todo(env, query);
		}
		else if (path === "/data") {

			let requestBody;
			if (request.method === "POST") {
				requestBody = await request.json();
			}
			else if (request.method === "GET") {
				requestBody = query;
			}

			console.log(requestBody)

			if ('q' in requestBody) {
				const datadb = await import("datadb.js");
				if ('alltags' in requestBody) {
					let includeCount = requestBody.count;
					data.results = await datadb.listTags(env, includeCount);
				}
				if (requestBody.tags) {
					data.results = await datadb.queryTag(env, requestBody.tags.split(','));
				}
			}
			else if (requestBody.k) {
				const key = requestBody.k;
				if (key == env.aukey) {
					const datadb = await import("datadb.js");
					if ("ddd" in requestBody) {
						if (request.method !== "POST") {
							return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
						}
						await datadb.dropData(env);
						data.dropped = true;
					}
					else if ("a" in requestBody) {
						if (request.method !== "POST") {
							return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
						}

						const title = requestBody.title;
						const content = requestBody.content;
						const type = requestBody.type;
						const tags = requestBody.tags ? requestBody.tags.split(',') : [];

						if (title || content || type) {
							await datadb.insertData(env, 'Main', title || '', content || '', type || 'txt', tags);
							data.test = true;
						} else if (tags.length > 0) {
							await datadb.insertData(env, 'Tag', '', '', '', tags);
							data.test = true;
						}
					}
				}
			} else {
				data.test = false;
			}
		}
		else if (path === '/dns') {
			const zoneId = '05b743e57d82001c42b7a2d7d8f7d27f';
			const response = await fetch(`${CLOUDFLARE_API_BASE}/zones/${zoneId}/dns_records`, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${DNS_TOKEN}`,
					'Content-Type': 'application/json'
				}
			});
			const _data = await response.json();
			const dns_data = _data.result || [];
			data.dns = dns_data
				.filter(record => ['A', 'AAAA', 'R2', 'CNAME', 'Worker'].includes(record.type))
				.map(record => record.name);

		}
		else if (path === '/r2d2') {
			let message = query.message || '';
			const audioBuffer = encodeMessageToAudio(message);
			const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
			const audioUrl = URL.createObjectURL(audioBlob);
			return new Response(audioUrl, {
				status: 200,
				headers: {
					'Content-Type': 'audio/wav',
					...corsHeaders
				}
			});
		}
		else if (path === '/list') {
			const url = new URL(request.url);
			const json = /^(1|yes|true)$/i.test(url.searchParams.get("json") || "");
			const list = await env.DUMP.list({ prefix: "", limit: 1000 });

			if (json) {
				const result = list.objects
					.filter(obj => !obj.key.endsWith("/"))
					.map(obj => ({
						key: obj.key,
						uploaded: obj.uploaded
					}));
				return new Response(JSON.stringify(result, null, 2), {
					headers: { "Content-Type": "application/json" },
				});
			}

			// Simple HTML response: just a list of files (no directories, no thumbnails)
			const items = list.objects
				.filter(obj => !obj.key.endsWith("/"))
				.map(obj => {
					const filename = obj.key.split("/").pop();
					return `<li><a href="/pdf/${encodeURIComponent(obj.key)}">${filename}</a></li>`;
				}).join("");

			const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PDF List</title>
</head>
<body>
  <h1>PDF Files</h1>
  <ul>
    ${items}
  </ul>
</body>
</html>
`;

			return new Response(html, {
				headers: { "Content-Type": "text/html" }
			});

		}
		else if (path.startsWith('/pdf/')) {
			const key = decodeURIComponent(path.slice(5)); // after "/pdf/"
			const object = await env.DUMP.get(key);
			if (!object) return new Response("Not found", { status: 404 });

			return new Response(object.body, {
				headers: {
					"Content-Type": "application/pdf",
					"Content-Disposition": `inline; filename="${key.split('/').pop()}"`
				}
			});
		}
		else {
			data.hello = "world";
		}
	}
	catch (error) {
		data.error = error.message;
		return await handleResponse(data);
	}

	return await handleResponse(data);
}

function encodeMessageToAudio(message) {
	// Simple encoding of message to audio frequencies
	const frequencies = [];
	for (let i = 0; i < message.length; i++) {
		const charCode = message.charCodeAt(i);
		const frequency = 440 + (charCode % 100); // Base frequency of 440Hz (A4) with variation
		frequencies.push(frequency);
	}
	// Convert frequencies to a simple audio buffer (mock implementation)
	const audioBuffer = new Uint8Array(frequencies.length * 2);
	for (let i = 0; i < frequencies.length; i++) {
		audioBuffer[i * 2] = frequencies[i] & 0xff;
		audioBuffer[i * 2 + 1] = (frequencies[i] >> 8) & 0xff;
	}
	return audioBuffer;
}

async function scheduled(event, env, ctx) {
	// await updateCache(env);
	return await handleResponse({ cron: true });
}

var src_default = {
	fetch: handleRequest,
	scheduled
};

export {
	src_default as default
};
//# sourceMappingURL=index.js.map
