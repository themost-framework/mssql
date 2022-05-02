function func1() {
    return new Promise(function(resolve) {
        setTimeout(function() {
            return resolve(1);
        },1500);
    });
}

function func2() {
    return new Promise(function(resolve) {
         setTimeout(function() {
            return resolve(2);
        },500);
    });
}
/**
 * 
 * @param {*} promises
 * @returns Promise<Array<*>>
 */
function PromiseSequence(sources) {
    return sources.reduce((promise, func) => (
        promise.then((result) => (
             func().then(Array.prototype.concat.bind(result))
        ))
    ), Promise.resolve([]));
}

describe('Promise.sequence', () => {
    it('should execute promise sequence', async() => {
        const results = await PromiseSequence([
            () => func1(),
            () => func2()
        ]);
        expect(results).toBeInstanceOf(Array);
        expect(results[0]).toEqual(1);
        expect(results[1]).toEqual(2);
    });
});
