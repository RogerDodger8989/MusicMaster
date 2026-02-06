const mm = require('music-metadata');
console.log('--- MM Exports ---');
console.log(Object.keys(mm));
console.log('parseFile:', typeof mm.parseFile);
if (mm.default) {
    console.log('--- Default Export ---');
    console.log(Object.keys(mm.default));
    console.log('parseFile on default:', typeof mm.default.parseFile);
}
