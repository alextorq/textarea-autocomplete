// ==========================================
// Stupid Backoff Logic Engine
// ==========================================

import type {IAutoCompleter, Suggestion} from "../interface.ts";
import type {ITokenizer, TokenID} from "./tokenizer.ts";
import type {INGramStore} from "./store.ts";

// Константа Alpha из оригинальной статьи Google (Brants et al., 2007)
const ALPHA = 0.4;
// Максимальный порядок N-граммы (например, 3 для триграмм: context из 2 слов -> прогноз 1 слова)


/**
 * STUPID BACKOFF AUTOCOMPLETE IMPLEMENTATION
 * ------------------------------------------
 * Описание:
 * Это реализация N-граммной языковой модели с алгоритмом сглаживания "Stupid Backoff".
 * Вместо того, чтобы просто возвращать 0, если N-грамма не найдена, мы "отступаем" (backoff)
 * к (N-1)-грамме и умножаем результат на коэффициент alpha (обычно 0.4).
 *
 * Формула:
 * S(w|h) = count(h+w) / count(h)  (если найдено)
 * = alpha * S(w|h')        (иначе, где h' - усеченный контекст)
 */



/**
 * Ядро алгоритма.
 * Отвечает за расчет вероятностей
 */
export class StupidBackoffModel implements IAutoCompleter {
    private tokenizer: ITokenizer;
    private store: INGramStore;
    private n: number; // Order (например, 3 для триграмм)

    constructor(order: number, tokenizer: ITokenizer, store: INGramStore) {
        this.tokenizer = tokenizer;
        this.store = store;
        this.n = order;
    }

    /**
     * Обучение модели на сыром тексте.
     * Проходит скользящим окном по токенам и сохраняет N-граммы всех порядков (1..N).
     */
    public train(text: string): void {
        const tokens = this.tokenizer.tokenize(text);

        // Добавляем маркеры начала и конца, если нужно (здесь упрощено)
        // Для автокомплита часто важно просто скользящее окно.

        for (let i = 0; i < tokens.length; i++) {
            // Сохраняем униграммы, биграммы, триграммы и т.д.
            for (let k = 1; k <= this.n; k++) {
                if (i - k + 1 < 0) continue;
                const ngram = tokens.slice(i - k + 1, i + 1);
                this.store.increment(ngram);
            }
        }
    }

    /**
     * Рекурсивная функция расчета Score по алгоритму Stupid Backoff.
     */
    private getScore(candidate: TokenID, context: TokenID[]): number {
        // Длина N-граммы, которую мы пытаемся найти (контекст + кандидат)
        const order = context.length + 1;
        const ngram = [...context, candidate];

        const countNgram = this.store.getCount(ngram);

        // 1. Базовый случай: Униграммы (Order 1)
        // Если контекст пуст, возвращаем относительную частоту слова (MLE)
        if (order === 1) {
            const total = this.store.getTotalTokens();
            // Защита от деления на 0
            return total > 0 ? countNgram / total : 0;
        }

        // 2. Если N-грамма найдена в корпусе
        if (countNgram > 0) {
            const countContext = this.store.getCount(context);
            // MLE: Count(Context + Word) / Count(Context)
            return countContext > 0 ? countNgram / countContext : 0;
        }

            // 3. Backoff (Отступление)
            // Если N-грамма не найдена, откатываемся к (N-1) грамме.
        // Score = alpha * Score(word | context_without_first_word)
        else {
            // Уменьшаем контекст, убирая первое слово (самое старое)
            const shortenedContext = context.slice(1);
            return ALPHA * this.getScore(candidate, shortenedContext);
        }
    }

    /**
     * Основной метод предсказания.
     */
    public predict(inputText: string, topK: number = 5): Suggestion[] {
        // 1. Токенизация входной строки
        const tokens = this.tokenizer.tokenize(inputText);

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

        // 3. Генерация кандидатов
        // В "тупом" варианте мы бы перебирали ВЕСЬ словарь. Это O(|V|).
        // В оптимизированном (нашем) варианте мы смотрим, какие слова встречались
        // после данного контекста (триграммный контекст).
        // Если для триграмм ничего нет, backoff заставит нас смотреть биграммный контекст.

        const candidates = new Set<TokenID>();

        // Стратегия поиска кандидатов ("Backoff aware candidate generation"):
        // Пытаемся найти кандидатов для самого длинного контекста.
        // Если их нет (или мало), можно "отступить" по контексту, чтобы найти больше вариантов.
        // Здесь реализуем жадный сбор кандидатов: смотрим контекст длины K, K-1... 1.

        const currentCtx = [...context];
        while (currentCtx.length >= 0) {
            const found = this.store.getCandidates(currentCtx);
            found.forEach(_ => candidates.add(_));

            if (currentCtx.length === 0) break; // Мы проверили даже униграммы (пустой контекст)
            currentCtx.shift(); // Убираем первое слово (Backoff контекста)

            // Оптимизация: если набрали достаточно кандидатов, можно остановиться,
            // но для точности лучше проверить всех "разумных" кандидатов.
        }

        // Если совсем ничего не нашли (редкий случай для большого корпуса), можно добавить топ униграмм.

        // 4. Оценка (Scoring) каждого кандидата
        const results: Suggestion[] = [];
        for (const candidateId of candidates) {
            const score = this.getScore(candidateId, context);
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
