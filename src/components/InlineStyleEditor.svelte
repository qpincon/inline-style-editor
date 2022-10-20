<script>
    import { onMount, onDestroy, tick } from "svelte";

    import '../assets/index.scss';
    import { pick, debounce } from '../util/util';
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
        "font-size": {type: "slider", min: 0, max: 40, suffix: 'px'},
        "font-weight": {type: "slider", min: 0, max: 800},
        "color": {type: "color"},
        "stroke-width": {type: "slider", min: 0, max: 20, step: 0.5, suffix: 'px'},
        'stroke': {type: "color"},
        'fill': {type: "color"},
        "stroke-dasharray": {type: "slider", min: 0, max: 30, suffix: 'px'},
        "background-color": {type: "color"},
    };
    

    export let getAdditionalElems = () => {return []};
    export let listenOnClick = false;
    export let onStyleChanged = () => {};
    export let customProps = {};

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
    let hasDisplayedCustom = false;
    $: {
        if (elementToListen !== null) {
            init();
        }
    }
    $: currentElement = targetsToSearch[selectedElemIndex];
    $: currentRule = allRules[selectedElemIndex]?.[selectedRuleIndex];
    let curType;
    $: {
        if (allTypes[selectedElemIndex]?.[selectedTypeIndex] !== curType) {
            curType = allTypes[selectedElemIndex]?.[selectedTypeIndex];
        };
    }
    $: {
        if (curType || selectedRuleIndex || selectedElemIndex) {
            initAndGroup();
        }
    }
    
    onMount(() => {
        close();
        elementToListen = self.parentNode
        document.body.appendChild(self);
        document.body.appendChild(helperElemWrapper);
        document.body.appendChild(positionAnchor);
        udpatePageDimensions();
        // make sure the layout is computed to get the client size
        setTimeout(() => {
            udpatePageDimensions();
        }, 1000);
        window.addEventListener('resize', udpatePageDimensions);
    });

    onDestroy(() => {
        window.removeEventListener('resize', udpatePageDimensions);
        if(listenOnClick) elementToListen.removeEventListener("click", getTargetsAndRules);
    })

    function getFontFamilies() {
        return getFonts();
    }

    function initAndGroup(){
        const allProps = {...cssPropByType, ...customProps};
        const _allCurrentPropDefs = pick(allProps, propByType[curType]);
        Object.keys(_allCurrentPropDefs).forEach(key => {
            const propSelectType = _allCurrentPropDefs[key].type;
            let retrieveType = 'number';
            if (propSelectType === 'color') retrieveType = 'rgb';
            else if (propSelectType === 'select') retrieveType = 'raw';
            if (_allCurrentPropDefs[key].getter) {
                const val =  _allCurrentPropDefs[key].getter(currentElement);
                if (val === null) {
                    delete _allCurrentPropDefs[key];
                    return; 
                }
                _allCurrentPropDefs[key].value = val;
                _allCurrentPropDefs[key].displayed = val;
            }
            else {
                _allCurrentPropDefs[key].displayed = getComputedPropValue(currentElement, key, 'raw');
                _allCurrentPropDefs[key].value = getComputedPropValue(currentElement, key, retrieveType);
            }
        });
        
        propsByType = Object.entries(_allCurrentPropDefs).reduce((byType, [propName, selectorDef]) => {
            const selectorType = selectorDef.type;
            if (!(selectorType in byType)) byType[selectorType] = {selected: 0, props: [propName]};
            else byType[selectorType].props.push(propName);
            return byType;
        }, {});
        allCurrentPropDefs = _allCurrentPropDefs;
        updateHelpers();
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
                        let selectorText = rules[r].selectorText;
                        if (!selectorText || rules[r].selectorText.length > 50) continue; // skip selectors too long
                        if (selectorText.split(',').some(selector => selector === '*')) continue; // skip * selector
                        if (selectorText.endsWith(':hover')) selectorText = selectorText.substring(0, selectorText.length - ':hover'.length);
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

    export async function open(el, x, y) {
        udpatePageDimensions();
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
        if (x && y) show(x, y);
        else {
            const rect = getBoundingBoxInfos(el, 15);
            show(rect.left, rect.top);
        }
        await tick();
        initAndGroup();
    }

    export function close() {
        self.style.display = "none";
        helperElemWrapper.style.display = "none";
        pathWithHoles = ''
    }

    export function isOpened() {
        return self.style.display === 'block';
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
        updateHelpers();
    }

    async function updateHelpers() {
        await tick();
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

    function _updateProp(propName, val, suffix) {
        const finalValue = suffix ? val + suffix : val;
        if (currentRule === 'inline') {
            if (allCurrentPropDefs[propName].setter) {
                allCurrentPropDefs[propName].setter(currentElement, val);
            }
            else {
                const style = currentElement.style; // do not trigger reactivity on currentElement
                style[propName] = finalValue;
            }
        }
        else currentRule.style.setProperty(propName, finalValue);
        allCurrentPropDefs[propName].value = val;
        allCurrentPropDefs[propName].displayed = finalValue;
        
        onStyleChanged(currentElement, currentRule, propName, finalValue);
        updateHelpers();
    } 
    const updateProp = debounce(_updateProp, 100);
    
    function udpatePageDimensions() {
        const bodyStyle     = getComputedStyle(document.body);
        const marginLeft      = parseInt(bodyStyle.marginLeft);
        const marginRight     = parseInt(bodyStyle.marginRight);
        const marginTop       = parseInt(bodyStyle.marginTop);
        const marginBottom    = parseInt(bodyStyle.marginBottom);
        pageDimensions = {
            width: document.body.offsetWidth + marginLeft + marginRight,
            height: document.body.offsetHeight + marginTop + marginBottom
        };
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
        if (type == "rgb") {
            if (value === "none") return "#00000000";
            if ((value.includes('rgb') || value[0] == "#")) return cssRgbToHex(value);
        } 
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
        onStyleChanged(currentElement, currentRule, 'bringtofront', null);
    }

    function deleteProp(propName) {
        if (currentRule === 'inline') {
            currentElement.style.removeProperty(propName)
        }
        else {
            currentRule.style.removeProperty(propName);
        }
        onStyleChanged(currentElement, currentRule, propName, null);
        initAndGroup();
    }
    
    function selectRule(ruleIndex) {
        const newRule = allRules[selectedElemIndex]?.[ruleIndex];
        if (newRule !== 'inline' && selectedTypeIndex === allTypes[selectedElemIndex].length - 1 ) {
            selectedTypeIndex = 0;
        }
        selectedRuleIndex = ruleIndex;
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
                on:click="{() => { selectRule(ruleIndex); }}"
            >  {ruleName}</span>
        {/each}
    </div>
    <div class="select-tab">
        <b> Property type: </b>
        {#each allTypes[selectedElemIndex] || [] as type, typeIndex}
            <!-- Only display "custom" on "inline" rule -->
            {#if type !== 'custom' || (currentRule === 'inline' && type === 'custom' && hasDisplayedCustom )} 
                <span class:selected="{selectedTypeIndex === typeIndex}" on:click="{() => {selectedTypeIndex = typeIndex;}}"> {type} </span>
            {/if}
        {/each}
    </div>
    {#if allTypes[selectedElemIndex]}
    <div class="editor"> 
        {#each Object.entries(propsByType) as [propType, choices]}
        {@const selectedName = choices.props[choices.selected]}
            <div class="prop-section">
                {#if choices.props.length > 1}
                    <div> <select on:change="{async (e) => {choices.selected = e.target.value; await tick();}}">
                        {#each choices.props as propName, i}
                            <option selected={i === choices.selected} value="{i}"> {propName} </option>
                        {/each}
                    </select> </div>
                {:else}
                    <span> { selectedName } </span>
                {/if}
                <span class="delete" on:click={() => deleteProp(selectedName)}>✕</span>
                {#if propType === 'slider'}
                    <input type=range
                        min={allCurrentPropDefs[selectedName].min} 
                        max={allCurrentPropDefs[selectedName].max}
                        step={allCurrentPropDefs[selectedName].step || 1}
                        value={allCurrentPropDefs[selectedName].value}
                        on:change={(e) => updateProp(selectedName, e.target.value, allCurrentPropDefs[selectedName].suffix, e.target)}
                    />
                    <span class="current-value"> { allCurrentPropDefs[selectedName].displayed } </span> 
                {:else if propType == 'select'}
                    <select on:change={(e) => updateProp(selectedName, e.target.value)}>
                        {#each allCurrentPropDefs[selectedName].choices() as choice}
                            <option selected={choice == allCurrentPropDefs[selectedName].value || null}> {choice} </option>
                        {/each}
                    </select>
                {:else if propType == 'color'}
                    <ColorPicker 
                        value={allCurrentPropDefs[selectedName].value}
                        onChange={(color => updateProp(selectedName, color))}
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
