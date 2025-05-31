export function pick(obj, keys) {
    return keys.reduce((picked, curKey) => {
        picked[curKey] = obj[curKey];
        return picked;
    }, {});
}

export function debounce(func, wait, immediate = false) {
    let timeout;
    return function () {
        const context = this, args = arguments;
        const later = function () {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

export function capitalizeFirstLetter(str) {
    return str[0].toUpperCase() + str.slice(1);
}

export function pascalCaseToSentence(str) {
    const splitted = str.replace(/-/g, ' ').trim().toLowerCase();
    return capitalizeFirstLetter(splitted);
}


export function nbChars(strArray) {
    if (!strArray) return 0;
    console.log(strArray, strArray.reduce((acc, str) => acc + str.length, 0));
    return strArray.reduce((acc, str) => acc + str.length, 0);
}