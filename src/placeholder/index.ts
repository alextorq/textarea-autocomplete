export class PersistentPlaceholder {
    private readonly textarea: HTMLTextAreaElement;
    private placeholderEl!: HTMLTextAreaElement;
    private wrapper: HTMLDivElement;

    constructor(textarea: HTMLTextAreaElement, wrapper: HTMLDivElement) {
        if (!textarea) {
            throw new Error("Textarea element is required");
        }

        this.textarea = textarea;
        this.wrapper = wrapper;
        this.createPlaceholder('');
        this.copyStyleFromTextarea(this.textarea, this.placeholderEl);
        this.watchTextChangesStyle()
    }


    public copyStyleFromTextarea(source: HTMLTextAreaElement, target: HTMLTextAreaElement): void  {
        const computedStyle = getComputedStyle(source);
        target.style.fontFamily = computedStyle.fontFamily;
        target.style.fontSize = computedStyle.fontSize;
        target.style.padding = computedStyle.padding;
        target.style.boxSizing = computedStyle.boxSizing;
        target.style.lineHeight = computedStyle.lineHeight;
        target.style.textAlign = computedStyle.textAlign;
        target.style.letterSpacing = computedStyle.letterSpacing;
        target.style.wordSpacing = computedStyle.wordSpacing;
        target.style.border = computedStyle.border;
        target.style.width = computedStyle.width;
        target.style.height = computedStyle.height;
        target.style.whiteSpace = computedStyle.whiteSpace;
        target.style.overflowWrap = computedStyle.overflowWrap;
    }

    /**
     * MutationObserver для отслеживания изменений стиля textarea
     */
    private watchTextChangesStyle(): void {
        const observer = new MutationObserver(() => {
            this.copyStyleFromTextarea(this.textarea, this.placeholderEl);
        });

        observer.observe(this.textarea, {
            attributes: true,
            attributeFilter: ['style', 'class']
        });
    }

    /** Создаёт и вставляет кастомный placeholder */
    private createPlaceholder(text: string): void {
        // Создаём placeholder
        const placeholderEl = document.createElement("textarea");
        placeholderEl.value = text;
        placeholderEl.style.position = "absolute";
        placeholderEl.style.top = "0";
        placeholderEl.style.left = "0";
        placeholderEl.style.border = "none";
        placeholderEl.style.background = "transparent";
        placeholderEl.style.color = "gray";
        placeholderEl.style.pointerEvents = "none";
        placeholderEl.style.resize = "none";
        placeholderEl.style.overflow = "hidden";
        placeholderEl.style.zIndex = "0";
        placeholderEl.style.touchAction = "none";
        placeholderEl.style.pointerEvents = "none";
        this.wrapper.appendChild(placeholderEl);
        this.placeholderEl = placeholderEl;
    }

    /** Меняет текст placeholder */
    public setPlaceholder(text: string): void {
        this.placeholderEl.value = text;
    }

    /** Получает текущий текст placeholder */
    public getPlaceholder(): string {
        return this.placeholderEl.value || "";
    }
}
