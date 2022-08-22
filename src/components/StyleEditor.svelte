<script>
    import RangeSlider from "svelte-range-slider-pips";
    import ColorPicker from './ColorPicker.svelte';
    import { onMount, onDestroy } from "svelte";
    import { pick, debounce } from 'lodash';
    import * as d3 from 'd3-contour';
    import * as d3g from 'd3-geo';
    const strokeElements = [ "altGlyph", "circle", "ellipse", "line", "path", "polygon", "polyline", "rect", "text", "textPath", "tref", "tspan",];

    const borderProps = ["border-radius", "border-width", "border-color", "border-style",];
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
        "stroke-width": {type: "slider", min: 1, max: 30, suffix: 'px'},
        'stroke': {type: "color"},
        'fill': {type: "color"},
        "stroke-dasharray": {type: "slider", min: 0, max: 30, suffix: 'px'},
    };
    const typeText = "text";
    const typeBorder = "border";
    const typeStroke = "stroke";
    const propByType = {
        [typeText]: fontProps,
        [typeBorder]: borderProps,
        [typeStroke]: pathProps,
    };

    export let elementToListen = null;
    export let getAdditionalElems = () => [];
    let self;
    let helperElemWrapper;
    let helperOverlays = [];
    let pathWithHoles = '';
    let pageDimensions = {width: 0, height: 0};
    let targetsToSearch = [];
    let allTypes = []; // list of list of types (e.g color, border), for every target element
    let allRules = []; // list of list of CSS rules, for every target element
    let selectedElemIndex = 0;
    let selectedRuleIndex = 0;
    let selectedTypeIndex = 0;

    let propGroupedByType;
    $: {
        if (elementToListen !== null) {
            init();
        }
    }
    $: currentRule = allRules[selectedElemIndex]?.[selectedRuleIndex];
    $: isInline = selectedRuleIndex === (allRules[selectedElemIndex] || []).length - 1;
    $: curType = allTypes[selectedElemIndex]?.[selectedTypeIndex];
    $: {
        if (currentRule){
            propGroupedByType = groupByValue(pick(cssPropByType, propByType[curType]));
        }
    }
    $: currentElement = targetsToSearch[selectedElemIndex];
    $: {
        updateHelpers(currentRule);
    }

    onMount(() => {
        hide();
        document.body.appendChild(self);
        document.body.appendChild(helperElemWrapper);
        udpatePageDimensions();
        window.addEventListener('resize', udpatePageDimensions);
    });

    onDestroy(() => {
        window.removeEventListener('resize', udpatePageDimensions);
        elementToListen.removeEventListener("click", getTargetsAndRules);
    })

    function getFontFamilies() {
        return ["Arial"];
    }

    // get an object with possible duplicated values, returns groupKey -> [vals]
    function groupByValue(obj, groupKey = 'type') {
        return Object.entries(obj).reduce((acc, [key, val]) => {
            const type = val[groupKey];
            val.name = key;
            if (type in acc) acc[type].push(val);
            else acc[type] = [val];
            return acc;
        }, {});
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

    function getMatchedCSSRules(elems) {
        const sheets = document.styleSheets;
        return elems.reduce((matchedRulesByElem, el) => {
            const matchedRules = [];
            for (let i in sheets) {
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
            }
            matchedRules.push('inline');
            matchedRulesByElem.push(matchedRules);
            return matchedRulesByElem;
        }, []);
    }
    function getStyle(selector) {
        const sheets = document.styleSheets;
        for (let i in sheets) {
            const rules = sheets[i].cssRules;
            for (let r in rules) {
                if (r.selectorText === selector) {
                    console.log(r);
                }
            }
        }
    }

    function getEditableTypes(elems) {
        return elems.reduce((typesByElem, elem) => {
            const types = [];
            if (elem.firstChild && elem.firstChild.nodeType === 3) { // Node.TEXT_NODE
                types.push(typeText);
            }
            if (strokeElements.includes(elem.tagName.toLowerCase())) types.push(typeStroke);
            else types.push(typeBorder);
            typesByElem.push(types)
            return typesByElem;
        }, []);
    }

    function init() {
        elementToListen.addEventListener("click", getTargetsAndRules);
    }
    
    function getTargetsAndRules(e) {
        selectedElemIndex = 0;
        selectedRuleIndex = 0;
        selectedTypeIndex = 0;
        allTypes = [];
        allRules = [];
        targetsToSearch = [e.target, ...getAdditionalElems(e.target)];
        allTypes = getEditableTypes(targetsToSearch);
        allRules = getMatchedCSSRules(targetsToSearch);
        show();
        self.style.display = "block";
        self.style.left = e.pageX + 15 + "px";
        self.style.top = e.pageY + 15 + "px";
    }

    function overlayClicked() {
        hide();
    }

    function hide() {
        self.style.display = "none";
        helperElemWrapper.style.display = "none";
    }

    function show() {
        self.style.display = "block";
        helperElemWrapper.style.display = "block";
    }

    function updateHelpers() {
        if (!currentRule) return;
        let matching;
        if (currentRule === 'inline') matching = [currentElement];
        else {
            const selector = currentRule.selectorText.replace(/(:hover)|:focus/g, '');
            matching = document.querySelectorAll(selector);
        }
        helperOverlays = [];
        for (const el of matching) {
            const rect = getBoundingBoxInfos(el, 10);
            helperOverlays.push(rect);
        }
        computeContours();
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
        if (isInline) {
            const style = currentElement.style; // do not trigger reactivity on currentElement
            style[cssPropName] = finalValue;
        }
        else currentRule.style.setProperty(cssPropName, finalValue);
        updateHelpers();
    } 
    const updateCssRule = debounce(_updateCssRule, 100);
    

    let propTypeToSelectedIndex = {slider: 0, color: 0, select:0};
    function updateChangedCssProp(propType, e) {
        const val = parseInt(e.target.value);
        propTypeToSelectedIndex[propType] = val;
    }
    
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

    // type one of: "number", "rgb", "font"
    function getComputedPropValue(el, cssProp, type="number") {
        let currentStyleValue = currentRule?.style?.[cssProp];
        if (!currentStyleValue) {
            const computed = getComputedStyle(el);
            currentStyleValue = computed[cssProp];
        }
        if (type == "number" && currentStyleValue.match(/[0-9]+px/)) return parseInt(currentStyleValue);
        if (type == "rgb" && (currentStyleValue.includes('rgb') || currentStyleValue[0] == "#")) return cssRgbToHex(currentStyleValue);
        return currentStyleValue
    }
    function pointInBox(p, box) {
        return !(p.x < box.left || p.x > box.right || p.y > box.bottom || p.y < box.top)
    }
    
    function pointInBoxes(point, boxes) {
        for (const box of boxes){
            if (pointInBox(point, box)) return true;
        }
        return false;
    }
    function computeContours() {
        const minX = Math.min(...helperOverlays.map(rect => rect.left));
        const minY = Math.min(...helperOverlays.map(rect => rect.top));
        const offsetBoxes = helperOverlays.map(rect => {
            rect.left = rect.left - minX;
            rect.right = rect.right - minX;
            rect.top = rect.top - minY;
            rect.bottom = rect.bottom - minY;
            return rect;
        });
        offsetBoxes.sort((a, b) => {
            if (a.left > b.left) return 1;
            if (a.left < b.left) return -1;
            return 0;
        });
        const maxX = Math.ceil(Math.max(...offsetBoxes.map(rect => rect.right)));
        const maxY = Math.ceil(Math.max(...offsetBoxes.map(rect => rect.bottom)));
        const downscaleFactor = 10;
        const resX = Math.ceil(maxX / downscaleFactor);
        const resY = Math.ceil(maxY / downscaleFactor);
        const values = new Array(resX * resY); // one coordinate per pixel
        for (let j = 0, k = 0; j < resY; ++j) {
            for (let i = 0; i < resX; ++i, ++k) {
                values[k] = pointInBoxes({x: i * downscaleFactor, y: j * downscaleFactor}, offsetBoxes) ? 1 : 0;
            }
        }
        const contours = d3.contours().size([resX, resY]).thresholds([1])(values);
        const projection = d3g.geoIdentity().fitExtent([[minX, minY], [minX + maxX, minY + maxY]], contours[0]);
        const path = d3g.geoPath().projection(projection);
        const defineRectangleClockWise = (width, height, top = 0, left = 0) => {
            return `M${left} ${top} h${width} v${height} h-${width}z`
        }
        const defineRectangleAntiClockWise = (width, height, top = 0, left = 0) => {
            return `M${left} ${top} v${height} h${width} v-${height}z`
        }
        let _pathWithHoles = defineRectangleAntiClockWise(pageDimensions.width, pageDimensions.height);
        pathWithHoles = `${_pathWithHoles} ${path(contours[0])}`;
    }
</script>

<svg bind:this={helperElemWrapper} class="editor-helper-wrapper" 
version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
width={pageDimensions.width} height={pageDimensions.height}
on:click={overlayClicked}>
    <clipPath id="overlay-clip" clip-rule="evenodd">
        <path d={pathWithHoles} />
    </clipPath>
    <rect y="0" x="0" height="100%" width="100%" class="overlay-over" />
</svg>

<div class="wrapper" bind:this={self}>
    <div class="inner-wrapper">
        <div class="close-button" on:click={hide}>x</div>
        {#if targetsToSearch.length > 1}
        <div class="select-tab">
            <b> Elem </b>
            {#each targetsToSearch as target, elemIndex}
                <span class:selected={selectedElemIndex === elemIndex} on:click={() => {selectedElemIndex = elemIndex;}}> Elem {elemIndex} </span>
            {/each}
        </div>
        {/if}
        <div class="select-tab">
            <b> Rule: </b>
            {#each getRuleNames(allRules[selectedElemIndex]) as ruleName, ruleIndex}
                <span 
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
            {#each Object.entries(propGroupedByType) as [propType, propDefs]}
            {@const renderedDef = propDefs[propTypeToSelectedIndex[propType]] }
                <div class="prop-section">
                <!-- {(console.log(propType, propDefs, propTypeToSelectedIndex), '')} -->
                    
                    {#if propDefs.length > 1}
                        <div> <select on:change="{(e) => updateChangedCssProp(propType, e)}">
                            {#each propDefs as propDef, i}
                                <option value="{i}"> {propDef.name} </option>
                            {/each}
                        </select> </div>
                    {:else}
                        <span> { renderedDef.name } </span>
                    {/if}
                    {#if propType === 'slider'}
                    <!-- {(console.log(renderedDef), '')} -->
                        <RangeSlider min={renderedDef.min} 
                            max={renderedDef.max} 
                            values={[getComputedPropValue(currentElement, renderedDef.name, 'number')]}
                            float 
                            on:change={(e) => updateCssRule(renderedDef.name, e.detail.value, renderedDef.suffix)}/>
                    {:else if propType == 'select'}
                        <select on:change={(e) => updateCssRule(renderedDef.name, e.target.value)}>
                            {#each renderedDef.choices() as choice}
                                <option selected={choice == getComputedPropValue(currentElement, renderedDef.name, 'font') || null}> {choice} </option>
                            {/each}
                        </select>
                    {:else if propType == 'color'}
                        <ColorPicker 
                            value={getComputedPropValue(currentElement, renderedDef.name, 'rgb')}
                            onChange={(color => updateCssRule(renderedDef.name, color))}
                        /> 
                    {/if}
                </div>
            {/each}
        </div>
        {/if}
    </div>
</div>

<style>
    .editor-helper-wrapper {
        z-index: 9999998;
        position: absolute;
        top: 0;
        left: 0;
        pointer-events: none;
    }
    .overlay-over {
        fill: #000000A0;
        clip-path: url(#overlay-clip);
        pointer-events: painted;
    }
    .wrapper {
        font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif;
        font-size: 10px;
        z-index: 9999999;
        position: absolute;
        background-color: #edf2f7;
        max-width: 250px;
        border-radius: 5px;
        box-shadow: 0px 8px 17px 2px rgba(0, 0, 0, 0.487);
    }
    .wrapper .select-tab {
        display: flex;
        align-items: center;
        background-color: #edf2f7;
        padding: 5px 0 5px 0;
        margin: 0 10px 0 10px;
        border-bottom: 1px solid #dee2e6;
    }
    .wrapper .select-tab > span {
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
        min-width: 50px;
        padding: 3px;
        text-align: center;
        color: #718096;
        cursor: pointer;
    }
    .wrapper .select-tab > b {
        margin-right: 5px;
        color: #5d5d5d;
    }
    .inner-wrapper {
        position: relative;
    }
    .editor {
        padding: 5px;
    }
    .editor .prop-section {
        display: flex;
        align-items: center;
        margin: 5px 0;
    }
    .editor .prop-section > span {
        margin: 0 5px;
    }
    .editor .prop-section :first-child {
        color: #5d5d5d;
        font-weight: bold;
    }
    .close-button {
        position: absolute;
        top: -7px;
        right: -7px;
        background-color: #dbdbdb;
        color: #818181;
        width: 15px;
        height: 15px;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        border-radius: 3px;
    }
    :global(.rangeSlider) {
        flex: 1 0 auto;
    }
    .wrapper .select-tab span.selected {
        border-radius: 2px;
        box-shadow: 0 1px 3px 0 rgba(0,0,0,.1),0 1px 2px 0 rgba(0,0,0,.06);
        color: #0069d9;
        background-color: white;
    }

</style>
