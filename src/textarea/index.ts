import {PersistentPlaceholder} from "../placeholder";

export class Textarea {
    private textarea: HTMLTextAreaElement;
    private textareaPlaceHolder: PersistentPlaceholder;
    private wrapper: HTMLDivElement;
    private suggestionBox!: HTMLDivElement;
    private value: string;
    private lastSuggestion: string;
    private subscribtions: Array<(v: string) => void> = [];

    constructor(wrapper: HTMLElement) {
        this.lastSuggestion = ''
        this.textarea = document.createElement('textarea')
        this.textarea.style.zIndex = '1'
        this.textarea.style.position = 'relative'
        this.textarea.style.backgroundColor = 'transparent'

        this.textarea.rows = 20
        this.textarea.cols = 80

        this.wrapper = document.createElement('div')
        this.wrapper.style.position = 'relative'
        this.wrapper.style.lineHeight = '0';
        this.wrapper.style.fontSize = '0';
        this.value = ''

        this.wrapper.appendChild(this.textarea)
        wrapper.appendChild(this.wrapper)
        this.textareaPlaceHolder = new PersistentPlaceholder(this.textarea, this.wrapper)
        this.init()
    }


    init() {
        this.getElement()
            .addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.code === 'Tab') {
                e.preventDefault();

                if (this.lastSuggestion) {
                    const start = this.textarea.selectionStart;
                    const end = this.textarea.selectionEnd;

                    const padding = this.value[this.value.length - 1] === ' ' ? '' : ' '


                    const value = this.textarea.value.substring(0, start) + padding + this.lastSuggestion + this.textarea.value.substring(end);

                    this.textarea.value = value
                    this.updateValue(value)
                }
            }})

        this.createSuggestionBox()
        this.getElement().addEventListener('input', (e: Event) => {
            this.updateValue((e.target as HTMLTextAreaElement).value)
        })
    }

    public getElement() {
        return this.textarea
    }


    private createSuggestionBox() {
        this.suggestionBox = document.createElement('div')
        this.suggestionBox.style.position = 'absolute'
        this.suggestionBox.style.bottom = '0'
        this.suggestionBox.style.zIndex = '3'
        this.suggestionBox.style.left = '0'
        this.suggestionBox.style.fontSize = '14px'
        this.suggestionBox.style.lineHeight = '1.2'
        this.suggestionBox.style.lineHeight = '1.2'
        this.suggestionBox.style.backgroundColor = 'transparent'
        this.suggestionBox.style.border = '1px solid #ccc'
        this.suggestionBox.style.padding = '5px'
        this.suggestionBox.style.display = 'none' // Скрыт по умолчанию
        this.suggestionBox.style.gap = '10px'
        this.wrapper.appendChild(this.suggestionBox)
        return this.suggestionBox
    }

    public setSuggestions(suggestions: string[]) {
        this.suggestionBox.innerHTML = '' // Очищаем предыдущие предложения

        suggestions.forEach((suggest) => {
            // Добавляем предложения в suggestionBox
            const box = document.createElement('div')
            box.textContent = suggest
            this.suggestionBox.appendChild(box)
        })

        if (suggestions.length) {
            this.suggestionBox.style.display = 'flex' // Скрыт по умолчанию

            const first = suggestions[0]

            this.lastSuggestion = first

            const padding = this.value[this.value.length - 1] === ' ' ? '' : ' '
            this.textareaPlaceHolder.setPlaceholder(this.value + `${padding}${first}`)
        }
    }

    private updateValue(v: string) {
        this.value = v
        this.subscribtions.forEach((cb) => cb(v))
    }

    public onInput(callback: (v: string) => void) {
        this.subscribtions.push(callback)
    }

}