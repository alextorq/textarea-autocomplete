// ==========================================
// 2. Tokenizer (Vocabulary Manager)
// ==========================================

export type TokenID = number;

export interface ITokenizer {
    getId(word: string): TokenID;
    getWord(id: TokenID): string;
    tokenize(text: string): TokenID[];
    EOS_ID: TokenID;
    BOS_ID: TokenID;
    UNK_ID: TokenID;
}

/**
 * Класс для управления словарем.
 * В больших системах строки хранятся только один раз. Вся логика работает с числами (Int32),
 * что экономит память и ускоряет хеширование.
 */

// ==========================================
// Advanced Tokenizer for Russian & Multi-language
// ==========================================

/**
 * Конфигурация токенизатора
 */
interface TokenizerConfig  {
    normalizeYo: boolean; // Превращать ли 'ё' в 'е' (стандарт для поиска/автокомплита)
    minWordLength: number; // Игнорировать слишком короткие мусорные токены
}

export class AdvancedTokenizer implements ITokenizer {
    // Двунаправленное отображение (Bi-directional mapping)
    // Используем массив для idToWord для O(1) доступа и меньшего оверхеда памяти по сравнению с Map
    private wordToId: Map<string, TokenID> = new Map();
    private idToWord: string[] = [];

    // Специальные токены
    public static readonly UNK = "<UNK>"; // Unknown word
    public static readonly BOS = "<S>";   // Begin of Sentence
    public static readonly EOS = "</S>";  // End of Sentence

    // ID специальных токенов
    public readonly UNK_ID: TokenID;
    public readonly BOS_ID: TokenID;
    public readonly EOS_ID: TokenID;

    private config: TokenizerConfig;

    constructor(config: Partial<TokenizerConfig> = {}) {
        this.config = {
            normalizeYo: true,
            minWordLength: 1,
            ...config,
        };

        // Инициализация специальных токенов (гарантируем ID 0, 1, 2)
        this.UNK_ID = this.registerToken(AdvancedTokenizer.UNK);
        this.BOS_ID = this.registerToken(AdvancedTokenizer.BOS);
        this.EOS_ID = this.registerToken(AdvancedTokenizer.EOS);
    }

    /**
     * Добавляет слово в словарь, если его там нет.
     * Возвращает ID слова.
     */
    private registerToken(word: string): TokenID {
        if (this.wordToId.has(word)) {
            return this.wordToId.get(word)!;
        }
        const id = this.idToWord.length; // Следующий доступный индекс
        this.wordToId.set(word, id);
        this.idToWord.push(word);
        return id;
    }

    /**
     * Получить ID по слову (или UNK_ID)
     */
    public getId(word: string): TokenID {
        return this.wordToId.get(word) ?? this.UNK_ID;
    }

    /**
     * Получить слово по ID
     */
    public getWord(id: TokenID): string {
        return this.idToWord[id] ?? AdvancedTokenizer.UNK;
    }

    /**
     * Основной метод токенизации текста.
     * Возвращает плоский список ID токенов.
     * * Логика:
     * 1. Вставляет <S> в начале.
     * 2. Разбивает текст на предложения по знакам препинания.
     * 3. Вставляет </S> <S> между предложениями.
     * 4. Заканчивает </S>.
     */
    public tokenize(text: string): TokenID[] {
        const result: TokenID[] = [];

        // Предварительная очистка и нормализация
        const normalizedText = this.preprocessText(text);

        // Разбиваем на предложения (грубая эвристика по . ! ?)
        // Регулярка ищет границы предложений, не удаляя разделители полностью,
        // но в данном случае нам проще сплитить и обрабатывать чанки.
        // Для автокомплита важно сохранять поток, но сбрасывать контекст на точках.

        // Регулярное выражение для поиска слов на Русском, Английском + цифры + дефисы внутри слов
        // \p{L} - любая буква (Unicode Letter)
        // \p{N} - любая цифра
        // Логика: (Буква + (может быть дефис) + Буква) ИЛИ (просто Буквы) ИЛИ (Цифры)
        // Флаг 'u' обязателен для Unicode Property Escapes
        const tokenRegex = /((?:\p{L}[\p{L}-]*\p{L})|\p{L}+|\p{N}+)|([.?!;]+)/gu;

        let match;
        let isSentenceStart = true;

        // Добавляем маркер начала самого первого предложения
        result.push(this.BOS_ID);

        while ((match = tokenRegex.exec(normalizedText)) !== null) {
            const word = match[1]; // Захваченное слово
            const punctuation = match[2]; // Захваченный знак препинания

            if (word) {
                // Если слово слишком короткое (и это не цифра), пропускаем?
                // Обычно для n-gram лучше оставлять даже 1-буквенные (союзы "и", "в").
                if (word.length < this.config.minWordLength) continue;

                result.push(this.registerToken(word));
                isSentenceStart = false;
            }
            else if (punctuation) {
                // Если встретили знак конца предложения и мы не в начале (чтобы не дублировать старт)
                if (!isSentenceStart) {
                    result.push(this.EOS_ID);
                    result.push(this.BOS_ID); // Сразу начинаем контекст нового
                    isSentenceStart = true;
                }
            }
        }

        // Если в конце текста не было знака препинания, закрываем последнее предложение
        if (result[result.length - 1] === this.BOS_ID) {
            // Если текст был пустой или кончился на BOS, убираем лишний BOS
            result.pop();
        } else if (result[result.length - 1] !== this.EOS_ID) {
            result.push(this.EOS_ID);
        }

        return result;
    }

    /**
     * Глубокая очистка строки
     */
    private preprocessText(text: string): string {
        // 1. Unicode Normalization (NFC).
        // Собирает составные символы (й) в один кодпоинт.
        let clean = text.normalize('NFC');

        // 2. Lowercase с учетом локали (важно для русского языка)
        clean = clean.toLocaleLowerCase('ru');

        // 3. Замена "ё" на "е" (опционально, но рекомендуется для поиска)
        if (this.config.normalizeYo) {
            clean = clean.replace(/ё/g, 'е');
        }

        return clean;
    }

    // Метод для дебага: посмотреть размер словаря
    public getVocabSize(): number {
        return this.idToWord.length;
    }
}