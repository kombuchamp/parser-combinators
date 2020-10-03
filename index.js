const LETTERS_REGEX = /^[A-Za-z]+/;
const DIGITS_REGEX = /^[0-9]+/;

const updateParserState = (state, index, result) => ({
    ...state,
    index,
    result,
});

const updateParserError = (state, error) => ({
    ...state,
    error,
    isError: true,
});

/**
 * Atomic parser
 * Parsers are combined with each other in order to parse complex expressions
 */
class Parser {
    constructor(parserStateTransformer) {
        /**
         * Function that transforms current state of parser into the next one
         * Expected to be pure function
         * @type {function}
         */
        this.parserStateTransformer = parserStateTransformer;
    }

    /**
     * @property target - target string/byte array/whatever to parse
     * @property index - current index in target parser "ponits" at
     * @property result - result of parsing
     * @property isError - wheter there was error in attemt to parse section
     * (means that target does not fit parsing rules)
     * @property error - error info
     */
    static initialState = {
        target: null,
        index: 0,
        result: null,
        isError: false,
        error: null,
    };

    /**
     * Runs the parser on target, returns resulting state.
     * User should call this method on resulting (combined) parser
     * @param {*} target
     */
    run(target) {
        return this.parserStateTransformer({
            ...Parser.initialState,
            target,
        });
    }

    /**
     * Transforms parser into similar one, but with mapping callback applied to the result
     * @param {function} cb
     */
    map(cb) {
        return new Parser(parserState => {
            const nextState = this.parserStateTransformer(parserState);

            if (nextState.isError) return nextState;

            return updateParserState(nextState, nextState.index, cb(nextState.result));
        });
    }

    /**
     * Transform parser into similar one, but with mapping callback applied
     * to error info object
     * @param {function} cb
     */
    errorMap(cb) {
        return new Parser(parserState => {
            const nextState = this.parserStateTransformer(parserState);

            if (!nextState.isError) return nextState;

            return updateParserError(nextState, cb(nextState.error, nextState.index));
        });
    }

    /**
     * Chains current parser with another, so previous parser state comes into new one
     *
     * @param {function} cb - function that takes in result of previous parser and should
     * return next parser
     */
    chain(cb) {
        return new Parser(parserState => {
            const nextState = this.parserStateTransformer(parserState);

            if (nextState.isError) return nextState;

            const nextParser = cb(nextState.result);
            return nextParser.parserStateTransformer(nextState);
        });
    }
}

/**
 * String parser
 * @param {string} s
 */
const str = s =>
    new Parser(parserState => {
        const { target, index = 0, isError } = parserState;

        if (isError) return parserState;

        const slicedTarget = target.slice(index);

        if (slicedTarget.length === 0) return updateParserError(parserState, `str: Unexpected end of input`);

        if (slicedTarget.startsWith(s)) return updateParserState(parserState, index + s.length, s);

        return updateParserError(
            parserState,
            `Expected a string ${s}, but got ${target.slice(index, index + 10)}${target.length > 10 ? '...' : ''}`
        );
    });

/**
 * Letters parser
 */
const letters = new Parser(parserState => {
    const { target, index = 0, isError } = parserState;

    if (isError) return parserState;

    const slicedTarget = target.slice(index);

    if (slicedTarget.length === 0) return updateParserError(parserState, `letters: Unexpected end of input`);

    const regexMatch = slicedTarget.match(LETTERS_REGEX);

    if (regexMatch) return updateParserState(parserState, index + regexMatch[0].length, regexMatch[0]);

    return updateParserError(parserState, `letters: Couldn't match letters at index ${index}`);
});

/**
 * Digits parser
 */
const digits = new Parser(parserState => {
    const { target, index = 0, isError } = parserState;

    if (isError) return parserState;

    const slicedTarget = target.slice(index);

    if (slicedTarget.length === 0) return updateParserError(parserState, `digits: Unexpected end of input`);

    const regexMatch = slicedTarget.match(DIGITS_REGEX);

    if (regexMatch) return updateParserState(parserState, index + regexMatch[0].length, regexMatch[0]);

    return updateParserError(parserState, `digits: Couldn't match digits at index ${index}`);
});

/**
 * Combines provided parsers into a pipe
 * @param  {...Parser} parsers
 */
const sequenceOf = (...parsers) =>
    new Parser(parserState => {
        if (parserState.isError) return parserState;

        const results = [];
        let nextState = parserState;

        parsers.forEach(p => {
            nextState = p.parserStateTransformer(nextState);
            results.push(nextState.result);
        });

        if (nextState.isError) return nextState;

        return updateParserState(nextState, nextState.index, results);
    });

/**
 * Chooses mathcing parser depending on the result
 * @param  {...Parser} parsers
 */
const choice = (...parsers) =>
    new Parser(parserState => {
        if (parserState.isError) return parserState;

        for (let p of parsers) {
            const nextState = p.parserStateTransformer(parserState);
            if (!nextState.isError) return nextState;
        }
        return updateParserError(parserState, `choice: Undable to match any parser at index ${parserState.index}`);
    });

/**
 * Matches zero or more parser-matchable units
 * @param {Parser} parser
 */
const many = parser =>
    new Parser(parserState => {
        if (parserState.isError) return parserState;

        let nextState = parserState;
        const results = [];

        while (true) {
            let testState = parser.parserStateTransformer(nextState);
            if (!testState.isError) {
                nextState = testState;
                results.push(nextState.result);
            } else {
                return updateParserState(nextState, nextState.index, results);
            }
        }
    });

/**
 * Matches one or more parser-matchable units
 * @param {Parser} parser
 */
const manyStrict = parser =>
    new Parser(parserState => {
        const nextState = many(parser).parserStateTransformer(parserState);
        if (!nextState.result.length) {
            return updateParserError(nextState, `manyStrict: coudnt match anything at index ${parserState.index}`);
        }
        return nextState;
    });

/**
 * Creates function that generates a parser that matches values betveen leftParser and rightParser
 * @param {Parser} leftParser
 * @param {Parser} rightParser
 */
const between = (leftParser, rightParser) => contentParser =>
    sequenceOf(leftParser, contentParser, rightParser).map(results => results[1]);

/**
 * Creates a parser that evaluates actual parser on the fly. Allows for recursive declarations
 * @param {function} parserThunk - function that returns parser (to acquire it in runtime)
 */
const lazy = parserThunk =>
    new Parser(parserState => {
        return parserThunk().parserStateTransformer(parserState);
    });

/**
 * Matches values separated by separator
 * @param {Parser} separatorParser
 */
const sepBy = separatorParser => valueParser =>
    new Parser(parserState => {
        if (parserState.isError) return parserState;

        const results = [];
        let nextState = parserState;

        while (true) {
            const valueState = valueParser.parserStateTransformer(nextState);

            if (valueState.isError) break;

            nextState = valueState;
            results.push(nextState.result);

            const separatorState = separatorParser.parserStateTransformer(nextState);

            if (separatorState.isError) break;

            nextState = separatorState;
        }

        return updateParserState(nextState, nextState.index, results);
    });

/**
 * Parser that always fails with error message
 * @param {stirng} errMsg
 */
const fail = errMsg =>
    new Parser(parserState => {
        return updateParserError(parserState, errorMsg);
    });
/**
 * Parser taht always succeeds with provided result
 * @param {*} value
 */
const succeed = value =>
    new Parser(parserState => {
        return updateParserState(parserState, parserState.index, value);
    });

module.exports = {
    str,
    letters,
    digits,
    sequenceOf,
    choice,
    many,
    manyStrict,
    between,
    lazy,
    sepBy,
    fail,
    succeed,

    Parser,

    updateParserState,
    updateParserError,
};
