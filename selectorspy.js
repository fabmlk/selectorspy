/**
 * Created by fabien.lanoux on 14/10/2016.
 */

(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node/CommonJS
        module.exports = factory();
    } else {
        // Browser globals
        root.SelectorSpy = factory();
    }
}(this, function () {

    var selectorAPI = [];


    function proxy(namespace, fnName) {
        var native = namespace[fnName];

        return function (args, context) {
            context = context || namespace;

            if (args instanceof Array) {
                return native.apply(context, args);
            }

            return native.call(context, args);
        };
    }

    return {
        /**
         * Start spying on a selector query.
         *
         * @param {Object} namespace - the object containing the function to spy on
         * @param {String} fnName - the name of the function to spy on in the namespace
         * @param {Function} handler - the function replacing the native one
         */
        spy: function (namespace, fnName, handler) {
            this.unspy(namespace, fnName);

            selectorAPI.push({
                native: namespace[fnName],
                namespace: namespace,
                fn: fnName
            });

            namespace[fnName] = handler(proxy(namespace, fnName));
        },

        /**
         * Retreive the original native function being spied on.
         *
         * @param {Object} namespace - the object containing the function being spied on
         * @param {String} fnName - the name of the function being spied on on in the namespace
         * @returns {Function|null} - the native function
         */
        retreive: function (namespace, fnName) {
            for (var i = 0; i < selectorAPI.length; i++) {
                if (selectorAPI[i].namespace === namespace && selectorAPI[i].fn === fnName) {
                    return selectorAPI[i].native;
                }
            }
            return null;
        },

        /**
         * Stop spying on a selector query.
         *
         * @param {Object} namespace - the object containing the function being spied on
         * @param {String} fnName - the name of the function being spied on in the namespace
         */
        unspy: function (namespace, fnName) {
            for (var i = 0; i < selectorAPI.length; i++) {
                if (selectorAPI[i].namespace === namespace && selectorAPI[i].fn === fnName) {
                    namespace[fnName] = selectorAPI[i].native;
                    break;
                }
            }

            if (i !== selectorAPI.length) {
                selectorAPI.splice(i, 1);
            }
        },

        /**
         * Stop spying on all selector queries.
         */
        unspyAll: function () {
            var fnName;

            for (var i = 0; i < selectorAPI.length; i++) {
                fnName = selectorAPI[i].fn;
                selectorAPI[i].namespace[fnName] = selectorAPI[i].native;
            }
            selectorAPI = [];
        }
    }
}));

/*

Examples doing nothing, just calling back the native method:

SelectorSpy.spy(document, "querySelector", function (native) {
    return function (selector) {
        console.log("do something with selector inside querySelector");
        return native(selector);
    };
});

SelectorSpy.spy(document, "querySelectorAll", function (native) {
    return function (selector) {
        console.log("do something with selector inside querySelectorAll");
        return native(selector);
    };
});

var toto = document.getElementById("toto");

SelectorSpy.spy(toto, "matches", function (native) {
    return function (selector) {
        console.log("do something with selector inside matches");
        return native(selector);
    };
});

SelectorSpy.spy($.fn, "not", function (native) {
    return function (selector) {
        console.log("do something with selector inside jQuery not");
        return native(selector, this);
    };
});

SelectorSpy.spy($.fn, "find", function (native) {
    return function (selector) {
        console.log("do something with selector inside jQuery find");
        return native(selector, this);
    };
});

SelectorSpy.spy($.fn, "filter", function (native) {
    return function (selector) {
        console.log("do something with selector inside jQuery filter");
        return native(selector, this);
    };
});

SelectorSpy.spy($.fn, "is", function (native) {
    return function (selector) {
        console.log("do something with selector inside jQuery is");
        return native(selector, this);
    };
});

// Support for intercepting delegation
SelectorSpy.spy($, "find", function (native) {
    var Sizzle = function (selector, context, results) {
        console.log("do something with selector inside jQuery internal find");
        return native([selector, context, results], this);
    };

    $.extend(Sizzle, $.find);

    return Sizzle;
});



SelectorSpy.unspy($.fn, "find");
SelectorSpy.unspy($.fn, "not");

var theOriginal = SelectorSpy.retreive(document, "querySelector");
...


*/