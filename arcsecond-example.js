const A = require('arcsecond');

const tag = type => value => ({
    type,
    value,
});

const stringParser = A.sequenceOf([
    A.sequenceOf([A.letters, A.digits]).map(tag('letterDigits')),
    A.str('BAKA').map(tag('string')),
    A.many(A.char(' ').map(tag('space'))).map(tag('whitespace')),
    A.str('world').map(tag('string')),
    A.endOfInput.map(tag('EOI')),
]).map(tag('theTree'));

console.dir(stringParser.run('asdf1234BAKA      world'));
