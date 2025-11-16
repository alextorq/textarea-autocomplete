export const getArticlesFromWikipedia = async (titles: string[]): Promise<Map<string, string>> => {
    const endpoint = 'https://ru.wikipedia.org/w/api.php';
    const params = {
        action: 'query',
        prop: 'extracts',
        explaintext: '', // можно оставить
        format: 'json',
        origin: '*',
        titles: titles.join('|')
    };

    const url = new URL(endpoint);
    Object.keys(params).forEach(key => url.searchParams.append(key, (params as any)[key]));

    const response = await fetch(url.toString());
    const data = await response.json();

    const articlesMap = new Map<string, string>();
    if (data.query && data.query.pages) {
        for (const pageId in data.query.pages) {
            const page = data.query.pages[pageId];
            if (page.title && page.extract) {
                articlesMap.set(page.title, page.extract);
            }
        }
    }

    return articlesMap;
};