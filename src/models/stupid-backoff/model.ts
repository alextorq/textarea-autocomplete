import type {IAutoCompleter, Suggestion} from "../interface.ts";
import type {ITokenizer, TokenID} from "./tokenizer.ts";
import type {INGramStore} from "./store.ts";
import {Source, type SourceKey} from "../source.ts";

// Константа Alpha из оригинальной статьи Google (Brants et al., 2007)
const ALPHA = 0.4;

/**
 * Ядро алгоритма.
 * Отвечает за расчет вероятностей
 */
export class StupidBackoffModel implements IAutoCompleter {
    private tokenizer: ITokenizer;
    private readonly generalStore: INGramStore;
    private readonly userStore: INGramStore;
    private readonly n: number; // Order (например, 3 для триграмм)

    constructor(order: number, tokenizer: ITokenizer, generalStore: INGramStore, userStore: INGramStore) {
        this.tokenizer = tokenizer;
        this.generalStore = generalStore;
        this.userStore = userStore;
        this.n = order;
    }

    private getStoreBySource(source: SourceKey): INGramStore {
        switch (source) {
            case Source.GENERAL:
                return this.generalStore;
            case Source.USER:
                return this.userStore;
            default:
                throw new Error(`Unknown source: ${source}`);
        }
    }

    /**
     * Обучение модели на сыром тексте.
     * Проходит скользящим окном по токенам и сохраняет N-граммы всех порядков (1..N).
     */
    public train(text: string, source: SourceKey): void {
        const tokens = this.tokenizer.tokenize(text);
        const store = this.getStoreBySource(source)

        // Добавляем маркеры начала и конца, если нужно (здесь упрощено)
        // Для автокомплита часто важно просто скользящее окно.
        for (let i = 0; i < tokens.length; i++) {
            // Сохраняем униграммы, биграммы, триграммы и т.д.
            for (let k = 1; k <= this.n; k++) {
                if (i - k + 1 < 0) continue;
                const ngram = tokens.slice(i - k + 1, i + 1);
                store.increment(ngram);
            }
        }
    }

    /**
     * Рекурсивная функция расчета Score по алгоритму Stupid Backoff.
     */
    private getScore(source: INGramStore, candidate: TokenID, context: TokenID[]): number {
        // Длина N-граммы, которую мы пытаемся найти (контекст + кандидат)
        const order = context.length + 1;
        const ngram = [...context, candidate];

        const countNgram = source.getCount(ngram);

        // 1. Базовый случай: Униграммы (Order 1)
        // Если контекст пуст, возвращаем относительную частоту слова (MLE)
        if (order === 1) {
            const total = source.getTotalTokens();
            // Защита от деления на 0
            return total > 0 ? countNgram / total : 0;
        }

        // 2. Если N-грамма найдена в корпусе
        if (countNgram > 0) {
            const countContext = source.getCount(context);
            // MLE: Count(Context + Word) / Count(Context)
            return countContext > 0 ? countNgram / countContext : 0;
        }

        // 3. Backoff (Отступление)
        // Если N-грамма не найдена, откатываемся к (N-1) грамме.
        // Score = alpha * Score(word | context_without_first_word)
        else {
            // Уменьшаем контекст, убирая первое слово (самое старое)
            const shortenedContext = context.slice(1);
            return ALPHA * this.getScore(source, candidate, shortenedContext);
        }
    }


    private getCandidates(context: TokenID[]): {
        store: INGramStore;
        candidates: Set<TokenID>
        context: TokenID[];
    } | null {
        const currentCtx = [...context];

        const storeLevels = [
            this.userStore,
            this.generalStore
        ]

        while (currentCtx.length >= 0) {
            for (const store of storeLevels) {
                const found = store.getCandidates(currentCtx);

                if (found.size) {
                    return {
                        store: store,
                        candidates: found,
                        context: currentCtx
                    }
                }
            }

            if (currentCtx.length === 0) {
                break; // Мы проверили даже униграммы (пустой контекст)
            }
            currentCtx.shift(); // Убираем первое слово (Backoff контекста)
        }

        return null
    }

    /**
     * Основной метод предсказания.
     */
    public predict(inputText: string, topK: number = 5): Suggestion[] {
        // 1. Токенизация входной строки
        const tokens = this.tokenizer.tokenize(inputText);
        const results: Suggestion[] = [];

        // 2. Определение контекста
        // Нам нужны последние (N-1) слов, чтобы предсказать N-е слово.
        // Если слов мало, берем сколько есть.
        const contextSize = this.n - 1;
        let context = tokens.slice(-contextSize);

        // Убираем символ конца предложения, если он есть
        if (context.length > 0 && context[context.length - 1] === this.tokenizer.EOS_ID) {
            context.pop();
        }

        // Если контекст пуст (пользователь еще ничего не ввел),
        // логично вернуть самые популярные униграммы, но для простоты вернем пустой список
        // или можно реализовать fallback на топ популярных слов.
        if (context.length === 0 && tokens.length > 0) {
            // Краевой случай, если введено слов больше чем N
            context = tokens.slice(-(this.n - 1));
        }

        const candidatesByStores = this.getCandidates(context);
        if (!candidatesByStores) return results

        const source = candidatesByStores.store
        const candidates = candidatesByStores.candidates

        for (const candidateId of candidates) {
            const score = this.getScore(source, candidateId, context);
            results.push({
                word: this.tokenizer.getWord(candidateId),
                score: score
            });
        }

        // 5. Сортировка и выдача Top-K
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }
}
