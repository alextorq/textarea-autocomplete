const DEFAULT_EXCEPTIONS = new Set([
    "кое-что",
    "кое-какой",
    "кое-куда",
    "что-то",
    "кто-то",
    "как-нибудь",
    "почему-то",
    "по-моему",
    "то-то",
    "где-то",
    "куда-нибудь",
    "когда-нибудь"
]);


export interface TokenizerOptions {
    lowercase?: boolean;
    keepPunctuation?: boolean;
    eosToken?: string | null;
    normalizeYo?: boolean; // "ё" → "е"
    exceptionWords?: string[]; // Дополнительные пользовательские исключения
}

export class WordTokenizer {
    private lowercase: boolean;
    private keepPunctuation: boolean;
    private eosToken: string | null;
    private normalizeYo: boolean;
    private exceptions: Set<string>;

    constructor(options: TokenizerOptions = {}) {
        this.lowercase = options.lowercase ?? true;
        this.keepPunctuation = options.keepPunctuation ?? true;
        this.eosToken = options.eosToken ?? "";
        this.normalizeYo = options.normalizeYo ?? true;

        this.exceptions = new Set([
            ...DEFAULT_EXCEPTIONS,
            ...(options.exceptionWords ?? [])
        ]);
    }

    tokenize(text: string): string[] {
        if (this.lowercase) {
            text = text.toLowerCase();
        }

        if (this.normalizeYo) {
            text = text.replace(/ё/g, "е");
        }

        const tokens: string[] = [];

        // Слова с дефисами, апострофами, числа с пунктуацией
        const wordRegex =
            /[\p{Letter}\p{Number}]+(?:[--–—'\u2019][\p{Letter}\p{Number}]+)*/u;

        let match: RegExpExecArray | null;
        let lastIndex = 0;
        const regex = new RegExp(wordRegex.source, "gu");

        while ((match = regex.exec(text)) !== null) {
            const word = match[0];
            const before = text.slice(lastIndex, match.index);

            this.pushPunctTokens(before, tokens);

            tokens.push(this.handleExceptions(word));
            lastIndex = match.index + word.length;
        }

        const tail = text.slice(lastIndex);
        this.pushPunctTokens(tail, tokens);

        if (this.eosToken) {
            tokens.push(this.eosToken);
        }

        return tokens;
    }

    private pushPunctTokens(chunk: string, output: string[]) {
        if (!this.keepPunctuation) return;
        for (const ch of [...chunk]) {
            if (ch.trim() !== "") {
                output.push(ch);
            }
        }
    }

    private handleExceptions(word: string): string {
        if (this.exceptions.has(word)) return word;
        return word;
    }
}
