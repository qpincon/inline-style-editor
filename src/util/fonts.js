// https://stackoverflow.com/a/3368855
function getAvailableFonts() {
    const fontsToCheck = new Set([
        'Arial', 'Arial Black', 'Bahnschrift', 'Calibri', 'Cambria', 'Cambria Math', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Ebrima', 'Franklin Gothic Medium', 'Gabriola', 'Gadugi', 'Georgia', 'HoloLens MDL2 Assets', 'Impact', 'Ink Free', 'Javanese Text', 'Leelawadee UI', 'Lucida Console', 'Lucida Sans Unicode', 'Malgun Gothic', 'Marlett', 'Microsoft Himalaya', 'Microsoft JhengHei', 'Microsoft New Tai Lue', 'Microsoft PhagsPa', 'Microsoft Sans Serif', 'Microsoft Tai Le', 'Microsoft YaHei', 'Microsoft Yi Baiti', 'MingLiU-ExtB', 'Mongolian Baiti', 'MS Gothic', 'MV Boli', 'Myanmar Text', 'Nirmala UI', 'Palatino Linotype', 'Segoe MDL2 Assets', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Historic', 'Segoe UI Emoji', 'Segoe UI Symbol', 'SimSun', 'Sitka', 'Sylfaen', 'Symbol', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings', 'Yu Gothic',
        'American Typewriter', 'Andale Mono', 'Arial', 'Arial Black', 'Arial Narrow', 'Arial Rounded MT Bold', 'Arial Unicode MS', 'Avenir', 'Avenir Next', 'Avenir Next Condensed', 'Baskerville', 'Big Caslon', 'Bodoni 72', 'Bodoni 72 Oldstyle', 'Bodoni 72 Smallcaps', 'Bradley Hand', 'Brush Script MT', 'Chalkboard', 'Chalkboard SE', 'Chalkduster', 'Charter', 'Cochin', 'Comic Sans MS', 'Copperplate', 'Courier', 'Courier New', 'Didot', 'DIN Alternate', 'DIN Condensed', 'Futura', 'Geneva', 'Georgia', 'Gill Sans', 'Helvetica', 'Helvetica Neue', 'Herculanum', 'Hoefler Text', 'Impact', 'Lucida Grande', 'Luminari', 'Marker Felt', 'Menlo', 'Microsoft Sans Serif', 'Monaco', 'Noteworthy', 'Optima', 'Palatino', 'Papyrus', 'Phosphate', 'Rockwell', 'Savoye LET', 'SignPainter', 'Skia', 'Snell Roundhand', 'Tahoma', 'Times', 'Times New Roman', 'Trattatello', 'Trebuchet MS', 'Verdana', 'Zapfino',
        'Comic Sans MS', 'Comic Sans', 'Apple Chancery', 'Bradley Hand', 'Brush Script MT', 'Brush Script Std', 'Snell Roundhand', 'URW Chancery L'
    ].sort());
    const defaultWidth = {};
    const  defaultHeight = {};
    // a font will be compared against all the three default fonts.
    // and if it doesn't match all 3 then that font is not available.
    const baseFonts = ['monospace', 'sans-serif', 'serif', 'cursive'];

    // we use m or w because these two characters take up the maximum width.
    // And we use a LLi so that the same matching fonts can get separated
    const testString = "mmmmmmmmmmlli";

    // we test using 72px font size, we may use any size. I guess larger the better.
    const testSize = '72px';

    const container = document.getElementsByTagName("body")[0];

    // create a SPAN in the document to get the width of the text we use to test
    const spanTester = document.createElement("span");
    spanTester.style.fontSize = testSize;
    spanTester.innerHTML = testString;
    baseFonts.forEach(font => {
        //get the default width for the three base fonts
        spanTester.style.fontFamily = font;
        container.appendChild(spanTester);
        defaultWidth[font] = spanTester.offsetWidth; // width for the default font
        defaultHeight[font] = spanTester.offsetHeight; // height for the default font
        container.removeChild(spanTester);
    });

    const availableFonts = [];

    const fontExists = (fontName) => {
        let detected = false;
        for (const font of baseFonts) {
            spanTester.style.fontFamily = fontName + ',' + font; // name of the font along with the base font for fallback.
            container.appendChild(spanTester);
            const matched = (spanTester.offsetWidth != defaultWidth[font] || spanTester.offsetHeight != defaultHeight[font]);
            container.removeChild(spanTester);
            detected = detected || matched;
        }
        return detected;
    }
    for (const font of fontsToCheck.values()) {
        if (fontExists(font)) {
            availableFonts.push(font);
        }
    }
    return availableFonts.sort();

}

const availableFonts = getAvailableFonts();
function getFonts() {
    return [...listFonts(), ...availableFonts]
}

function listFonts() {
    let { fonts } = document;
    const it = fonts.entries();

    let arr = [];
    let done = false;

    while (!done) {
        const font = it.next();
        if (!font.done) {
            arr.push(font.value[0].family);
        } else {
            done = font.done;
        }
    }

    // converted to set then arr to filter repetitive values
    return [...new Set(arr)];
}


export { getFonts };