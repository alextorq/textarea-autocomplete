export interface IAutoCompleter {
    train(text: string): void;
    predict(context: string, topK?: number): Suggestion[];
}

export interface Suggestion {
    word: string;
    score: number;
}