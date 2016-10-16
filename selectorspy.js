/**
 * Created by fabien.lanoux on 14/10/2016.
 *
 * Module to easily spy on the native selector API or custom librairies wrapping it like jQuery.
 * You specify the replacement selector function by returning it inside the handler argument of the method spy().
 * The handler argument is a function with some optional arguments provided to handle most use cases:
 *   - {Function} (Optional) proxy:
 *       This is a proxy function around the native one you are spying on.
 *       It accepts 2 arguments:
 *          - {Array}|* arguments: the only argument, or array of arguments the native function is expecting
 *          - {Object} (Optional) context: the context the native function should be called against.
 *                                         If not provided, the default is the namespace.
 *   - {Array} (Optional) bypass:
 *        You can push in it objects of the form {{{Object} namespace, {String} fn}}
 *        describing selectors functions that will be ignored during the execution of the spy.
 *        See below examples for a use case.
 *
 *
 * Examples:
 *
 * // elements having a class starting with ".foo" won't ever be returned by document.querySelector
 * SelectorSpy.spy(document, "querySelector", function (proxy) {
 *   return function (selector) {
 *       selector = selector.replace(".foo", "");
 *       return proxy(selector);
 *   };
 * });
 *
 * // queries for "input" elements will return elements with a class of ".foo" instead when using document.querySelectorAll
 * SelectorSpy.spy(document, "querySelectorAll", function (proxy) {
 *   return function (selector) {
 *       selector = selector.replace(/(^| |\()input\b/g, function (match, p1) {
 *          return p1 + ".foo";
 *       });
 *       return proxy(selector);
 *   };
 * });
 *
 * //
 * var toto = document.getElementById("toto");
 * SelectorSpy.spy(toto, "matches", function (proxy) {
 *   return function (selector) {
 *       if (selector.indexOf(".foo")
 *       return proxy(selector);
 *   };
 * });
 *
 * SelectorSpy.spy($.fn, "not", function (proxy) {
 *   return function (selector) {
 *       console.log("do something with selector inside jQuery not");
 *       return proxy(selector, this);
 *   };
 * });
 *
 * SelectorSpy.spy($.fn, "find", function (proxy) {
 *   return function (selector) {
 *       console.log("do something with selector inside jQuery find");
 *       return proxy(selector, this);
 *   };
 * });
 *
 * SelectorSpy.spy($.fn, "filter", function (proxy) {
 *   return function (selector) {
 *       console.log("do something with selector inside jQuery filter");
 *       return proxy(selector, this);
 *   };
 * });
 *
 * SelectorSpy.spy($.fn, "is", function (proxy) {
 *   return function (selector) {
 *       console.log("do something with selector inside jQuery is");
 *       return proxy(selector, this);
 *   };
 * });
 *
 * // Support for intercepting delegation
 * SelectorSpy.spy($, "find", function (proxy) {
 *   var Sizzle = function (selector, context, results) {
 *       console.log("do something with selector inside jQuery internal find");
 *       return proxy([selector, context, results], this);
 *   };
 *
 *   $.extend(Sizzle, $.find);
 *
 *   return Sizzle;
 * });
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

    var global = this;

    var spies = [];

    var disabled = [];

    var SelectorSpy = {
        /**
         * Start spying on a selector query.
         *
         * @param {Object} namespace - the object containing the function to spy on
         * @param {String} fnName - the name of the function to spy on in the namespace
         * @param {Function} handler - function ({Function} proxy, [Array] bypass], see doc
         */
        spy: function (namespace, fnName, handler) {
            var bypassed = [], thespy;

            this.unspy(namespace, fnName);

            thespy = handler(function (args, context) {
                context = context || thespy.namespace;

                if (args instanceof Array === false) {
                    args = [args];
                }

                return thespy.native.apply(context, args);
            }, bypassed);

            bypassed.forEach(function (bypass) {
                if (bypass.namespace === namespace && bypass.fn === fnName) {
                    throw new Error("Impossible to bypass its own selector.");
                }
            });

            thespy.native = namespace[fnName];
            thespy.namespace = namespace;
            thespy.fn = fnName;
            thespy.bypassed = bypassed;

            namespace[fnName] = function () {
                var args = Array.prototype.slice.call(arguments);

                if (spies.some(function (spy) {
                    return spy.bypassed.some(function (bypass) {
                        return spy.namespace === bypass.namespace && spy.fn === bypass.fn;
                    });
                })) {
                    return thespy.native.apply(this, args);
                }

                return thespy.apply(this, args);
            };

            spies.push(thespy);
        },

        /**
         * Retreive the original native function being spied on.
         *
         * @param {Object} namespace - the object containing the function being spied on
         * @param {String} fnName - the name of the function being spied on on in the namespace
         * @returns {Function|null} - the native function
         */
        retreive: function (namespace, fnName) {
            for (var i = 0; i < spies.length; i++) {
                if (spies[i].namespace === namespace && spies[i].fn === fnName) {
                    return spies[i].namespace[fnName];
                }
            }

            return null;
        },

        /**
         * Stop spying on a selector query.
         *
         * @param {Object} namespace - the object containing the function being spied on
         * @param {String} fnName - the name of the function being spied on in the namespace
         * @returns {Function} the removed spy handler
         */
        unspy: function (namespace, fnName) {
            var handler;

            for (var i = 0; i < spies.length; i++) {
                if (spies[i].namespace === namespace && spies[i].fn === fnName) {
                    handler = namespace[fnName];
                    namespace[fnName] = spies[i].native;
                    break;
                }
            }

            if (i !== spies.length) {
                spies.splice(i, 1);
            }
            return handler;
        },

        /**
         * Stop spying on all selector queries.
         */
        unspyAll: function () {
            var fnName;

            for (var i = 0; i < spies.length; i++) {
                fnName = spies[i].fn;
                spies[i].namespace[fnName] = spies[i].native;
            }
            spies = [];
        },


        spyqsa: function (handler) {
            this.spy(document, 'querySelector', function (proxy) {
                return function (selector) {
                    return proxy(handler(selector));
                };
            });
            this.spy(document, 'querySelectorAll', function (proxy) {
                return function (selector) {
                    return proxy(handler(selector));
                };
            });
        },


        spyjQuery: function (handler) {
            ["not", "find", "filter", "is", "find"].forEach(function (name) {
                SelectorSpy.spy(global.jQuery.fn, name, function (proxy) {
                    return function (selector) {
                        return proxy(handler(selector), this);
                    };
                });
            });

            this.spy(global.jQuery, "find", function (proxy) {
                var Sizzle = function (selector, context, results) {
                    return proxy([handler(selector), context, results], this);
                };
                $.extend(Sizzle, window.jQuery.find);

                return Sizzle;
            });
        }
    };

    return SelectorSpy;
}));