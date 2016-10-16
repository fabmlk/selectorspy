/**
 * Created by fabien.lanoux on 14/10/2016.
 *
 * Module to easily spy on the native selector API or custom librairies wrapping it like jQuery.
 * You specify the replacement selector function by returning it inside the handler argument of the method spy().
 * The handler argument is a function with some optional arguments provided to handle most use cases:
 *   - {Function} (Optional) proxy:
 *       This is a proxy function around the native one you are spying on.
 *       It accepts 2 arguments:
 *          - {Array}|{*} arguments: the only argument, or array of arguments, the native function is expecting
 *          - {Object} (Optional) context: the context the native function should be called against.
 *                                         If not provided, the default is the namespace.
 *   - {Array} (Optional) bypass:
 *        You can push in it objects of the form {{{Object} namespace, {String} fn}}
 *        describing other spies that will be ignored during the execution of the spy.
 *        See below examples for a use case.
 *
 * Study: it is common to use a spy to:
 *   1 - modify the selector
 *   2 - call the underlying native method with the modified selector
 * Thus we could provide another spy method for that scenario that would accept a simplified handler like this:
 *   function (selector) {
 *      return /* the modified selector *\/;
 *   }
 * This other spy method would implement the scenario above, just calling the simplified handler to alter the selector
 * before passing it to the native method.
 * The problem with this suggestion is that it lacks the context. What would the context be then ? Should we force it to
 * "namespace[fnName]" or force it to "this" ?
 * => there are no correct default for the context, so this simplified spy method should not exist.
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
 * // matches true whenever .foo is in a selector provided by #toto
 * var toto = document.getElementById("toto");
 * SelectorSpy.spy(toto, "matches", function (proxy) {
 *   return function (selector) {
 *       if (selector.indexOf(".foo") > -1) {
 *         return true;
 *       }
 *       return proxy(selector);
 *   };
 * });
 *
 * // Support for intercepting delegation. This will remove [type='text'] specificity.
 * SelectorSpy.spy($, "find", function (proxy) {
 *   var Sizzle = function (selector, context, results) {
 *       selector = selector.replace("[type='text']", "");
 *       return proxy([selector, context, results], this);
 *   };
 *   $.extend(Sizzle, $.find);
 *
 *   return Sizzle;
 * });
 *
 * Caveat: now that jQuery is setup, what happens when we do:
 *    $("body").on("click", "input", function () { alert("Hey!"); });
 *
 *  1 - $("body") will trigger a call to $.fn.find, which we spy on
 *  2 - the $.fn.find spy calls the native $.fn.find
 *  3 - the native $.fn.find calls $.find, which we spy on
 *  => if we defined the same spy for both $.fn.find and $.find, the handler will be executed twice which might not
 *  be what we expected when calling the native $.fn.find.
 *  To handle this kind of situation and force the native $.fn.find to call the underlying native methods without ever
 *  calling another spy, you can explicitly exclude other spies in the spy definition.
 *  To do so, the handler accepts an array as 2nd argument that you can fill up with {{{Object}namespace, {String}fn}} objects
 *  describing the spies you want to bypass (see spyjQuery() helper method for an example).
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

    /**
     * List of all spies objects. A spy object is a Function with additional properties:
     *   - {Function} native: a reference to the native function it spies on
     *   - {Object} namespace: the namespace of the function it spies on
     *   - {String} fn: the name of the function it spies on
     *   - {Array} bypassed: an array of spy description the spy has to bypass
     * Note: operating on an Array is not
     * @type {Array}
     */
    var spies = [];

    var SelectorSpy = {
        /**
         * Start spying on a selector query.
         *
         * @param {Object} namespace - the object containing the function to spy on
         * @param {String} fnName - the name of the function to spy on in the namespace
         * @param {Function} handler - function ({Function} proxy, [Array] bypass], see doc
         */
        spy: function (namespace, fnName, handler) {
            var bypassed = [], theSpy;

            this.unspy(namespace, fnName);

            // proxy function around the native call
            function proxy(args, context) {
                context = context || theSpy.namespace;

                if (args instanceof Array === false) {
                    args = [args];
                }

                return theSpy.native.apply(context, args);
            }

            // create the spy
            theSpy = handler(proxy, bypassed);

            // check incoherence
            bypassed.forEach(function (bypass) {
                if (bypass.namespace === namespace && bypass.fn === fnName) {
                    throw new Error("Impossible to bypass its own selector.");
                }
            });

            // save original handler in each spy that was marked to bypass this new spy
            spies.forEach(function (spy) {
                for (var i = 0; i < spy.bypassed.length; i++) {
                    if (spy.bypassed[i].namespace === namespace && spy.bypassed[i].fn === fnName) {
                        spy.bypassed[i].handler = handler;
                        break
                    }
                }
            });

            theSpy.native = namespace[fnName];
            theSpy.namespace = namespace;
            theSpy.fn = fnName;
            theSpy.bypassed = bypassed;

            // the actual function that will be called by the selector
            namespace[fnName] = function () {
                var ret, args = Array.prototype.slice.call(arguments);

                bypassed.forEach(function (bypass) {
                    SelectorSpy.unspy(bypass.namespace, bypass.fn);
                });

                ret = theSpy.apply(this, args);

                bypassed.forEach(function (bypass) {
                    SelectorSpy.spy(bypass.namespace, bypass.fn, bypass.handler);
                });

                return ret;
            };

            spies.push(theSpy);
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
         * @returns {Function|null} the removed spy handler or null if not found
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

            return handler || null;
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

        /**
         * Helper method to rapidly spy on QSA (does not spy on .matches)
         * @param {Function} handler
         */
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


        /**
         * Helper method to rapidly spy on jQuery.
         * @param {Function} handler
         */
        spyjQuery: function (handler) {
            ["not", "find", "filter", "is"].forEach(function (name) {
                SelectorSpy.spy(global.jQuery.fn, name, function (proxy, bypassed) {
                    bypassed.push({
                        namespace: global.jQuery.fn,
                        fnName: "find"
                    });
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