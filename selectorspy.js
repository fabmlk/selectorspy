/**
 * Created by fabien.lanoux on 14/10/2016.
 */

(function (factory) {
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

    function querySelector(selector, native, otherArgs) {
        return native.apply(this, [selector].concat(otherArgs || []));
    }

    function querySelectorProxy(namespace, fnName) {
        var native = namespace[fnName];

        return function (selector, context, otherArgs) {
            context = context || namespace;
            return querySelector.call(context, selector, native, otherArgs);
        };
    }

    return {
        impersonateSelector: function (namespace, fnName, handler) {
            for (var found = false, i = 0; i < selectorAPI.length && found === false; i++) {
                if (selectorAPI[i].namespace === namespace && selectorAPI[i].fnName === fnName) {
                    found = true;
                }
            }
            if (found === false) {
                selectorAPI.push({
                    namespace: namespace,
                    fn: fnName
                });
            }
            namespace[fnName] = handler(querySelectorProxy(namespace, fnName));
        }
    }
}));

/*
Examples:

impersonateSelector(document, "querySelector", function (querySelector) {
    return function (selector) {
        return querySelector(selector);
    };
});

 impersonateSelector(document, "querySelectorAll", function (querySelector) {
    return function (selector) {
        return querySelector(selector);
    };
});

 var toto = document.getElementById("toto");

 impersonateSelector(toto, "matches", function (querySelector) {
    return function (selector) {
        return querySelector(selector);
    };
});

 impersonateSelector($.fn, "not", function (querySelector) {
    return function (selector) {
        return querySelector(selector, this);
    };
});

 impersonateSelector($.fn, "find", function (querySelector) {
    return function (selector) {
        return querySelector(selector, this);
    };
});

 impersonateSelector($.fn, "filter", function (querySelector) {
    return function (selector) {
        return querySelector(selector, this);
    };
});

 impersonateSelector($.fn, "is", function (querySelector) {
    return function (selector) {
        return querySelector(selector, this);
    };
});

 impersonateSelector($, "find", function (querySelector) {
    var Sizzle = function (selector, context, results) {
        return querySelector(selector, context, [context, results]);
    };

    $.extend(Sizzle, $.find);

    return Sizzle;
});
 */