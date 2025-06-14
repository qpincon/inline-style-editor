<script>
    import { onMount, onDestroy, tick } from "svelte";

    import "../assets/index.scss";
    import { pick, debounce, pascalCaseToSentence, capitalizeFirstLetter, nbChars } from "../util/util";
    import { computeContours } from "../util/boxesContour";
    import ColorPicker from "./ColorPicker.svelte";
    import { getFonts } from "../util/fonts";

    const strokeElements = [
        "altGlyph",
        "circle",
        "ellipse",
        "line",
        "path",
        "polygon",
        "polyline",
        "rect",
        "text",
        "textPath",
        "tref",
        "tspan",
    ];

    const borderProps = ["border-radius", "border-width", "border-color", "border-style"];
    const backgroundProps = ["background-color"];
    const fontProps = ["font-family", "font-size", "font-weight", "color"];
    const pathProps = ["stroke-width", "stroke", "stroke-dasharray", "stroke-linejoin", "fill"];
    const cssPropByType = {
        "border-radius": { type: "slider", min: 0, max: 30, suffix: "px" },
        "border-width": { type: "slider", min: 0, max: 30, suffix: "px" },
        "border-style": {
            type: "select",
            choices: () => ["none", "dotted", "dashed", "solid", "double", "groove", "ridge", "inset", "outset"],
        },
        "border-color": { type: "color" },
        "font-family": { type: "select", choices: getFontFamilies },
        "font-size": { type: "slider", min: 0, max: 40, suffix: "px" },
        "font-weight": { type: "slider", min: 0, max: 800 },
        color: { type: "color" },
        "stroke-width": {
            type: "slider",
            min: 0,
            max: 20,
            step: 0.5,
            suffix: "px",
        },
        stroke: { type: "color" },
        "stroke-linejoin": {
            type: "select",
            choices: () => ["bevel", "miter", "round"],
        },
        fill: { type: "color" },
        "stroke-dasharray": { type: "slider", min: 0, max: 30, suffix: "px" },
        "background-color": { type: "color" },
    };

    // Props
    const props = $props();
    const getElems = props.getElems ?? null;
    const listenOnClick = props.listenOnClick ?? false;
    const onStyleChanged = props.onStyleChanged ?? (() => {});
    const customProps = props.customProps ?? {};
    const inlineDeletable = props.inlineDeletable ?? (() => true);
    const cssRuleFilter = props.cssRuleFilter ?? null;
    const getCssRuleName =
        props.getCssRuleName ??
        ((cssRuleName, element) => {
            if (cssRuleName === "inline") return "Selected element";
            return cssRuleName;
        });

    const typeText = "text";
    const typeBorder = "border";
    const typeStroke = "stroke";
    const typeBackground = "background";
    const customType = "custom";
    const propByType = {
        [typeText]: fontProps,
        [typeBorder]: borderProps,
        [typeStroke]: pathProps,
        [typeBackground]: backgroundProps,
        [customType]: Object.keys(customProps),
    };
    const inputTypeOrder = { slider: 0, select: 1, color: 2 };

    // State variables
    let elementToListen = $state(null);
    let clickedElement = $state(null);
    let positionAnchor = $state();
    let self = $state();
    let helperElemWrapper = $state();
    let pathWithHoles = $state("");
    let pageDimensions = $state({ width: 0, height: 0 });
    let targetsToSearch = $state([[]]);
    let allRules = $state([]); // list of list of CSS rules, for every target element
    let allTypes = $state([]); // list of list of types (e.g color, border), for every target element
    let selectedElemIndex = $state(0);
    let selectedRuleIndex = $state(0);
    let selectedTypeIndex = $state(0);
    let propsByType = $state(); // propType -> {[props], selected}
    let allCurrentPropDefs = $state({}); // propName => selectorDef
    let bringableToFront = $state([]); // null = not bringable, true = bringable, false = was bringed
    let hasDisplayedCustom = $state(false);

    // Reactive derived values
    const currentElement = $derived(targetsToSearch[selectedElemIndex]?.[0]);
    const currentRule = $derived(allRules[selectedElemIndex]?.[selectedRuleIndex]);
    let curType = $state();

    // Effects
    $effect(() => {
        if (elementToListen !== null) {
            init();
        }
    });

    $effect(() => {
        if (allTypes[selectedElemIndex]?.[selectedTypeIndex] !== curType) {
            curType = allTypes[selectedElemIndex]?.[selectedTypeIndex];
        }
    });

    $effect(() => {
        if (curType || selectedRuleIndex || selectedElemIndex) {
            initAndGroup();
        }
    });

    onMount(() => {
        close();
        elementToListen = self.parentNode;
        document.body.appendChild(self);
        document.body.appendChild(helperElemWrapper);
        document.body.appendChild(positionAnchor);
        udpatePageDimensions();
        // make sure the layout is computed to get the client size
        setTimeout(() => {
            udpatePageDimensions();
        }, 1000);
        window.addEventListener("resize", udpatePageDimensions);
    });

    onDestroy(() => {
        window.removeEventListener("resize", udpatePageDimensions);
        if (listenOnClick) elementToListen.removeEventListener("click", _open);
    });

    function getFontFamilies() {
        return getFonts();
    }

    function initAndGroup() {
        const allProps = { ...cssPropByType, ...customProps };
        const _allCurrentPropDefs = pick(allProps, propByType[curType]);
        Object.keys(_allCurrentPropDefs).forEach((key) => {
            const propSelectType = _allCurrentPropDefs[key].type;
            let retrieveType = "number";
            if (propSelectType === "color") retrieveType = "rgb";
            else if (propSelectType === "select") retrieveType = "raw";
            if (_allCurrentPropDefs[key].getter) {
                const val = _allCurrentPropDefs[key].getter(currentElement);
                if (val === null) {
                    delete _allCurrentPropDefs[key];
                    return;
                }
                _allCurrentPropDefs[key].value = val;
                _allCurrentPropDefs[key].displayed = val;
            } else {
                _allCurrentPropDefs[key].displayed = getComputedPropValue(currentElement, key, "raw");
                _allCurrentPropDefs[key].value = getComputedPropValue(currentElement, key, retrieveType);
            }
        });

        propsByType = Object.entries(_allCurrentPropDefs)
            .reduce((byType, [propName, selectorDef]) => {
                const selectorType = selectorDef.type;
                const existing = byType.find((x) => x.type === selectorType);
                if (!existing)
                    byType.push({
                        selected: 0,
                        props: [propName],
                        type: selectorType,
                    });
                else existing.props.push(propName);
                return byType;
            }, [])
            .sort((a, b) => {
                if (inputTypeOrder[a.type] < inputTypeOrder[b.type]) return -1;
                if (inputTypeOrder[a.type] > inputTypeOrder[b.type]) return 1;
                return 0;
            });
        allCurrentPropDefs = _allCurrentPropDefs;
        updateHelpers();
    }

    function getRuleNames(rules) {
        if (!rules) return [];
        return rules.map((rule, i) => {
            if (rule === "inline") return "inline";
            const cssSelector = rule.selectorText;
            const title = rule.parentStyleSheet.title || `${i}`;
            return `${title}: ${cssSelector}`;
        });
    }

    function getRuleNamesTransformed(rules) {
        return getRuleNames(rules).map((name) => getCssRuleName(name, clickedElement));
    }

    let warningDisplayed = new Set();
    function getMatchedCSSRules(elems) {
        const sheets = document.styleSheets;
        return elems.reduce((matchedRulesByElem, elemDef) => {
            const el = elemDef[0];
            const matchedRules = ["inline"];
            for (let i in sheets) {
                try {
                    const rules = sheets[i].cssRules;
                    for (let r in rules) {
                        let selectorText = rules[r].selectorText;
                        if (!selectorText || rules[r].selectorText.length > 50) continue; // skip selectors too long
                        if (selectorText.split(",").some((selector) => selector === "*")) continue; // skip * selector
                        if (selectorText.endsWith(":hover"))
                            selectorText = selectorText.substring(0, selectorText.length - ":hover".length);
                        if (el.matches(selectorText)) {
                            if (cssRuleFilter !== null && !cssRuleFilter(el, rules[r].selectorText)) continue;
                            matchedRules.push(rules[r]);
                        }
                    }
                } catch (err) {
                    if (!warningDisplayed.has(i)) {
                        console.warn(
                            "Style editor: Not able to access",
                            sheets[i].ownerNode,
                            "sheet. Try CORS loading the sheet if you want to edit it.",
                        );
                        warningDisplayed.add(i);
                    }
                }
            }
            matchedRulesByElem.push(matchedRules);
            return matchedRulesByElem;
        }, []);
    }

    function getEditableTypes(elems) {
        return elems.reduce((typesByElem, elemDef) => {
            const elem = elemDef[0];
            const types = [];
            if (elem.firstChild && (elem.firstChild.nodeType === 3 || elem.firstChild.tagName === "tspan")) {
                // Node.TEXT_NODE
                types.push(typeText);
            }
            const elemTagName = elem.tagName.toLowerCase();
            let bringable = false;
            if (strokeElements.includes(elemTagName)) {
                types.push(typeStroke);
                const parentTag = elem.parentElement.tagName.toLowerCase();
                if (
                    parentTag === "g" &&
                    elem.previousElementSibling &&
                    elem.previousElementSibling.tagName.toLowerCase() == elemTagName
                ) {
                    bringable = true;
                }
            } else {
                types.push(typeBorder);
                types.push(typeBackground);
            }
            if (bringable) bringableToFront.push(true);
            else bringableToFront.push(null);
            typesByElem.push(types);
            return typesByElem;
        }, []);
    }

    function init() {
        if (listenOnClick) elementToListen.addEventListener("click", _open);
    }

    function _open(e) {
        open(e.target, e.pageX, e.pageY);
    }

    export async function open(el, x, y) {
        clickedElement = el;
        udpatePageDimensions();
        if (el.classList.contains("overlay-over")) return overlayClicked();
        else if (self.contains(el)) return;
        selectedElemIndex = 0;
        selectedRuleIndex = 0;
        selectedTypeIndex = 0;
        bringableToFront = [];
        allTypes = [];
        allRules = [];
        if (getElems) targetsToSearch = getElems(el);
        else targetsToSearch = [[el, "Clicked"]];
        allTypes = getEditableTypes(targetsToSearch);
        hasDisplayedCustom = false;
        allRules = getMatchedCSSRules(targetsToSearch);
        for (let def of Object.values(customProps)) {
            if (def.getter(el) !== null) {
                hasDisplayedCustom = true;
                break;
            }
        }
        if (Object.keys(customProps).length) {
            allTypes[0].push(customType);
        }
        await tick();
        initAndGroup();
        if (x && y) show(x, y);
        else {
            const rect = getBoundingBoxInfos(el, 15);
            show(rect.left, rect.top);
        }
    }

    export function close() {
        self.style.display = "none";
        helperElemWrapper.style.display = "none";
        pathWithHoles = "";
    }

    export function isOpened() {
        return self.style.display === "block";
    }

    function overlayClicked() {
        close();
    }

    function show(x, y) {
        self.style.display = "block";
        self.style.opacity = 0;
        const popupDimension = self.getBoundingClientRect();
        x = x + popupDimension.width + 20 > pageDimensions.width ? x - popupDimension.width - 20 : x + 20;
        y = y + popupDimension.height + 20 > pageDimensions.height ? y - popupDimension.height - 20 : y + 20;
        y = Math.max(y, 0);
        self.style.left = x + "px";
        self.style.top = y + "px";
        helperElemWrapper.style.display = "block";
        self.style.opacity = 1;
        updateHelpers();
    }

    async function updateHelpers() {
        await tick();
        if (!currentRule) return;
        let matching;
        if (currentRule === "inline") matching = [currentElement];
        else {
            const selector = currentRule.selectorText.replace(/(:hover)|:focus/g, "");
            matching = Array.from(document.querySelectorAll(selector));
        }
        const boundingBoxes = matching.map((el) => getBoundingBoxInfos(el, 10));
        pathWithHoles = computeContours(boundingBoxes, pageDimensions);
    }

    function getBoundingBoxInfos(el, padding = 0) {
        const rect = el.getBoundingClientRect();
        return {
            left: rect.left + window.scrollX - padding,
            top: rect.top + window.scrollY - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
            right: rect.left + window.scrollX + rect.width + padding,
            bottom: rect.top + window.scrollY + rect.height + padding,
        };
    }

    function _updateProp(propName, val, suffix) {
        const finalValue = suffix ? val + suffix : val;
        if (currentRule === "inline") {
            if (allCurrentPropDefs[propName].setter) {
                allCurrentPropDefs[propName].setter(currentElement, val);
            } else {
                const style = currentElement.style; // do not trigger reactivity on currentElement
                style[propName] = finalValue;
            }
        } else currentRule.style.setProperty(propName, finalValue);
        allCurrentPropDefs[propName].value = val;
        allCurrentPropDefs[propName].displayed = finalValue;

        onStyleChanged(currentElement, currentRule, propName, finalValue);
        updateHelpers();
    }
    const updateProp = debounce(_updateProp, 100);

    function udpatePageDimensions() {
        const bodyStyle = getComputedStyle(document.body);
        const marginLeft = parseInt(bodyStyle.marginLeft);
        const marginRight = parseInt(bodyStyle.marginRight);
        const marginTop = parseInt(bodyStyle.marginTop);
        const marginBottom = parseInt(bodyStyle.marginBottom);
        pageDimensions = {
            width: document.body.offsetWidth + marginLeft + marginRight,
            height: document.body.offsetHeight + marginTop + marginBottom,
        };
    }

    function cssRgbToHex(rgbStr) {
        const m = rgbStr.match(/[0-9\.]+/g).map((i) => parseFloat(i));
        if (m.length === 3) m.push(1);
        return m.reduce((hexStr, cur, i) => {
            if (i === 3)
                hexStr += Math.round(cur * 255)
                    .toString(16)
                    .padStart(2, "0");
            else hexStr += cur.toString(16).padStart(2, "0");
            return hexStr;
        }, "#");
    }

    // type one of: "number", "rgb", "font", "raw"
    function parsePropvalue(value, type = "number") {
        if (type == "raw") return value;
        if (type == "number" && /[0-9]+(px)|(em)|(rem)/.test(value)) return parseInt(value);
        if (type == "rgb") {
            if (value === "none") return "#00000000";
            if (value.includes("rgb") || value[0] == "#") return cssRgbToHex(value);
        }
        return value;
    }

    function getComputedPropValue(el, cssProp, type = "number") {
        let currentStyleValue = currentRule?.style?.[cssProp];
        if (!currentStyleValue) {
            const computed = getComputedStyle(el);
            currentStyleValue = computed[cssProp];
        }
        return parsePropvalue(currentStyleValue, type);
    }

    function bringToFront() {
        bringableToFront[selectedElemIndex] = false;
        currentElement.parentNode.appendChild(currentElement);
        onStyleChanged(currentElement, currentRule, "bringtofront", null);
    }

    function deleteElem() {
        currentElement.remove();
        close();
    }
    function deleteProp(propName) {
        if (currentRule === "inline") {
            currentElement.style.removeProperty(propName);
        } else {
            currentRule.style.removeProperty(propName);
        }
        onStyleChanged(currentElement, currentRule, propName, null);
        initAndGroup();
    }

    function selectRule(ruleIndex) {
        const newRule = allRules[selectedElemIndex]?.[ruleIndex];
        if (newRule !== "inline" && selectedTypeIndex === allTypes[selectedElemIndex].length - 1) {
            selectedTypeIndex = 0;
        }
        selectedRuleIndex = ruleIndex;
    }
</script>

<div bind:this={positionAnchor} style="position: absolute;"></div>
<svg
    bind:this={helperElemWrapper}
    class="ise-helper-wrapper"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    width={pageDimensions.width}
    height={pageDimensions.height}
    onclick={overlayClicked}
>
    <clipPath id="overlay-clip" clip-rule="evenodd">
        <path d={pathWithHoles} />
    </clipPath>
    <rect y="0" x="0" height="100%" width="100%" class="overlay-over" />
</svg>

<div class="ise" bind:this={self}>
    <div class="close-button" onclick={close}>x</div>
    {#if targetsToSearch.length > 1}
        <div class="select-tab">
            <b> Element </b>
            {#each targetsToSearch as [_, name], elemIndex}
                <span
                    class:selected={selectedElemIndex === elemIndex}
                    onclick={() => {
                        selectedElemIndex = elemIndex;
                        selectedRuleIndex = 0;
                    }}
                >
                    {name}
                </span>
            {/each}
        </div>
    {/if}
    <div class="select-tab">
        <b> Applied to: </b>
        {#if nbChars(getRuleNamesTransformed(allRules[selectedElemIndex])) > 30}
            <select onchange={(e) => selectRule(e.target.value)}>
                {#each getRuleNames(allRules[selectedElemIndex]) as ruleName, ruleIndex}
                    <option selected={selectedRuleIndex === ruleIndex} value={ruleIndex}
                        >{getCssRuleName(ruleName, clickedElement)}</option
                    >
                {/each}
            </select>
        {:else}
            {#each getRuleNames(allRules[selectedElemIndex]) as ruleName, ruleIndex}
                <span
                    title={ruleName}
                    class:selected={selectedRuleIndex === ruleIndex}
                    onclick={() => {
                        selectRule(ruleIndex);
                    }}
                >
                    {getCssRuleName(ruleName, clickedElement)}</span
                >
            {/each}
        {/if}
    </div>
    <div class="select-tab">
        <b> Property type: </b>
        {#each allTypes[selectedElemIndex] || [] as type, typeIndex}
            <!-- Only display "custom" on "inline" rule -->
            {#if type !== "custom" || (currentRule === "inline" && type === "custom" && hasDisplayedCustom)}
                <span
                    class:selected={selectedTypeIndex === typeIndex}
                    onclick={() => {
                        selectedTypeIndex = typeIndex;
                    }}
                >
                    {type === "stroke" ? "SVG paint" : capitalizeFirstLetter(type)}
                </span>
            {/if}
        {/each}
    </div>
    {#if allTypes[selectedElemIndex]}
        <div class="editor">
            {#each propsByType as choices}
                {@const selectedName = choices.props[choices.selected]}
                <div class="prop-section {choices.type}">
                    <div class="prop-name">
                        {#if choices.props.length > 1}
                            <select
                                onchange={async (e) => {
                                    choices.selected = e.target.value;
                                    await tick();
                                }}
                            >
                                {#each choices.props as propName, i}
                                    <option selected={i === choices.selected} value={i}>
                                        {#if choices.type === "color"}
                                            {capitalizeFirstLetter(propName)} color
                                        {:else}
                                            {pascalCaseToSentence(propName)}
                                        {/if}
                                    </option>
                                {/each}
                            </select>
                        {:else}
                            <span> {pascalCaseToSentence(selectedName)} </span>
                        {/if}
                        <span class="delete" onclick={() => deleteProp(selectedName)}>✕</span>
                    </div>
                    {#if choices.type === "slider"}
                        <input
                            type="range"
                            min={allCurrentPropDefs[selectedName].min}
                            max={allCurrentPropDefs[selectedName].max}
                            step={allCurrentPropDefs[selectedName].step || 1}
                            value={allCurrentPropDefs[selectedName].value}
                            onchange={(e) =>
                                updateProp(
                                    selectedName,
                                    e.target.value,
                                    allCurrentPropDefs[selectedName].suffix,
                                    e.target,
                                )}
                        />
                        <span class="current-value">
                            {allCurrentPropDefs[selectedName].displayed}
                        </span>
                    {:else if choices.type == "select"}
                        {@const choices = allCurrentPropDefs[selectedName].choices()}
                        <select onchange={(e) => updateProp(selectedName, e.target.value)}>
                            {#if !choices.includes(allCurrentPropDefs[selectedName].value)}
                                <option selected="true"> --- </option>
                            {/if}
                            {#each choices as choice}
                                <option selected={choice == allCurrentPropDefs[selectedName].value || null}>
                                    {choice}
                                </option>
                            {/each}
                        </select>
                    {:else if choices.type == "color"}
                        <ColorPicker
                            value={allCurrentPropDefs[selectedName].value}
                            onChange={(color) => updateProp(selectedName, color)}
                        />
                    {/if}
                </div>
            {/each}
            {#if currentRule === "inline" && bringableToFront[selectedElemIndex] !== null}
                <div class="btn" class:active={bringableToFront[selectedElemIndex] === true} onclick={bringToFront}>
                    Bring to front
                </div>
            {/if}
            {#if currentRule === "inline" && inlineDeletable(currentElement)}
                <div class="btn delete-elem" onclick={deleteElem}>Delete element</div>
            {/if}
        </div>
    {/if}
</div>
