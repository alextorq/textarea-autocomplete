/**
 * PPM-C Model (Prediction by Partial Matching)
 * Based on words as tokens.
 *
 * Key points:
 * - Maintains contexts up to `order`.
 * - Uses escape mechanism: PPM-C.
 * - Predicts probability distribution for next token.
 */

interface FrequencyDict {
    [token: string]: number;
}

class ContextNode {
    children: Map<string, ContextNode> = new Map();
    frequencies: FrequencyDict = {};

    increment(token: string) {
        this.frequencies[token] = (this.frequencies[token] || 0) + 1;
    }

    totalCount(): number {
        return Object.values(this.frequencies).reduce((a, b) => a + b, 0);
    }
}

export class PPM {
    private root: ContextNode = new ContextNode();
    private order: number;

    constructor(order: number = 4) {
        if (order <= 0) throw new Error("Order must be > 0");
        this.order = order;
    }

    /**
     * Train the PPM model using tokens.
     */
    train(tokens: string[]) {
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const context: string[] = [];

            // For each order level
            for (let k = 1; k <= this.order; k++) {
                const idx = i - k;
                if (idx < 0) break;

                context.unshift(tokens[idx]);
                this.addToContext(context, token);
            }
        }
    }

    private addToContext(context: string[], token: string) {
        let node = this.root;
        for (const word of context) {
            if (!node.children.has(word)) {
                node.children.set(word, new ContextNode());
            }
            node = node.children.get(word)!;
        }
        node.increment(token);
    }

    /**
     * Predict probability distribution for the next token
     * given the input context tokens (last words).
     */
    predict(nextContext: string[]): Map<string, number> {
        const result = new Map<string, number>();
        const seenTokens = new Set<string>();

        // Try contexts from longest to shortest
        for (let k = this.order; k >= 0; k--) {
            const context = nextContext.slice(-k);
            const node = this.getNode(context);

            if (!node) continue;

            const total = node.totalCount();
            const uniqueTokens = Object.keys(node.frequencies).length;

            // Escape probability (PPM-C)
            const escapeProb = uniqueTokens / (total + uniqueTokens);

            // Add probabilities for new unseen tokens at this level
            for (const [token, count] of Object.entries(node.frequencies)) {
                if (seenTokens.has(token)) continue;

                const prob = (count / (total + uniqueTokens)) *
                    (k === this.order ? 1 : this.backoffWeight(k, nextContext));

                result.set(token, (result.get(token) || 0) + prob);
                seenTokens.add(token);
            }

            // Escape accumulates probability to lower order models
            if (escapeProb > 0 && k > 0) {
                result.set("<ESCAPE>",
                    (result.get("<ESCAPE>") || 0) +
                    escapeProb * this.backoffWeight(k, nextContext)
                );
            }
        }

        result.delete("<ESCAPE>");
        return result;
    }

    /**
     * Backoff weighting rule
     * Here: simple normalized fallback (can be replaced by more robust scheme)
     */
    private backoffWeight(k: number, ctx: string[]): number {
        return 1.0; // Simplified: all orders equal weight (but probability balances via escape)
    }

    private getNode(context: string[]): ContextNode | null {
        let node = this.root;
        for (const word of context) {
            const next = node.children.get(word);
            if (!next) return null;
            node = next;
        }
        return node;
    }
}
