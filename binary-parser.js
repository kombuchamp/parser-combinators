const { Parser, updateParserError, updateParserState, sequenceOf, succeed, fail } = require('./index');

const bit = new Parser(parserState => {
    if (parserState.isError) return parserState;

    const byteOffset = Math.floor(parserState.index / 8);

    if (byteOffset >= parserState.target.byteLength) updateParserError(parserState, `bit: unexpected end of input`);

    const byte = parserState.target.getUint8(byteOffset);
    const bit = +!!(byte & (1 << (7 - (parserState.index % 8))));
    return updateParserState(parserState, parserState.index + 1, bit);
});

const bitZero = new Parser(parserState => {
    const resultState = bit.parserStateTransformer(parserState);
    if (resultState.isError || resultState.result !== 0) {
        return updateParserError(
            resultState,
            resultState.error || `zero: Expected 0, but got 1 at index ${resultState.index}`
        );
    }
    return updateParserState(resultState, resultState.index, resultState.result);
});

const bitOne = new Parser(parserState => {
    const resultState = bit.parserStateTransformer(parserState);
    if (resultState.isError || resultState.result !== 1) {
        return updateParserError(
            resultState,
            resultState.error || `zero: Expected 1, but got 0 at index ${resultState.index}`
        );
    }
    return updateParserState(resultState, resultState.index, resultState.result);
});

const uint = n => {
    if (n <= 0) throw TypeError('uint: n must be larger than 0');
    return sequenceOf(...Array(n).fill(bit)).map(bits => {
        return bits.reduce((acc, bit, idx) => {
            return acc + (bit << (n - 1 - idx));
        }, 0);
    });
};

const int = n => {
    if (n <= 0) throw TypeError('int: n must be larger than 0');
    return sequenceOf(...Array(n).fill(bit)).map(bits => {
        if (bits[0] === 0) {
            // positive int
            return bits.reduce((acc, bit, idx) => {
                return acc + (bit << (n - 1 - idx));
            }, 0);
        } else {
            // negative int (make it positive and add minus)
            const posInt = bits.reduce((acc, bit, idx) => {
                bit ^= 1;
                return acc + (bit << (n - 1 - idx));
            }, 0);
            return -(posInt + 1);
        }
    });
};

const rawString = s => {
    if (s.length <= 0) throw TypeError('rawString: s must not be empty');
    const byteParsers = s
        .split('')
        .map(c => c.charCodeAt(0))
        .map(n =>
            uint(8).chain(res => {
                if (res === n) {
                    return succeed(n);
                } else {
                    return fail(
                        `rawString: expected character ${String.fromCharCode(n)}, got ${String.fromCharCode(res)}`
                    );
                }
            })
        );
    return sequenceOf(...byteParsers);
};

const data = new Uint8Array('baka baka'.split('').map(c => c.charCodeAt(0)));
const dataView = new DataView(data.buffer);
const res = rawString('baka baka').run(dataView);

console.log(res);

// We could potentially parse binary headers like this:
const tag = name => value => ({
    name,
    value,
});

// https://en.wikipedia.org/wiki/IPv4#Header
const ipHeaderParser = sequenceOf(
    uint(4).map(tag('Version')),
    uint(4).map(tag('IHL')),
    uint(6).map(tag('DSCP')),
    uint(2).map(tag('ECN')),
    uint(16).map(tag('Total Length')),
    uint(16).map(tag('Identification')),
    uint(3).map(tag('Flags')),
    uint(13).map(tag('Fragment Offset')),
    uint(8).map(tag('TTL')),
    uint(8).map(tag('Protocol')),
    uint(16).map(tag('Header Checksum')),
    uint(32).map(tag('Source IP')),
    uint(32).map(tag('Destination IP'))
);
