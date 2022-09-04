<script>
    import '../assets/index.scss';
    import { onMount, onDestroy } from "svelte";
    
    import pick from 'lodash.pick';
    import debounce from 'lodash.debounce';
    import { computeContours } from '../util/boxesContour';
    import ColorPicker from './ColorPicker.svelte';
    import { getFonts } from '../util/fonts';
    const strokeElements = [ "altGlyph", "circle", "ellipse", "line", "path", "polygon", "polyline", "rect", "text", "textPath", "tref", "tspan",];

    const borderProps = ["border-radius", "border-width", "border-color", "border-style"];
    const backgroundProps = ["background-color"];
    const fontProps = ["font-family", "font-size", "font-weight", "color"];
    const pathProps = ["stroke-width", "stroke", "stroke-dasharray", "fill"];
    const cssPropByType = {
        "border-radius": {type: "slider", min: 0, max: 30, suffix: 'px'},
        "border-width": {type: "slider", min: 0, max: 30, suffix: 'px'},
        "border-style": {type: 'select', choices: () => ["none", "dotted", "dashed", "solid", "double", "groove", "ridge", "inset", "outset",]},
        "border-color": {type: "color"},
        "font-family": { type: 'select', choices: getFontFamilies},
        "font-size": {type: "slider", min: 0, max: 30, suffix: 'px'},
        "font-weight": {type: "slider", min: 0, max: 500},
        "color": {type: "color"},
        "stroke-width": {type: "slider", min: 0, max: 30, suffix: 'px'},
        'stroke': {type: "color"},
        'fill': {type: "color"},
        "stroke-dasharray": {type: "slider", min: 0, max: 30, suffix: 'px'},
        "background-color": {type: "color"},
    };
    const typeText = "text";
    const typeBorder = "border";
    const typeStroke = "stroke";
    const typeBackground = "background";
    const propByType = {
        [typeText]: fontProps,
        [typeBorder]: borderProps,
        [typeStroke]: pathProps,
        [typeBackground]: backgroundProps,
    };

    export let getAdditionalElems = () => [];
    export let listenOnClick = false;
    let elementToListen = null;
    let positionAnchor;
    let self;
    let helperElemWrapper;
    let pathWithHoles = '';
    let pageDimensions = { width: 0, height: 0 };
    let targetsToSearch = [];
    let allRules = []; // list of list of CSS rules, for every target element
    let allTypes = []; // list of list of types (e.g color, border), for every target element
    let selectedElemIndex = 0;
    let selectedRuleIndex = 0;
    let selectedTypeIndex = 0;
    let propsByType; // propType -> {[props], selected} 
    let allCurrentPropDefs = {}; // propName => selectorDef
    let bringableToFront = []; // null = not bringable, true = bringable, false = was bringed
    $: {
        if (elementToListen !== null) {
            init();
        }
    }
    $: currentElement = targetsToSearch[selectedElemIndex];
    $: currentRule = allRules[selectedElemIndex]?.[selectedRuleIndex];
    // $: curType = allTypes[selectedElemIndex]?.[selectedTypeIndex];
    let curType;
    $: {
        if (allTypes[selectedElemIndex]?.[selectedTypeIndex] !== curType) {
            curType = allTypes[selectedElemIndex]?.[selectedTypeIndex];
        };
    }
    $: {
        if (curType && currentRule){
            const _allCurrentPropDefs = pick(cssPropByType, propByType[curType]);
            Object.keys(_allCurrentPropDefs).forEach(key => {
                _allCurrentPropDefs[key].displayed = getComputedPropValue(currentElement, key, 'raw');
                const propSelectType = _allCurrentPropDefs[key].type;
                let retrieveType = 'number';
                if (propSelectType === 'color') retrieveType = 'rgb';
                else if (propSelectType === 'select') retrieveType = 'raw';
                _allCurrentPropDefs[key].value = getComputedPropValue(currentElement, key, retrieveType);
            });
            
            propsByType = Object.entries(_allCurrentPropDefs).reduce((byType, [propName, selectorDef]) => {
                const selectorType = selectorDef.type;
                if (!(selectorType in byType)) byType[selectorType] = {selected: 0, props: [propName]};
                else byType[selectorType].props.push(propName);
                return byType;
            }, {});
            allCurrentPropDefs = _allCurrentPropDefs;
        }
    }
    
    onMount(() => {
        close();
        elementToListen = self.parentNode
        document.body.appendChild(self);
        document.body.appendChild(helperElemWrapper);
        document.body.appendChild(positionAnchor);
        udpatePageDimensions();
        window.addEventListener('resize', udpatePageDimensions);
    });

    onDestroy(() => {
        window.removeEventListener('resize', udpatePageDimensions);
        if(listenOnClick) elementToListen.removeEventListener("click", getTargetsAndRules);
    })

    function getFontFamilies() {
        return getFonts();
    }

    function getRuleNames(rules) {
        if (!rules) return [];
        return rules.map((rule, i) => {
            if (rule === 'inline') return 'inline';
            const cssSelector = rule.selectorText;
            const title = rule.parentStyleSheet.title || `${i}`;
            return `${title}: ${cssSelector}`;
        });
    }

    let warningDisplayed = new Set();
    function getMatchedCSSRules(elems) {
        const sheets = document.styleSheets;
        return elems.reduce((matchedRulesByElem, el) => {
            const matchedRules = ['inline'];
            for (let i in sheets) {
                try {
                    const rules = sheets[i].cssRules;
                    for (let r in rules) {
                        const selectorText = rules[r].selectorText;
                        if (!selectorText || rules[r].selectorText.length > 50)
                        continue; // skip selectors too long
                        if (selectorText.split(',').some(selector => selector === '*'))
                        continue; // skip * selector
                        if (el.matches(selectorText)) {
                            matchedRules.push(rules[r]);
                        }
                    }
                } catch(err) {
                    if (!warningDisplayed.has(i)) {
                        console.log('Style editor: Not able to access', sheets[i].ownerNode, 'sheet. Try CORS loading the sheet if you want to edit it.');
                        warningDisplayed.add(i);
                    }
                } 
            }
            matchedRulesByElem.push(matchedRules);
            return matchedRulesByElem;
        }, []);
    }

    function getEditableTypes(elems) {
        return elems.reduce((typesByElem, elem) => {
            const types = [];
            if (elem.firstChild && elem.firstChild.nodeType === 3) { // Node.TEXT_NODE
                types.push(typeText);
            }
            const elemTagName = elem.tagName.toLowerCase();
            let bringable = false;
            if (strokeElements.includes(elemTagName)) {
                types.push(typeStroke);
                const parentTag = elem.parentElement.tagName.toLowerCase();
                if (parentTag === 'g' && elem.previousElementSibling && elem.previousElementSibling.tagName.toLowerCase() == elemTagName) {
                    bringable = true;
                }
            }
            else {
                types.push(typeBorder);
                types.push(typeBackground);
            }
            if (bringable) bringableToFront.push(true);
            else bringableToFront.push(null);
            typesByElem.push(types)
            return typesByElem;
        }, []);
    }

    function init() {
        if(listenOnClick) elementToListen.addEventListener("click", _open);
    }
    
    function _open(e) {
        open(e.target, e.pageX, e.pageY);
    }

    export function open(el, x, y) {
        if (el.classList.contains('overlay-over')) return overlayClicked();
        else if (self.contains(el)) return;
        selectedElemIndex = 0;
        selectedRuleIndex = 0;
        selectedTypeIndex = 0;
        bringableToFront = [];
        allTypes = [];
        allRules = [];
        targetsToSearch = [el, ...getAdditionalElems(el)];
        allTypes = getEditableTypes(targetsToSearch);
        allRules = getMatchedCSSRules(targetsToSearch);
        if (x && y) show(x, y);
        else {
            const rect = getBoundingBoxInfos(el, 15);
            show(rect.left, rect.top);
        }
    }

    export function close() {
        self.style.display = "none";
        helperElemWrapper.style.display = "none";
    }

    function overlayClicked() {
        close();
    }
   
    function show(x, y) {
        x = (x + 260 > pageDimensions.width) ? pageDimensions.width - 300 : x + 10;
        y = (y + 410 > pageDimensions.height) ? pageDimensions.height - 450 : y + 10;
        self.style.left = x + "px";
        self.style.top = y + "px";
        helperElemWrapper.style.display = "block";
        self.style.display = "block";
    }

    function updateHelpers() {
        if (!currentRule) return;
        let matching;
        if (currentRule === 'inline') matching = [currentElement];
        else {
            const selector = currentRule.selectorText.replace(/(:hover)|:focus/g, '');
            matching = Array.from(document.querySelectorAll(selector));
        }
        const boundingBoxes = matching.map(el => getBoundingBoxInfos(el, 10));
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

    function _updateCssRule(cssPropName, val, suffix) {
        const finalValue = suffix ? val + suffix : val;
        if (currentRule === 'inline') {
            const style = currentElement.style; // do not trigger reactivity on currentElement
            style[cssPropName] = finalValue;
        }
        else currentRule.style.setProperty(cssPropName, finalValue);
        allCurrentPropDefs[cssPropName].value = val;
        allCurrentPropDefs[cssPropName].displayed = finalValue;
        updateHelpers();
    } 
    const updateCssRule = debounce(_updateCssRule, 100);
    
    function udpatePageDimensions(){
        pageDimensions = {width: document.body.scrollWidth, height: document.body.scrollHeight};
    }

    function cssRgbToHex(rgbStr) {
        const m = rgbStr.match(/[0-9\.]+/g).map(i => parseFloat(i));
        if (m.length === 3) m.push(1);
        return m.reduce((hexStr, cur, i) => {
            if (i === 3) hexStr += Math.round(cur * 255).toString(16).padStart(2, '0');
            else hexStr += cur.toString(16).padStart(2, '0');
            return hexStr;
        }, '#');
    }

    // type one of: "number", "rgb", "font", "raw"
    function parsePropvalue(value, type="number") {
        if (type=="raw") return value;
        if (type == "number" && /[0-9]+(px)|(em)|(rem)/.test(value)) return parseInt(value);
        if (type == "rgb" && (value.includes('rgb') || value[0] == "#")) return cssRgbToHex(value);
        return value
    }

    function getComputedPropValue(el, cssProp, type="number") {
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
    }
    
</script>

<div bind:this={positionAnchor} style="position: absolute;"> </div>
<svg bind:this={helperElemWrapper} class="ise-helper-wrapper" 
version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
width={pageDimensions.width} height={pageDimensions.height}
on:click={overlayClicked}>
    <clipPath id="overlay-clip" clip-rule="evenodd">
        <path d={pathWithHoles} />
    </clipPath>
    <rect y="0" x="0" height="100%" width="100%" class="overlay-over" />
</svg>

<div class="ise" bind:this={self}>
    <div class="close-button" on:click={close}>x</div>
    {#if targetsToSearch.length > 1}
    <div class="select-tab">
        <b> Elem </b>
        {#each targetsToSearch as target, elemIndex}
            <span class:selected={selectedElemIndex === elemIndex} on:click={() => {selectedElemIndex = elemIndex; selectedRuleIndex = 0;}}>
                Elem {elemIndex}
            </span>
        {/each}
    </div>
    {/if}
    <div class="select-tab">
        <b> Rule: </b>
        {#each getRuleNames(allRules[selectedElemIndex]) as ruleName, ruleIndex}
            <span title={ruleName}
                class:selected="{selectedRuleIndex === ruleIndex}" 
                on:click="{() => {selectedRuleIndex = ruleIndex;}}"
            >  {ruleName}</span>
        {/each}
    </div>
    <div class="select-tab">
        <b> Property type: </b>
        {#each allTypes[selectedElemIndex] || [] as type, typeIndex}
            <span class:selected="{selectedTypeIndex === typeIndex}" on:click="{() => {selectedTypeIndex = typeIndex;}}"> {type} </span>
        {/each}
    </div>
    {#if allTypes[selectedElemIndex]}
    <div class="editor"> 
        {#each Object.entries(propsByType) as [propType, choices]}
        {@const selectedName = choices.props[choices.selected]}
            <div class="prop-section">
                {#if choices.props.length > 1}
                    <div> <select on:change="{(e) => choices.selected = e.target.value}">
                        {#each choices.props as propName, i}
                            <option selected={i === choices.selected} value="{i}"> {propName} </option>
                        {/each}
                    </select> </div>
                {:else}
                    <span> { selectedName } </span>
                {/if}
                {#if propType === 'slider'}
                    <input type=range value={allCurrentPropDefs[selectedName].value}
                    min={allCurrentPropDefs[selectedName].min} 
                    max={allCurrentPropDefs[selectedName].max} 
                    on:change={(e) => updateCssRule(selectedName, e.target.value, allCurrentPropDefs[selectedName].suffix, e.target)}/>
                    <span class="current-value"> { allCurrentPropDefs[selectedName].displayed } </span> 
                {:else if propType == 'select'}
                    <select on:change={(e) => updateCssRule(selectedName, e.target.value)}>
                        {#each allCurrentPropDefs[selectedName].choices() as choice}
                            <option selected={choice == allCurrentPropDefs[selectedName].value || null}> {choice} </option>
                        {/each}
                    </select>
                {:else if propType == 'color'}
                    <ColorPicker 
                        value={allCurrentPropDefs[selectedName].value}
                        onChange={(color => updateCssRule(selectedName, color))}
                    /> 
                {/if}
            </div>
        {/each}
        {#if currentRule === 'inline' && bringableToFront[selectedElemIndex] !== null}
            <div class="btn" class:active="{bringableToFront[selectedElemIndex] === true}" on:click="{bringToFront}"> 
                Bring to front
            </div>
        {/if}
    </div>
    {/if}
</div>