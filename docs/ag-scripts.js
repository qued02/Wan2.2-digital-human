
(function () {
    try {
        (function setConstant(source, args) {
            var flag = "done";
            var uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
            if (source.uniqueId) {
                if (Window.prototype.toString[uniqueIdentifier] === flag) {
                    return;
                }
            }
            function setConstant(source, property, value) {
                var stack = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : "";
                var valueWrapper = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : "";
                var setProxyTrap = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : false;
                var uboAliases = ["set-constant.js", "ubo-set-constant.js", "set.js", "ubo-set.js", "ubo-set-constant", "ubo-set"];
                if (uboAliases.includes(source.name)) {
                    if (stack.length !== 1 && !getNumberFromString(stack)) {
                        valueWrapper = stack;
                    }
                    stack = undefined;
                }
                if (!property || !matchStackTrace(stack, (new Error).stack)) {
                    return;
                }
                var isProxyTrapSet = false;
                var emptyArr = noopArray();
                var emptyObj = noopObject();
                var constantValue;
                if (value === "undefined") {
                    constantValue = undefined;
                } else if (value === "false") {
                    constantValue = false;
                } else if (value === "true") {
                    constantValue = true;
                } else if (value === "null") {
                    constantValue = null;
                } else if (value === "emptyArr") {
                    constantValue = emptyArr;
                } else if (value === "emptyObj") {
                    constantValue = emptyObj;
                } else if (value === "noopFunc") {
                    constantValue = noopFunc;
                } else if (value === "noopCallbackFunc") {
                    constantValue = noopCallbackFunc;
                } else if (value === "trueFunc") {
                    constantValue = trueFunc;
                } else if (value === "falseFunc") {
                    constantValue = falseFunc;
                } else if (value === "throwFunc") {
                    constantValue = throwFunc;
                } else if (value === "noopPromiseResolve") {
                    constantValue = noopPromiseResolve;
                } else if (value === "noopPromiseReject") {
                    constantValue = noopPromiseReject;
                } else if (/^\d+$/.test(value)) {
                    constantValue = parseFloat(value);
                    if (nativeIsNaN(constantValue)) {
                        return;
                    }
                    if (Math.abs(constantValue) > 32767) {
                        return;
                    }
                } else if (value === "-1") {
                    constantValue = -1;
                } else if (value === "") {
                    constantValue = "";
                } else if (value === "yes") {
                    constantValue = "yes";
                } else if (value === "no") {
                    constantValue = "no";
                } else {
                    return;
                }
                var valueWrapperNames = ["asFunction", "asCallback", "asResolved", "asRejected"];
                if (valueWrapperNames.includes(valueWrapper)) {
                    var valueWrappersMap = {
                        asFunction(v) {
                            return function () {
                                return v;
                            };
                        },
                        asCallback(v) {
                            return function () {
                                return function () {
                                    return v;
                                };
                            };
                        },
                        asResolved(v) {
                            return Promise.resolve(v);
                        },
                        asRejected(v) {
                            return Promise.reject(v);
                        }
                    };
                    constantValue = valueWrappersMap[valueWrapper](constantValue);
                }
                var canceled = false;
                var mustCancel = function mustCancel(value) {
                    if (canceled) {
                        return canceled;
                    }
                    canceled = value !== undefined && constantValue !== undefined && typeof value !== typeof constantValue && value !== null;
                    return canceled;
                };
                var trapProp = function trapProp(base, prop, configurable, handler) {
                    if (!handler.init(base[prop])) {
                        return false;
                    }
                    var origDescriptor = Object.getOwnPropertyDescriptor(base, prop);
                    var prevSetter;
                    if (origDescriptor instanceof Object) {
                        if (!origDescriptor.configurable) {
                            var message = `Property '${prop}' is not configurable`;
                            logMessage(source, message);
                            return false;
                        }
                        if (base[prop]) {
                            base[prop] = constantValue;
                        }
                        if (origDescriptor.set instanceof Function) {
                            prevSetter = origDescriptor.set;
                        }
                    }
                    Object.defineProperty(base, prop, {
                        configurable: configurable,
                        get() {
                            return handler.get();
                        },
                        set(a) {
                            if (prevSetter !== undefined) {
                                prevSetter(a);
                            }
                            if (a instanceof Object) {
                                var propertiesToCheck = property.split(".").slice(1);
                                if (setProxyTrap && !isProxyTrapSet) {
                                    isProxyTrapSet = true;
                                    a = new Proxy(a, {
                                        get: function get(target, propertyKey, val) {
                                            propertiesToCheck.reduce((function (object, currentProp, index, array) {
                                                var currentObj = object === null || object === void 0 ? void 0 : object[currentProp];
                                                if (index === array.length - 1 && currentObj !== constantValue) {
                                                    object[currentProp] = constantValue;
                                                }
                                                return currentObj || object;
                                            }), target);
                                            return Reflect.get(target, propertyKey, val);
                                        }
                                    });
                                }
                            }
                            handler.set(a);
                        }
                    });
                    return true;
                };
                var _setChainPropAccess = function setChainPropAccess(owner, property) {
                    var chainInfo = getPropertyInChain(owner, property);
                    var { base: base } = chainInfo;
                    var { prop: prop, chain: chain } = chainInfo;
                    var inChainPropHandler = {
                        factValue: undefined,
                        init(a) {
                            this.factValue = a;
                            return true;
                        },
                        get() {
                            return this.factValue;
                        },
                        set(a) {
                            if (this.factValue === a) {
                                return;
                            }
                            this.factValue = a;
                            if (a instanceof Object) {
                                _setChainPropAccess(a, chain);
                            }
                        }
                    };
                    var endPropHandler = {
                        init(a) {
                            if (mustCancel(a)) {
                                return false;
                            }
                            return true;
                        },
                        get() {
                            return constantValue;
                        },
                        set(a) {
                            if (!mustCancel(a)) {
                                return;
                            }
                            constantValue = a;
                        }
                    };
                    if (!chain) {
                        var isTrapped = trapProp(base, prop, false, endPropHandler);
                        if (isTrapped) {
                            hit(source);
                        }
                        return;
                    }
                    if (base !== undefined && base[prop] === null) {
                        trapProp(base, prop, true, inChainPropHandler);
                        return;
                    }
                    if ((base instanceof Object || typeof base === "object") && isEmptyObject(base)) {
                        trapProp(base, prop, true, inChainPropHandler);
                    }
                    var propValue = owner[prop];
                    if (propValue instanceof Object || typeof propValue === "object" && propValue !== null) {
                        _setChainPropAccess(propValue, chain);
                    }
                    trapProp(base, prop, true, inChainPropHandler);
                };
                _setChainPropAccess(window, property);
            }
            function hit(e) {
                if (e.verbose) {
                    try {
                        var n = console.trace.bind(console), i = "[AdGuard] ";
                        "corelibs" === e.engine ? i += e.ruleText : (e.domainName && (i += `${e.domainName}`),
                            e.args ? i += `#%#//scriptlet('${e.name}', '${e.args.join("', '")}')` : i += `#%#//scriptlet('${e.name}')`),
                            n && n(i);
                    } catch (e) { }
                    "function" == typeof window.__debug && window.__debug(e);
                }
            }
            function logMessage(e, o) {
                var n = arguments.length > 2 && void 0 !== arguments[2] && arguments[2], g = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3], { name: l, verbose: v } = e;
                if (n || v) {
                    var a = console.log;
                    g ? a(`${l}: ${o}`) : a(`${l}:`, o);
                }
            }
            function getNumberFromString(n) {
                var r = parseInt(n, 10);
                return nativeIsNaN(r) ? null : r;
            }
            function noopArray() {
                return [];
            }
            function noopObject() {
                return {};
            }
            function noopFunc() { }
            function noopCallbackFunc() {
                return noopFunc;
            }
            function trueFunc() {
                return true;
            }
            function falseFunc() {
                return false;
            }
            function throwFunc() {
                throw new Error;
            }
            function noopPromiseReject() {
                return Promise.reject();
            }
            function noopPromiseResolve() {
                var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "{}", t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "", s = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "basic";
                if ("undefined" != typeof Response) {
                    var n = new Response(e, {
                        headers: {
                            "Content-Length": `${e.length}`
                        },
                        status: 200,
                        statusText: "OK"
                    });
                    return "opaque" === s ? Object.defineProperties(n, {
                        body: {
                            value: null
                        },
                        status: {
                            value: 0
                        },
                        ok: {
                            value: false
                        },
                        statusText: {
                            value: ""
                        },
                        url: {
                            value: ""
                        },
                        type: {
                            value: s
                        }
                    }) : Object.defineProperties(n, {
                        url: {
                            value: t
                        },
                        type: {
                            value: s
                        }
                    }), Promise.resolve(n);
                }
            }
            function getPropertyInChain(e, r) {
                var n = r.indexOf(".");
                if (-1 === n) return {
                    base: e,
                    prop: r
                };
                var i = r.slice(0, n);
                if (null === e) return {
                    base: e,
                    prop: i,
                    chain: r
                };
                var t = e[i];
                return r = r.slice(n + 1), (e instanceof Object || "object" == typeof e) && isEmptyObject(e) || null === t ? {
                    base: e,
                    prop: i,
                    chain: r
                } : void 0 !== t ? getPropertyInChain(t, r) : (Object.defineProperty(e, i, {
                    configurable: true
                }), {
                    base: e,
                    prop: i,
                    chain: r
                });
            }
            function matchStackTrace(e, t) {
                if (!e || "" === e) return true;
                var r = backupRegExpValues();
                if (shouldAbortInlineOrInjectedScript(e, t)) return r.length && r[0] !== RegExp.$1 && restoreRegExpValues(r),
                    true;
                var n = toRegExp(e), a = t.split("\n").slice(2).map((function (e) {
                    return e.trim();
                })).join("\n");
                return r.length && r[0] !== RegExp.$1 && restoreRegExpValues(r), getNativeRegexpTest().call(n, a);
            }
            function nativeIsNaN(N) {
                return (Number.isNaN || window.isNaN)(N);
            }
            function isEmptyObject(t) {
                return 0 === Object.keys(t).length && !t.prototype;
            }
            function shouldAbortInlineOrInjectedScript(t, i) {
                var r = "inlineScript", n = "injectedScript", isInlineScript = function isInlineScript(t) {
                    return t.includes(r);
                }, isInjectedScript = function isInjectedScript(t) {
                    return t.includes(n);
                };
                if (!isInlineScript(t) && !isInjectedScript(t)) return false;
                var e = window.location.href, s = e.indexOf("#");
                -1 !== s && (e = e.slice(0, s));
                var c = i.split("\n").slice(2).map((function (t) {
                    return t.trim();
                })).map((function (t) {
                    var i, s = /(.*?@)?(\S+)(:\d+)(:\d+)\)?$/.exec(t);
                    if (s) {
                        var c, l, a = s[2], u = s[3], o = s[4];
                        if (null !== (c = a) && void 0 !== c && c.startsWith("(") && (a = a.slice(1)), null !== (l = a) && void 0 !== l && l.startsWith("<anonymous>")) {
                            var d;
                            a = n;
                            var f = void 0 !== s[1] ? s[1].slice(0, -1) : t.slice(0, s.index).trim();
                            null !== (d = f) && void 0 !== d && d.startsWith("at") && (f = f.slice(2).trim()),
                                i = `${f} ${a}${u}${o}`.trim();
                        } else i = a === e ? `${r}${u}${o}`.trim() : `${a}${u}${o}`.trim();
                    } else i = t;
                    return i;
                }));
                if (c) for (var l = 0; l < c.length; l += 1) {
                    if (isInlineScript(t) && c[l].startsWith(r) && c[l].match(toRegExp(t))) return true;
                    if (isInjectedScript(t) && c[l].startsWith(n) && c[l].match(toRegExp(t))) return true;
                }
                return false;
            }
            function getNativeRegexpTest() {
                var t = Object.getOwnPropertyDescriptor(RegExp.prototype, "test"), e = null == t ? void 0 : t.value;
                if (t && "function" == typeof t.value) return e;
                throw new Error("RegExp.prototype.test is not a function");
            }
            function toRegExp(e) {
                var r = e || "", t = "/";
                if ("" === r) return new RegExp(".?");
                var n, i, s = r.lastIndexOf(t), a = r.substring(s + 1), g = r.substring(0, s + 1), u = (i = a,
                    (n = g).startsWith(t) && n.endsWith(t) && !n.endsWith("\\/") && function (e) {
                        if (!e) return false;
                        try {
                            return new RegExp("", e), !0;
                        } catch (e) {
                            return false;
                        }
                    }(i) ? i : "");
                if (r.startsWith(t) && r.endsWith(t) || u) return new RegExp((u ? g : r).slice(1, -1), u);
                var c = r.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return new RegExp(c);
            }
            function backupRegExpValues() {
                try {
                    for (var r = [], e = 1; e < 10; e += 1) {
                        var a = `$${e}`;
                        if (!RegExp[a]) break;
                        r.push(RegExp[a]);
                    }
                    return r;
                } catch (r) {
                    return [];
                }
            }
            function restoreRegExpValues(e) {
                if (e.length) try {
                    var r = "";
                    r = 1 === e.length ? `(${e[0]})` : e.reduce((function (e, r, t) {
                        return 1 === t ? `(${e}),(${r})` : `${e},(${r})`;
                    }));
                    var t = new RegExp(r);
                    e.toString().replace(t, "");
                } catch (e) {
                    var n = `Failed to restore RegExp values: ${e}`;
                    console.log(n);
                }
            }
            var updatedArgs = args ? [].concat(source).concat(args) : [source];
            try {
                setConstant.apply(this, updatedArgs);
                if (source.uniqueId) {
                    Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                        value: flag,
                        enumerable: false,
                        writable: false,
                        configurable: false
                    });
                }
            } catch (e) {
                console.log(e);
            }
        })({ "args": ["navigator.getBattery", "noopPromiseResolve"], "engine": "extension", "name": "set-constant", "verbose": false, "domainName": "https://grisoon.github.io/Culture Digital Human/", "version": "5.2.400.0" }, ["navigator.getBattery", "noopPromiseResolve"]);
        var _gaq = []; var _gat = { _getTracker: function () { return { _initData: function () { }, _trackPageview: function () { }, _trackEvent: function () { }, _setAllowLinker: function () { }, _setCustomVar: function () { } } }, _createTracker: function () { return this._getTracker(); }, _anonymizeIp: function () { } };
        function urchinTracker() { };
        (function noTopics(source, args) {
            var flag = "done";
            var uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
            if (source.uniqueId) {
                if (Window.prototype.toString[uniqueIdentifier] === flag) {
                    return;
                }
            }
            function noTopics(source) {
                var TOPICS_PROPERTY_NAME = "browsingTopics";
                if (Document instanceof Object === false) {
                    return;
                }
                if (!Object.prototype.hasOwnProperty.call(Document.prototype, TOPICS_PROPERTY_NAME) || Document.prototype[TOPICS_PROPERTY_NAME] instanceof Function === false) {
                    return;
                }
                Document.prototype[TOPICS_PROPERTY_NAME] = function () {
                    return noopPromiseResolve("[]");
                };
                hit(source);
            }
            function hit(e) {
                if (e.verbose) {
                    try {
                        var n = console.trace.bind(console), i = "[AdGuard] ";
                        "corelibs" === e.engine ? i += e.ruleText : (e.domainName && (i += `${e.domainName}`),
                            e.args ? i += `#%#//scriptlet('${e.name}', '${e.args.join("', '")}')` : i += `#%#//scriptlet('${e.name}')`),
                            n && n(i);
                    } catch (e) { }
                    "function" == typeof window.__debug && window.__debug(e);
                }
            }
            function noopPromiseResolve() {
                var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "{}", t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "", s = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "basic";
                if ("undefined" != typeof Response) {
                    var n = new Response(e, {
                        headers: {
                            "Content-Length": `${e.length}`
                        },
                        status: 200,
                        statusText: "OK"
                    });
                    return "opaque" === s ? Object.defineProperties(n, {
                        body: {
                            value: null
                        },
                        status: {
                            value: 0
                        },
                        ok: {
                            value: false
                        },
                        statusText: {
                            value: ""
                        },
                        url: {
                            value: ""
                        },
                        type: {
                            value: s
                        }
                    }) : Object.defineProperties(n, {
                        url: {
                            value: t
                        },
                        type: {
                            value: s
                        }
                    }), Promise.resolve(n);
                }
            }
            var updatedArgs = args ? [].concat(source).concat(args) : [source];
            try {
                noTopics.apply(this, updatedArgs);
                if (source.uniqueId) {
                    Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                        value: flag,
                        enumerable: false,
                        writable: false,
                        configurable: false
                    });
                }
            } catch (e) {
                console.log(e);
            }
        })({ "args": [], "engine": "extension", "name": "no-topics", "verbose": false, "domainName": "https://grisoon.github.io/Culture Digital Human/", "version": "5.2.400.0" }, []);
        (function setConstant(source, args) {
            var flag = "done";
            var uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
            if (source.uniqueId) {
                if (Window.prototype.toString[uniqueIdentifier] === flag) {
                    return;
                }
            }
            function setConstant(source, property, value) {
                var stack = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : "";
                var valueWrapper = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : "";
                var setProxyTrap = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : false;
                var uboAliases = ["set-constant.js", "ubo-set-constant.js", "set.js", "ubo-set.js", "ubo-set-constant", "ubo-set"];
                if (uboAliases.includes(source.name)) {
                    if (stack.length !== 1 && !getNumberFromString(stack)) {
                        valueWrapper = stack;
                    }
                    stack = undefined;
                }
                if (!property || !matchStackTrace(stack, (new Error).stack)) {
                    return;
                }
                var isProxyTrapSet = false;
                var emptyArr = noopArray();
                var emptyObj = noopObject();
                var constantValue;
                if (value === "undefined") {
                    constantValue = undefined;
                } else if (value === "false") {
                    constantValue = false;
                } else if (value === "true") {
                    constantValue = true;
                } else if (value === "null") {
                    constantValue = null;
                } else if (value === "emptyArr") {
                    constantValue = emptyArr;
                } else if (value === "emptyObj") {
                    constantValue = emptyObj;
                } else if (value === "noopFunc") {
                    constantValue = noopFunc;
                } else if (value === "noopCallbackFunc") {
                    constantValue = noopCallbackFunc;
                } else if (value === "trueFunc") {
                    constantValue = trueFunc;
                } else if (value === "falseFunc") {
                    constantValue = falseFunc;
                } else if (value === "throwFunc") {
                    constantValue = throwFunc;
                } else if (value === "noopPromiseResolve") {
                    constantValue = noopPromiseResolve;
                } else if (value === "noopPromiseReject") {
                    constantValue = noopPromiseReject;
                } else if (/^\d+$/.test(value)) {
                    constantValue = parseFloat(value);
                    if (nativeIsNaN(constantValue)) {
                        return;
                    }
                    if (Math.abs(constantValue) > 32767) {
                        return;
                    }
                } else if (value === "-1") {
                    constantValue = -1;
                } else if (value === "") {
                    constantValue = "";
                } else if (value === "yes") {
                    constantValue = "yes";
                } else if (value === "no") {
                    constantValue = "no";
                } else {
                    return;
                }
                var valueWrapperNames = ["asFunction", "asCallback", "asResolved", "asRejected"];
                if (valueWrapperNames.includes(valueWrapper)) {
                    var valueWrappersMap = {
                        asFunction(v) {
                            return function () {
                                return v;
                            };
                        },
                        asCallback(v) {
                            return function () {
                                return function () {
                                    return v;
                                };
                            };
                        },
                        asResolved(v) {
                            return Promise.resolve(v);
                        },
                        asRejected(v) {
                            return Promise.reject(v);
                        }
                    };
                    constantValue = valueWrappersMap[valueWrapper](constantValue);
                }
                var canceled = false;
                var mustCancel = function mustCancel(value) {
                    if (canceled) {
                        return canceled;
                    }
                    canceled = value !== undefined && constantValue !== undefined && typeof value !== typeof constantValue && value !== null;
                    return canceled;
                };
                var trapProp = function trapProp(base, prop, configurable, handler) {
                    if (!handler.init(base[prop])) {
                        return false;
                    }
                    var origDescriptor = Object.getOwnPropertyDescriptor(base, prop);
                    var prevSetter;
                    if (origDescriptor instanceof Object) {
                        if (!origDescriptor.configurable) {
                            var message = `Property '${prop}' is not configurable`;
                            logMessage(source, message);
                            return false;
                        }
                        if (base[prop]) {
                            base[prop] = constantValue;
                        }
                        if (origDescriptor.set instanceof Function) {
                            prevSetter = origDescriptor.set;
                        }
                    }
                    Object.defineProperty(base, prop, {
                        configurable: configurable,
                        get() {
                            return handler.get();
                        },
                        set(a) {
                            if (prevSetter !== undefined) {
                                prevSetter(a);
                            }
                            if (a instanceof Object) {
                                var propertiesToCheck = property.split(".").slice(1);
                                if (setProxyTrap && !isProxyTrapSet) {
                                    isProxyTrapSet = true;
                                    a = new Proxy(a, {
                                        get: function get(target, propertyKey, val) {
                                            propertiesToCheck.reduce((function (object, currentProp, index, array) {
                                                var currentObj = object === null || object === void 0 ? void 0 : object[currentProp];
                                                if (index === array.length - 1 && currentObj !== constantValue) {
                                                    object[currentProp] = constantValue;
                                                }
                                                return currentObj || object;
                                            }), target);
                                            return Reflect.get(target, propertyKey, val);
                                        }
                                    });
                                }
                            }
                            handler.set(a);
                        }
                    });
                    return true;
                };
                var _setChainPropAccess = function setChainPropAccess(owner, property) {
                    var chainInfo = getPropertyInChain(owner, property);
                    var { base: base } = chainInfo;
                    var { prop: prop, chain: chain } = chainInfo;
                    var inChainPropHandler = {
                        factValue: undefined,
                        init(a) {
                            this.factValue = a;
                            return true;
                        },
                        get() {
                            return this.factValue;
                        },
                        set(a) {
                            if (this.factValue === a) {
                                return;
                            }
                            this.factValue = a;
                            if (a instanceof Object) {
                                _setChainPropAccess(a, chain);
                            }
                        }
                    };
                    var endPropHandler = {
                        init(a) {
                            if (mustCancel(a)) {
                                return false;
                            }
                            return true;
                        },
                        get() {
                            return constantValue;
                        },
                        set(a) {
                            if (!mustCancel(a)) {
                                return;
                            }
                            constantValue = a;
                        }
                    };
                    if (!chain) {
                        var isTrapped = trapProp(base, prop, false, endPropHandler);
                        if (isTrapped) {
                            hit(source);
                        }
                        return;
                    }
                    if (base !== undefined && base[prop] === null) {
                        trapProp(base, prop, true, inChainPropHandler);
                        return;
                    }
                    if ((base instanceof Object || typeof base === "object") && isEmptyObject(base)) {
                        trapProp(base, prop, true, inChainPropHandler);
                    }
                    var propValue = owner[prop];
                    if (propValue instanceof Object || typeof propValue === "object" && propValue !== null) {
                        _setChainPropAccess(propValue, chain);
                    }
                    trapProp(base, prop, true, inChainPropHandler);
                };
                _setChainPropAccess(window, property);
            }
            function hit(e) {
                if (e.verbose) {
                    try {
                        var n = console.trace.bind(console), i = "[AdGuard] ";
                        "corelibs" === e.engine ? i += e.ruleText : (e.domainName && (i += `${e.domainName}`),
                            e.args ? i += `#%#//scriptlet('${e.name}', '${e.args.join("', '")}')` : i += `#%#//scriptlet('${e.name}')`),
                            n && n(i);
                    } catch (e) { }
                    "function" == typeof window.__debug && window.__debug(e);
                }
            }
            function logMessage(e, o) {
                var n = arguments.length > 2 && void 0 !== arguments[2] && arguments[2], g = !(arguments.length > 3 && void 0 !== arguments[3]) || arguments[3], { name: l, verbose: v } = e;
                if (n || v) {
                    var a = console.log;
                    g ? a(`${l}: ${o}`) : a(`${l}:`, o);
                }
            }
            function getNumberFromString(n) {
                var r = parseInt(n, 10);
                return nativeIsNaN(r) ? null : r;
            }
            function noopArray() {
                return [];
            }
            function noopObject() {
                return {};
            }
            function noopFunc() { }
            function noopCallbackFunc() {
                return noopFunc;
            }
            function trueFunc() {
                return true;
            }
            function falseFunc() {
                return false;
            }
            function throwFunc() {
                throw new Error;
            }
            function noopPromiseReject() {
                return Promise.reject();
            }
            function noopPromiseResolve() {
                var e = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "{}", t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "", s = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "basic";
                if ("undefined" != typeof Response) {
                    var n = new Response(e, {
                        headers: {
                            "Content-Length": `${e.length}`
                        },
                        status: 200,
                        statusText: "OK"
                    });
                    return "opaque" === s ? Object.defineProperties(n, {
                        body: {
                            value: null
                        },
                        status: {
                            value: 0
                        },
                        ok: {
                            value: false
                        },
                        statusText: {
                            value: ""
                        },
                        url: {
                            value: ""
                        },
                        type: {
                            value: s
                        }
                    }) : Object.defineProperties(n, {
                        url: {
                            value: t
                        },
                        type: {
                            value: s
                        }
                    }), Promise.resolve(n);
                }
            }
            function getPropertyInChain(e, r) {
                var n = r.indexOf(".");
                if (-1 === n) return {
                    base: e,
                    prop: r
                };
                var i = r.slice(0, n);
                if (null === e) return {
                    base: e,
                    prop: i,
                    chain: r
                };
                var t = e[i];
                return r = r.slice(n + 1), (e instanceof Object || "object" == typeof e) && isEmptyObject(e) || null === t ? {
                    base: e,
                    prop: i,
                    chain: r
                } : void 0 !== t ? getPropertyInChain(t, r) : (Object.defineProperty(e, i, {
                    configurable: true
                }), {
                    base: e,
                    prop: i,
                    chain: r
                });
            }
            function matchStackTrace(e, t) {
                if (!e || "" === e) return true;
                var r = backupRegExpValues();
                if (shouldAbortInlineOrInjectedScript(e, t)) return r.length && r[0] !== RegExp.$1 && restoreRegExpValues(r),
                    true;
                var n = toRegExp(e), a = t.split("\n").slice(2).map((function (e) {
                    return e.trim();
                })).join("\n");
                return r.length && r[0] !== RegExp.$1 && restoreRegExpValues(r), getNativeRegexpTest().call(n, a);
            }
            function nativeIsNaN(N) {
                return (Number.isNaN || window.isNaN)(N);
            }
            function isEmptyObject(t) {
                return 0 === Object.keys(t).length && !t.prototype;
            }
            function shouldAbortInlineOrInjectedScript(t, i) {
                var r = "inlineScript", n = "injectedScript", isInlineScript = function isInlineScript(t) {
                    return t.includes(r);
                }, isInjectedScript = function isInjectedScript(t) {
                    return t.includes(n);
                };
                if (!isInlineScript(t) && !isInjectedScript(t)) return false;
                var e = window.location.href, s = e.indexOf("#");
                -1 !== s && (e = e.slice(0, s));
                var c = i.split("\n").slice(2).map((function (t) {
                    return t.trim();
                })).map((function (t) {
                    var i, s = /(.*?@)?(\S+)(:\d+)(:\d+)\)?$/.exec(t);
                    if (s) {
                        var c, l, a = s[2], u = s[3], o = s[4];
                        if (null !== (c = a) && void 0 !== c && c.startsWith("(") && (a = a.slice(1)), null !== (l = a) && void 0 !== l && l.startsWith("<anonymous>")) {
                            var d;
                            a = n;
                            var f = void 0 !== s[1] ? s[1].slice(0, -1) : t.slice(0, s.index).trim();
                            null !== (d = f) && void 0 !== d && d.startsWith("at") && (f = f.slice(2).trim()),
                                i = `${f} ${a}${u}${o}`.trim();
                        } else i = a === e ? `${r}${u}${o}`.trim() : `${a}${u}${o}`.trim();
                    } else i = t;
                    return i;
                }));
                if (c) for (var l = 0; l < c.length; l += 1) {
                    if (isInlineScript(t) && c[l].startsWith(r) && c[l].match(toRegExp(t))) return true;
                    if (isInjectedScript(t) && c[l].startsWith(n) && c[l].match(toRegExp(t))) return true;
                }
                return false;
            }
            function getNativeRegexpTest() {
                var t = Object.getOwnPropertyDescriptor(RegExp.prototype, "test"), e = null == t ? void 0 : t.value;
                if (t && "function" == typeof t.value) return e;
                throw new Error("RegExp.prototype.test is not a function");
            }
            function toRegExp(e) {
                var r = e || "", t = "/";
                if ("" === r) return new RegExp(".?");
                var n, i, s = r.lastIndexOf(t), a = r.substring(s + 1), g = r.substring(0, s + 1), u = (i = a,
                    (n = g).startsWith(t) && n.endsWith(t) && !n.endsWith("\\/") && function (e) {
                        if (!e) return false;
                        try {
                            return new RegExp("", e), !0;
                        } catch (e) {
                            return false;
                        }
                    }(i) ? i : "");
                if (r.startsWith(t) && r.endsWith(t) || u) return new RegExp((u ? g : r).slice(1, -1), u);
                var c = r.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return new RegExp(c);
            }
            function backupRegExpValues() {
                try {
                    for (var r = [], e = 1; e < 10; e += 1) {
                        var a = `$${e}`;
                        if (!RegExp[a]) break;
                        r.push(RegExp[a]);
                    }
                    return r;
                } catch (r) {
                    return [];
                }
            }
            function restoreRegExpValues(e) {
                if (e.length) try {
                    var r = "";
                    r = 1 === e.length ? `(${e[0]})` : e.reduce((function (e, r, t) {
                        return 1 === t ? `(${e}),(${r})` : `${e},(${r})`;
                    }));
                    var t = new RegExp(r);
                    e.toString().replace(t, "");
                } catch (e) {
                    var n = `Failed to restore RegExp values: ${e}`;
                    console.log(n);
                }
            }
            var updatedArgs = args ? [].concat(source).concat(args) : [source];
            try {
                setConstant.apply(this, updatedArgs);
                if (source.uniqueId) {
                    Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                        value: flag,
                        enumerable: false,
                        writable: false,
                        configurable: false
                    });
                }
            } catch (e) {
                console.log(e);
            }
        })({ "args": ["navigator.privateAttribution", "undefined"], "engine": "extension", "name": "set-constant", "verbose": false, "domainName": "https://grisoon.github.io/Culture Digital Human/", "version": "5.2.400.0" }, ["navigator.privateAttribution", "undefined"]);
        (function noProtectedAudience(source, args) {
            var flag = "done";
            var uniqueIdentifier = source.uniqueId + source.name + "_" + (Array.isArray(args) ? args.join("_") : "");
            if (source.uniqueId) {
                if (Window.prototype.toString[uniqueIdentifier] === flag) {
                    return;
                }
            }
            function noProtectedAudience(source) {
                if (Document instanceof Object === false) {
                    return;
                }
                var protectedAudienceMethods = {
                    joinAdInterestGroup: noopResolveVoid,
                    runAdAuction: noopResolveNull,
                    leaveAdInterestGroup: noopResolveVoid,
                    clearOriginJoinedAdInterestGroups: noopResolveVoid,
                    createAuctionNonce: noopStr,
                    updateAdInterestGroups: noopFunc
                };
                for (var _i = 0, _Object$keys = Object.keys(protectedAudienceMethods); _i < _Object$keys.length; _i++) {
                    var key = _Object$keys[_i];
                    var methodName = key;
                    var prototype = Navigator.prototype;
                    if (!Object.prototype.hasOwnProperty.call(prototype, methodName) || prototype[methodName] instanceof Function === false) {
                        continue;
                    }
                    prototype[methodName] = protectedAudienceMethods[methodName];
                }
                hit(source);
            }
            function hit(e) {
                if (e.verbose) {
                    try {
                        var n = console.trace.bind(console), i = "[AdGuard] ";
                        "corelibs" === e.engine ? i += e.ruleText : (e.domainName && (i += `${e.domainName}`),
                            e.args ? i += `#%#//scriptlet('${e.name}', '${e.args.join("', '")}')` : i += `#%#//scriptlet('${e.name}')`),
                            n && n(i);
                    } catch (e) { }
                    "function" == typeof window.__debug && window.__debug(e);
                }
            }
            function noopStr() {
                return "";
            }
            function noopFunc() { }
            function noopResolveVoid() {
                return Promise.resolve(void 0);
            }
            function noopResolveNull() {
                return Promise.resolve(null);
            }
            var updatedArgs = args ? [].concat(source).concat(args) : [source];
            try {
                noProtectedAudience.apply(this, updatedArgs);
                if (source.uniqueId) {
                    Object.defineProperty(Window.prototype.toString, uniqueIdentifier, {
                        value: flag,
                        enumerable: false,
                        writable: false,
                        configurable: false
                    });
                }
            } catch (e) {
                console.log(e);
            }
        })({ "args": [], "engine": "extension", "name": "no-protected-audience", "verbose": false, "domainName": "https://grisoon.github.io/Culture Digital Human/", "version": "5.2.400.0" }, []);

    } catch (ex) {
        console.error('Error executing AG js: ' + ex);
    }
})();
//# sourceURL=ag-scripts.js
