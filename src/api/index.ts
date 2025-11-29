export const getArticlesFromWikipedia = async (titles: string[]): Promise<Map<string, string>> => {
    const endpoint = 'https://ru.wikipedia.org/w/api.php';

    const articlesMap = new Map<string, string>();

    const promises = titles.map((article) => {
        const params = {
            action: 'query',
            prop: 'extracts',
            explaintext: '', // можно оставить
            format: 'json',
            origin: '*',
            titles: article
        };

        const url = new URL(endpoint);
        Object.keys(params).forEach(key => url.searchParams.append(key, (params as any)[key]));

        return fetch(url.toString()).then((response) => response.json());
    })


    const datas = await Promise.all(promises)

    for (const item of datas) {
        if (item.query && item.query.pages) {
            for (const pageId in item.query.pages) {
                const page = item.query.pages[pageId];
                if (page.title && page.extract) {
                    articlesMap.set(page.title, page.extract);
                }
            }
        }
    }

    return articlesMap;
};