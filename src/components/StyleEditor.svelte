<script>
    import '../assets/index.scss';
    import { onMount, onDestroy } from "svelte";
    
    import pick from 'lodash.pick';
    import debounce from 'lodash.debounce';
    import { computeContours } from '../util/boxesContour';
    import ColorPicker from './ColorPicker.svelte';
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
        "stroke-width": {type: "slider", min: 0, max: 30, suffix: 'px'},
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

    export let getAdditionalElems = () => [];
    let elementToListen = null;
    let positionAnchor;
    let self;
    let helperElemWrapper;
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
        elementToListen = self.parentNode
        document.body.appendChild(self);
        document.body.appendChild(helperElemWrapper);
        document.body.appendChild(positionAnchor);
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
                    console.log('Style editor: Not able to access', sheets[i].ownerNode, 'sheet. Try CORS loading the sheet if you want to edit it.');
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
        console.log(e.target)
        if (e.target.classList.contains('overlay-over')) return overlayClicked();
        else if (self.contains(e.target)) return;
        selectedElemIndex = 0;
        selectedRuleIndex = 0;
        selectedTypeIndex = 0;
        allTypes = [];
        allRules = [];
        targetsToSearch = [e.target, ...getAdditionalElems(e.target)];
        allTypes = getEditableTypes(targetsToSearch);
        allRules = getMatchedCSSRules(targetsToSearch);
        show(e);
    }

    function overlayClicked() {
        hide();
    }

    function hide() {
        self.style.display = "none";
        helperElemWrapper.style.display = "none";
    }

    function show(e) {
        self.style.display = "block";
        let x = e.pageX + 15, y =  e.pageY + 15;
        console.log(x, y, pageDimensions);
        if (x + 250 > pageDimensions.width) {
            x = pageDimensions.width - 300;
        }
        if (y + 400 > pageDimensions.height) {
            y = pageDimensions.width - 450;
        }
        self.style.left = e.pageX + "px";
        self.style.top = e.pageY + "px";
        // self.style.left = x + "px";
        // self.style.top = y + "px";
        // const x = e.clientX + window.pageXOffset, y = e.clientY + window.pageYOffset;
        // positionAnchor.style.left = x + 'px';
        // positionAnchor.style.top = y + 'px';
        // createPopper(positionAnchor, self, {
        //     placement: 'bottom-start'
        // });
        helperElemWrapper.style.display = "block";
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

    function _updateCssRule(cssPropName, val, suffix, target) {
        const finalValue = suffix ? val + suffix : val;
        if (isInline) {
            const style = currentElement.style; // do not trigger reactivity on currentElement
            style[cssPropName] = finalValue;
        }
        else currentRule.style.setProperty(cssPropName, finalValue);
        if (target && target.nextElementSibling.classList.contains('current-value')) {
            target.nextElementSibling.innerHTML = finalValue;
        }
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

    // type one of: "number", "rgb", "font", "raw"
    function parsePropvalue(value, type="number") {
        if (type=="raw") return value;
        if (type == "number" && value.match(/[0-9]+(px)|(em)|(rem)/)) return parseInt(value);
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
    
</script>

<div bind:this={positionAnchor} style="position: absolute;"> </div>
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
                        {@const propValue = getComputedPropValue(currentElement, renderedDef.name, 'raw') }
                        <input type=range value={parsePropvalue(propValue, 'number')}
                        min={renderedDef.min} 
                        max={renderedDef.max} 
                        on:change={(e) => updateCssRule(renderedDef.name, e.target.value, renderedDef.suffix, e.target)}/>
                        <span class="current-value"> {propValue} </span> 
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
