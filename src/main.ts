import './style.css'
import {Textarea} from "./textarea";
import {PPMModel} from "./PPM";
import {WordTokenizer} from "./tokenizer";
import {getArticlesFromWikipedia} from "./api";


async function main() {
    const textarea = new Textarea(document.querySelector('#app')!)

    const tokenizer = new WordTokenizer({
        keepPunctuation: false,
    })
    const data = await getArticlesFromWikipedia(['Почему одни страны богатые, а другие бедные', 'Великая французская революция']).then((articles) => {
        return Array.from(articles.values()).join('\n\n')
    })

    const tokens = tokenizer.tokenize(data)
    const ppm = new PPMModel(3)
    ppm.train(tokens)

    textarea.onInput((v) => {
        const inputTokens = tokenizer.tokenize(v)
        const suggestions = ppm
            .getTopPredictions(inputTokens, 5)
            .map((_) => _[0])
        textarea.setSuggestions(suggestions)
    })
}


main()