/**
 * Конфигурация для модели PPM.
 */
interface PPMConfig {
    /**
     * Максимальный порядок контекста (Order).
     * Например, 3 означает, что мы смотрим на 3 предыдущих слова.
     * Значения 3-5 обычно оптимальны для текста.
     */
    order: number;
}

/**
 * Результат предсказания.
 * Token: слово, Probability: вероятность (0-1).
 */
interface PredictionResult {
    token: string;
    probability: number;
}

/**
 * Узел Trie дерева.
 * Хранит счетчики для текущего контекста и ссылки на продолжения.
 */
class ContextNode {
    // Счетчик конкретных токенов, идущих после этого контекста
    public counts: Map<string, number> = new Map();

    // Дочерние узлы (продолжение контекста)
    public children: Map<string, ContextNode> = new Map();

    // Общее количество наблюдений в этом контексте
    public totalCount: number = 0;

    /**
     * Обновляет статистику узла для данного токена.
     */
    public addToken(token: string): void {
        const currentCount = this.counts.get(token) || 0;
        this.counts.set(token, currentCount + 1);
        this.totalCount++;
    }

    /**
     * Количество уникальных токенов, виденных в этом контексте.
     * Важно для реализации Method C (Escape probability).
     */
    public get distinctCount(): number {
        return this.counts.size;
    }
}

/**
 * Класс Prediction by Partial Matching (PPM).
 * Реализует вариант PPM-C с полным исключением (Full Exclusion).
 */
export class PPMModel {
    private readonly maxOrder: number;
    private readonly root: ContextNode;
    // Глобальный словарь всех уникальных слов (для Order -1)
    private readonly vocabulary: Set<string>;

    constructor(config: PPMConfig = { order: 3 }) {
        this.maxOrder = config.order;
        this.root = new ContextNode();
        this.vocabulary = new Set();
    }

    /**
     * Обучает модель на массиве токенов.
     * @param tokens Массив слов (строк).
     */
    public train(tokens: string[]): void {
        if (!tokens || tokens.length === 0) return;

        // Добавляем все токены в глобальный словарь
        tokens.forEach(t => this.vocabulary.add(t));

        // Проходим по каждому токену в потоке
        for (let i = 0; i < tokens.length; i++) {
            const currentToken = tokens[i];

            // Обновляем контексты разных порядков (от 0 до maxOrder)
            // Мы смотрим "назад" от текущей позиции
            for (let order = 0; order <= this.maxOrder; order++) {
                if (i - order < 0) break; // Недостаточно истории для этого порядка

                // Формируем контекст: tokens[i-order ... i-1]
                const context = tokens.slice(i - order, i);

                // Вставляем токен в дерево под этим контекстом
                this.updateTrie(context, currentToken);
            }
        }
    }

    /**
     * Предсказывает распределение вероятностей для следующего слова.
     * @param history Токены предыдущего контекста.
     * @returns Отсортированный массив предсказаний.
     */
    public predict(history: string[]): PredictionResult[] {
        // Обрезаем историю до maxOrder, так как более старые данные нам не нужны для поиска узла
        const relevantHistory = history.slice(-this.maxOrder);

        // Массив для накопления вероятностей всех кандидатов
        const probabilities = new Map<string, number>();

        // Mask: множество токенов, вероятность которых уже была посчитана на более высоких уровнях.
        // Это нужно для "Exclusion Principle" (Принципа исключения).
        const excludedTokens = new Set<string>();

        // Рекурсивный расчет вероятностей, начиная с самого длинного возможного контекста
        this.calculateProbabilitiesRecursive(relevantHistory, probabilities, excludedTokens, 1.0);

        // Преобразуем Map в массив и сортируем по убыванию вероятности
        return Array.from(probabilities.entries())
            .map(([token, prob]) => ({ token, probability: prob }))
            .sort((a, b) => b.probability - a.probability);
    }

    // --- Private Helpers ---

    /**
     * Обновляет Trie дерево: находит (или создает) узел контекста и инкрементирует токен.
     */
    private updateTrie(context: string[], token: string): void {
        let currentNode = this.root;

        for (const word of context) {
            if (!currentNode.children.has(word)) {
                currentNode.children.set(word, new ContextNode());
            }
            currentNode = currentNode.children.get(word)!;
        }

        currentNode.addToken(token);
    }

    /**
     * Ядро алгоритма PPM.
     * Рекурсивно спускается от длинного контекста к короткому (Escape).
     * * @param context Текущий рассматриваемый контекст.
     * @param results Map для записи итоговых вероятностей.
     * @param excluded Set токенов, исключенных из рассмотрения на этом уровне.
     * @param currentWeight Вес вероятности, пришедший сверху (остаточная вероятность после Escape).
     */
    private calculateProbabilitiesRecursive(
        context: string[],
        results: Map<string, number>,
        excluded: Set<string>,
        currentWeight: number
    ): void {
        // Если вес стал ничтожно мал, останавливаемся (оптимизация)
        if (currentWeight < 1e-9) return;

        // --- Базовый случай: Order -1 ---
        // Если контекст пуст и мы всё еще не нашли узел (или спустились сюда рекурсивно),
        // распределяем остаточный вес равномерно среди слов, которые мы еще не предсказали.
        if (context.length === 0 && !this.findNode(context)) {
            this.handleOrderMinusOne(results, excluded, currentWeight);
            return;
        }

        const node = this.findNode(context);

        // Если узел не найден для этого контекста, сразу "уходим" (Escape) на порядок ниже
        if (!node) {
            // Рекурсия с тем же весом, но укороченным контекстом (удаляем первое слово)
            this.calculateProbabilitiesRecursive(context.slice(1), results, excluded, currentWeight);
            return;
        }

        // --- Расчет по методу PPM-C ---
        // P(token) = Count(token) / (Total + Distinct)
        // P(Escape) = Distinct / (Total + Distinct)

        const total = node.totalCount;
        const distinct = node.distinctCount;
        const denominator = total + distinct;

        // Вероятность ухода на уровень ниже
        const escapeProb = distinct / denominator;

        // Доля вероятности, которая распределяется на этом уровне
        const nodeProbMass = 1.0 - escapeProb;

        // Проходим по всем токенам, известным в этом контексте
        for (const [token, count] of node.counts) {
            // Exclusion: Если токен уже был предсказан на более высоком уровне, пропускаем его.
            if (excluded.has(token)) continue;

            // Raw probability in Method C
            const rawProb = count / denominator;

            // Взвешенная вероятность
            const finalProb = rawProb * currentWeight;

            // Записываем результат
            results.set(token, (results.get(token) || 0) + finalProb);

            // Добавляем в исключения для нижних уровней
            excluded.add(token);
        }

        // --- Escape (Рекурсивный спуск) ---
        // Мы передаем "вес ухода" (currentWeight * escapeProb) на уровень ниже
        // Контекст уменьшается (убираем самое старое слово: ['a', 'b'] -> ['b'])
        if (context.length > 0) {
            this.calculateProbabilitiesRecursive(
                context.slice(1),
                results,
                excluded,
                currentWeight * escapeProb // Только этот остаток достанется нижнему уровню
            );
        } else {
            // Если мы были в контексте длины 0 (Root) и всё равно уходим, идем в Order -1
            this.handleOrderMinusOne(results, excluded, currentWeight * escapeProb);
        }
    }

    /**
     * Обработка уровня Order -1.
     * Это "страховочный" уровень, гарантирующий, что любое известное слово имеет ненулевую вероятность.
     */
    private handleOrderMinusOne(
        results: Map<string, number>,
        excluded: Set<string>,
        weight: number
    ): void {
        const vocabSize = this.vocabulary.size;
        const observedSize = excluded.size;

        // Количество слов, которым мы еще не дали вероятность
        const unpredictedCount = vocabSize - observedSize;

        if (unpredictedCount <= 0) return;

        // Равномерное распределение остаточного веса
        const probPerToken = weight / unpredictedCount;

        for (const token of this.vocabulary) {
            if (!excluded.has(token)) {
                results.set(token, probPerToken);
            }
        }
    }

    /**
     * Поиск узла в Trie по пути контекста.
     */
    private findNode(context: string[]): ContextNode | null {
        let currentNode = this.root;
        for (const word of context) {
            const nextNode = currentNode.children.get(word);
            if (!nextNode) return null;
            currentNode = nextNode;
        }
        return currentNode;
    }
}