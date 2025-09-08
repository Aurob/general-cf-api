export default {
	name: "Letterboxd RSS Wrapper",
	tags: [""],
};

export async function fetchLetterboxdRSS(request, env, ctx) {
    const rssUrl = "https://letterboxd.com/raufilm/rss/"; // Replace with your RSS URL
    const response = await fetch(rssUrl);

    if (!response.ok) {
      return new Response("Failed to fetch RSS feed", { status: response.status });
    }

    // Read the RSS content as text
    const rssText = await response.text();

    // Regex patterns to extract `<item>` contents
    const itemRegex = /<item>([\s\S]*?)<\/item>/g; // Match each `<item>` block
    const titleRegex = /<title>(.*?)<\/title>/;    // Extract `<title>` from item
    const linkRegex = /<link>(.*?)<\/link>/;      // Extract `<link>` from item

    // Parse and collect results
    const items = [];
    let match;
    while ((match = itemRegex.exec(rssText)) !== null) {
      const itemContent = match[1];
      const titleMatch = titleRegex.exec(itemContent);
      const linkMatch = linkRegex.exec(itemContent);

      items.push({
        title: titleMatch ? titleMatch[1] : "No title",
        link: linkMatch ? linkMatch[1] : "No link",
      });
    }
    return items;
  }
