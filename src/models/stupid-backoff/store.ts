// ==========================================
// 3. NGram Storage (Sparse Representation)
// ==========================================

import type {TokenID} from "./tokenizer.ts";

export type NGramKey = string; // Формат "id1,id2"

export interface INGramStore {
    increment(ngram: TokenID[]): void;
    getCount(ngram: TokenID[]): number;
    getTotalTokens(): number;
    getCandidates(context: TokenID[]): Set<TokenID>;
}

/**
 * Хранилище счетчиков.
 * Использует разреженное представление: мы храним только встреченные N-граммы.
 * Для быстрого поиска кандидатов мы также храним карту контекстов.
 */
export class NGramStore implements INGramStore{
    // Основная таблица частот: "id1,id2" -> count
    private counts: Map<NGramKey, number> = new Map();

    // Оптимизация для автокомплита: Context -> Set of Candidates
    // Позволяет не перебирать весь словарь при предсказании.
    // Key: "id1,id2" (контекст), Value: Set([id3, id4...]) (возможные продолжения)
    private contextMap: Map<NGramKey, Set<TokenID>> = new Map();

    // Общее количество токенов (для расчета частоты униграмм)
    private totalTokens: number = 0;

    public increment(ngram: TokenID[]): void {
        const key = this.toKey(ngram);
        const currentCount = this.counts.get(key) || 0;
        this.counts.set(key, currentCount + 1);

        if (ngram.length === 1) {
            this.totalTokens++;
        }

        // Если это N-грамма порядка > 1, регистрируем связь Context -> NextWord
        // Например для триграммы [A, B, C]: Контекст [A, B] -> Кандидат C
        if (ngram.length > 1) {
            const context = ngram.slice(0, -1);
            const candidate = ngram[ngram.length - 1];
            const contextKey = this.toKey(context);

            if (!this.contextMap.has(contextKey)) {
                this.contextMap.set(contextKey, new Set());
            }
            this.contextMap.get(contextKey)!.add(candidate);
        }
    }

    public getCount(ngram: TokenID[]): number {
        return this.counts.get(this.toKey(ngram)) || 0;
    }

    public getTotalTokens(): number {
        return this.totalTokens;
    }

    /**
     * Возвращает список кандидатов (следующих слов), которые когда-либо
     * встречались после данного контекста.
     */
    public getCandidates(context: TokenID[]): Set<TokenID> {
        return this.contextMap.get(this.toKey(context)) || new Set();
    }

    /**
     * Превращает массив ID в строковый ключ для Map.
     * Самый быстрый способ в JS для составных ключей.
     */
    private toKey(ids: TokenID[]): string {
        return ids.join(",");
    }
}