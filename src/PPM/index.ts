interface PPMNode {
    children: Map<string, PPMNode>;
    count: number;
    total: number;
}

export class PPMModel {
    private root: PPMNode;
    private readonly maxOrder: number;
    private vocabulary: Set<string>;

    constructor(maxOrder: number = 4) {
        this.root = { children: new Map(), count: 0, total: 0 };
        this.maxOrder = maxOrder;
        this.vocabulary = new Set();
    }

    train(tokens: string[]): void {
        if (tokens.length === 0) {
            return;
        }

        // Обновляем словарь
        tokens.forEach(token => this.vocabulary.add(token));

        // Обрабатываем все возможные контексты
        for (let i = 0; i < tokens.length; i++) {
            for (let order = 1; order <= this.maxOrder; order++) {
                if (i >= order - 1) {
                    const context = tokens.slice(i - order + 1, i);
                    this.updateModel(context, tokens[i]);
                }
            }
            // Добавляем унарные вероятности (order = 0)
            this.updateModel([], tokens[i]);
        }
    }

    private updateModel(context: string[], nextToken: string): void {
        let currentNode = this.root;

        // Проходим по контексту
        for (const token of context) {
            if (!currentNode.children.has(token)) {
                currentNode.children.set(token, {
                    children: new Map(),
                    count: 0,
                    total: 0
                });
            }
            currentNode = currentNode.children.get(token)!;
        }

        // Обновляем счетчики для следующего токена
        if (!currentNode.children.has(nextToken)) {
            currentNode.children.set(nextToken, {
                children: new Map(),
                count: 0,
                total: 0
            });
        }

        const nextNode = currentNode.children.get(nextToken)!;
        nextNode.count++;
        currentNode.total++;
    }

    predictProbabilities(context: string[]): Map<string, number> {
        const probabilities = new Map<string, number>();

        // Добавляем сглаживание для неизвестных слов
        const alpha = 0.1;
        const vocabSize = this.vocabulary.size;

        // Вычисляем вероятности для каждого слова в словаре
        for (const token of this.vocabulary) {
            let probability = 0;
            let weightSum = 0;

            // Рассматриваем контексты разной длины (от самого длинного до пустого)
            for (let order = Math.min(context.length, this.maxOrder); order >= 0; order--) {
                const contextSlice = context.slice(context.length - order);
                const contextProb = this.getConditionalProbability(contextSlice, token);

                if (contextProb > 0) {
                    const weight = Math.pow(2, order); // Вес убывает с уменьшением порядка
                    probability += weight * contextProb;
                    weightSum += weight;
                }
            }

            // Нормализуем и добавляем сглаживание
            if (weightSum > 0) {
                probability /= weightSum;
                probability = (1 - alpha) * probability + alpha / vocabSize;
            } else {
                probability = 1 / vocabSize;
            }

            probabilities.set(token, probability);
        }

        return this.normalizeProbabilities(probabilities);
    }

    private getConditionalProbability(context: string[], nextToken: string): number {
        let currentNode = this.root;

        // Ищем узел, соответствующий контексту
        for (const token of context) {
            if (!currentNode.children.has(token)) {
                return 0;
            }
            currentNode = currentNode.children.get(token)!;
        }

        // Если контекст найден, вычисляем вероятность
        if (currentNode.children.has(nextToken) && currentNode.total > 0) {
            return currentNode.children.get(nextToken)!.count / currentNode.total;
        }

        return 0;
    }

    private normalizeProbabilities(probabilities: Map<string, number>): Map<string, number> {
        let sum = 0;
        for (const prob of probabilities.values()) {
            sum += prob;
        }

        if (sum === 0) {
            // Равномерное распределение если все вероятности нулевые
            const uniformProb = 1 / probabilities.size;
            for (const token of probabilities.keys()) {
                probabilities.set(token, uniformProb);
            }
        } else {
            // Нормализуем
            for (const [token, prob] of probabilities) {
                probabilities.set(token, prob / sum);
            }
        }

        return probabilities;
    }

    // Вспомогательный метод для получения топ-N предсказаний
    getTopPredictions(context: string[], topN: number = 5): Array<[string, number]> {
        const probabilities = this.predictProbabilities(context);
        return Array.from(probabilities.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, topN);
    }

    // Метод для получения вероятности конкретного токена
    getTokenProbability(context: string[], token: string): number {
        const probabilities = this.predictProbabilities(context);
        return probabilities.get(token) || 0;
    }
}