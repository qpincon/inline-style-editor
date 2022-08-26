
import parsePath from 'parse-svg-path';

export function simplifyLinesPath(path) {
    const parsed = parsePath(path).map(values => values.map((v, i) => {
        if (i > 0) return Math.round(v);
        return v;
    }));
    const simplifiedPath = [];
    for (let i = 0; i < parsed.length - 1; ++i) {
        const current = parsed[i];
        let next = parsed[i + 1];
        simplifiedPath.push(current);
        let sameX = current[1] === next[1];
        let sameY = current[2] === next[2];
        if (sameX) {
            while(sameX) {
                i += 1;
                next = parsed[i + 1];
                sameX = next[0] === "L" && current[1] === next[1];
            }
            i -= 1;
        }
        if (sameY) {
            while(sameY) {
                i += 1;
                next = parsed[i + 1];
                sameY = next[0] === "L" && current[2] === next[2];
            }
            i -= 1;
        }
    }
    simplifiedPath.push(parsed[parsed.length - 1]);
    return instructionsToPath(simplifiedPath);
}

function instructionsToPath(data) {
    let str = '';
    data.forEach(ins => {
        for (let i = 0; i < ins.length; ++i) {
            let val = ins[i];
            if (i > 0) val = Math.round(val);
            str += val + (i === ins.length - 1 ? '' : ' ');
        }
    });
    return str;
}