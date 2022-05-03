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

function func3() {
    return new Promise(function(resolve, reject) {
         setTimeout(function() {
            return reject('The operation cancelled by the user');
        },1000);
    });
}
/**
 * 
 * @param {*} promises
 * @returns Promise<Array<*>>
 */
function promiseSequence(sources) {
    return sources.reduce((promise, func) => (
        promise.then((result) => (
             func().then(Array.prototype.concat.bind(result))
        ))
    ), Promise.resolve([]));
}

describe('Promise.sequence', () => {
    it('should execute promise sequence', async() => {
        const results = await promiseSequence([
            () => func1(),
            () => func2()
        ]);
        expect(results).toBeInstanceOf(Array);
        expect(results[0]).toEqual(1);
        expect(results[1]).toEqual(2);

        await expectAsync(promiseSequence([
            () => func1(),
            () => func3()
        ])).toBeRejected();

    });
});
