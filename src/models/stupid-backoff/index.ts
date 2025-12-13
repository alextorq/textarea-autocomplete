import {StupidBackoffModel} from "./model.ts";
import {AdvancedTokenizer} from "./tokenizer.ts";
import {NGramStore} from "./store.ts";

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

export const getStupidBackoffModel = () =>{
    return new StupidBackoffModel(4, new AdvancedTokenizer(), new NGramStore(), new NGramStore()); // Триграммы
};