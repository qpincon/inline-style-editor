export default class InlineStyleEditor {
    constructor(options?: InlineStyleEditorOptions);
    close(): void;
    isOpened(): boolean;
    open(target: HTMLElement | SVGElement, x: number, y: number);
}

export interface ColorDefinition {
    type: 'color';
    getter: (el: HTMLElement) => string | null;
    setter: (el: SVGElement, val: string) => void;
}
export interface SelectDefinition {
    type: 'select';
    choices: () => string[]
    getter: (el: HTMLElement) => string | null;
    setter: (el: SVGElement, val: string) => void;
}
export interface SliderDefinition {
    type: "slider";
    min: number;
    max: number;
    step: number;
    getter: (el: HTMLElement) => number | null;
    setter: (el: SVGElement, val: number) => void;
}

export interface InlineStyleEditorOptions {
    onStyleChanged?: (
        target: HTMLElement,
        eventType: "inline" | CSSStyleRule,
        cssProp: string,
        value: string,
    ) => void;
    getElems: (el: HTMLElement) => void;
    customProps: Record<string, ColorDefinition | SelectDefinition | SliderDefinition>;
    cssRuleFilter: (el: HTMLElement, cssSelector: string) => boolean;
    getCssRuleName: (ruleName: string, el: HTMLElement) => string;
    inlineDeletable: (el: HTMLElement) => boolean,
}
