function fc(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default") ? e.default : e;
}
var Zu = { exports: {} }, cl = {}, Ju = { exports: {} }, O = {};
/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ir = Symbol.for("react.element"), dc = Symbol.for("react.portal"), pc = Symbol.for("react.fragment"), mc = Symbol.for("react.strict_mode"), hc = Symbol.for("react.profiler"), vc = Symbol.for("react.provider"), yc = Symbol.for("react.context"), gc = Symbol.for("react.forward_ref"), wc = Symbol.for("react.suspense"), kc = Symbol.for("react.memo"), Sc = Symbol.for("react.lazy"), Ui = Symbol.iterator;
function Ec(e) {
  return e === null || typeof e != "object" ? null : (e = Ui && e[Ui] || e["@@iterator"], typeof e == "function" ? e : null);
}
var qu = { isMounted: function() {
  return !1;
}, enqueueForceUpdate: function() {
}, enqueueReplaceState: function() {
}, enqueueSetState: function() {
} }, bu = Object.assign, es = {};
function gn(e, t, n) {
  this.props = e, this.context = t, this.refs = es, this.updater = n || qu;
}
gn.prototype.isReactComponent = {};
gn.prototype.setState = function(e, t) {
  if (typeof e != "object" && typeof e != "function" && e != null)
    throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
  this.updater.enqueueSetState(this, e, t, "setState");
};
gn.prototype.forceUpdate = function(e) {
  this.updater.enqueueForceUpdate(this, e, "forceUpdate");
};
function ts() {
}
ts.prototype = gn.prototype;
function Wo(e, t, n) {
  this.props = e, this.context = t, this.refs = es, this.updater = n || qu;
}
var Ko = Wo.prototype = new ts();
Ko.constructor = Wo;
bu(Ko, gn.prototype);
Ko.isPureReactComponent = !0;
var Ai = Array.isArray, ns = Object.prototype.hasOwnProperty, Yo = { current: null }, rs = { key: !0, ref: !0, __self: !0, __source: !0 };
function ls(e, t, n) {
  var r, l = {}, o = null, i = null;
  if (t != null)
    for (r in t.ref !== void 0 && (i = t.ref), t.key !== void 0 && (o = "" + t.key), t)
      ns.call(t, r) && !rs.hasOwnProperty(r) && (l[r] = t[r]);
  var u = arguments.length - 2;
  if (u === 1)
    l.children = n;
  else if (1 < u) {
    for (var s = Array(u), c = 0; c < u; c++)
      s[c] = arguments[c + 2];
    l.children = s;
  }
  if (e && e.defaultProps)
    for (r in u = e.defaultProps, u)
      l[r] === void 0 && (l[r] = u[r]);
  return { $$typeof: ir, type: e, key: o, ref: i, props: l, _owner: Yo.current };
}
function Cc(e, t) {
  return { $$typeof: ir, type: e.type, key: t, ref: e.ref, props: e.props, _owner: e._owner };
}
function Xo(e) {
  return typeof e == "object" && e !== null && e.$$typeof === ir;
}
function xc(e) {
  var t = { "=": "=0", ":": "=2" };
  return "$" + e.replace(/[=:]/g, function(n) {
    return t[n];
  });
}
var Vi = /\/+/g;
function _l(e, t) {
  return typeof e == "object" && e !== null && e.key != null ? xc("" + e.key) : t.toString(36);
}
function zr(e, t, n, r, l) {
  var o = typeof e;
  (o === "undefined" || o === "boolean") && (e = null);
  var i = !1;
  if (e === null)
    i = !0;
  else
    switch (o) {
      case "string":
      case "number":
        i = !0;
        break;
      case "object":
        switch (e.$$typeof) {
          case ir:
          case dc:
            i = !0;
        }
    }
  if (i)
    return i = e, l = l(i), e = r === "" ? "." + _l(i, 0) : r, Ai(l) ? (n = "", e != null && (n = e.replace(Vi, "$&/") + "/"), zr(l, t, n, "", function(c) {
      return c;
    })) : l != null && (Xo(l) && (l = Cc(l, n + (!l.key || i && i.key === l.key ? "" : ("" + l.key).replace(Vi, "$&/") + "/") + e)), t.push(l)), 1;
  if (i = 0, r = r === "" ? "." : r + ":", Ai(e))
    for (var u = 0; u < e.length; u++) {
      o = e[u];
      var s = r + _l(o, u);
      i += zr(o, t, n, s, l);
    }
  else if (s = Ec(e), typeof s == "function")
    for (e = s.call(e), u = 0; !(o = e.next()).done; )
      o = o.value, s = r + _l(o, u++), i += zr(o, t, n, s, l);
  else if (o === "object")
    throw t = String(e), Error("Objects are not valid as a React child (found: " + (t === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : t) + "). If you meant to render a collection of children, use an array instead.");
  return i;
}
function fr(e, t, n) {
  if (e == null)
    return e;
  var r = [], l = 0;
  return zr(e, r, "", "", function(o) {
    return t.call(n, o, l++);
  }), r;
}
function Nc(e) {
  if (e._status === -1) {
    var t = e._result;
    t = t(), t.then(function(n) {
      (e._status === 0 || e._status === -1) && (e._status = 1, e._result = n);
    }, function(n) {
      (e._status === 0 || e._status === -1) && (e._status = 2, e._result = n);
    }), e._status === -1 && (e._status = 0, e._result = t);
  }
  if (e._status === 1)
    return e._result.default;
  throw e._result;
}
var ve = { current: null }, Tr = { transition: null }, _c = { ReactCurrentDispatcher: ve, ReactCurrentBatchConfig: Tr, ReactCurrentOwner: Yo };
function os() {
  throw Error("act(...) is not supported in production builds of React.");
}
O.Children = { map: fr, forEach: function(e, t, n) {
  fr(e, function() {
    t.apply(this, arguments);
  }, n);
}, count: function(e) {
  var t = 0;
  return fr(e, function() {
    t++;
  }), t;
}, toArray: function(e) {
  return fr(e, function(t) {
    return t;
  }) || [];
}, only: function(e) {
  if (!Xo(e))
    throw Error("React.Children.only expected to receive a single React element child.");
  return e;
} };
O.Component = gn;
O.Fragment = pc;
O.Profiler = hc;
O.PureComponent = Wo;
O.StrictMode = mc;
O.Suspense = wc;
O.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = _c;
O.act = os;
O.cloneElement = function(e, t, n) {
  if (e == null)
    throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + e + ".");
  var r = bu({}, e.props), l = e.key, o = e.ref, i = e._owner;
  if (t != null) {
    if (t.ref !== void 0 && (o = t.ref, i = Yo.current), t.key !== void 0 && (l = "" + t.key), e.type && e.type.defaultProps)
      var u = e.type.defaultProps;
    for (s in t)
      ns.call(t, s) && !rs.hasOwnProperty(s) && (r[s] = t[s] === void 0 && u !== void 0 ? u[s] : t[s]);
  }
  var s = arguments.length - 2;
  if (s === 1)
    r.children = n;
  else if (1 < s) {
    u = Array(s);
    for (var c = 0; c < s; c++)
      u[c] = arguments[c + 2];
    r.children = u;
  }
  return { $$typeof: ir, type: e.type, key: l, ref: o, props: r, _owner: i };
};
O.createContext = function(e) {
  return e = { $$typeof: yc, _currentValue: e, _currentValue2: e, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null }, e.Provider = { $$typeof: vc, _context: e }, e.Consumer = e;
};
O.createElement = ls;
O.createFactory = function(e) {
  var t = ls.bind(null, e);
  return t.type = e, t;
};
O.createRef = function() {
  return { current: null };
};
O.forwardRef = function(e) {
  return { $$typeof: gc, render: e };
};
O.isValidElement = Xo;
O.lazy = function(e) {
  return { $$typeof: Sc, _payload: { _status: -1, _result: e }, _init: Nc };
};
O.memo = function(e, t) {
  return { $$typeof: kc, type: e, compare: t === void 0 ? null : t };
};
O.startTransition = function(e) {
  var t = Tr.transition;
  Tr.transition = {};
  try {
    e();
  } finally {
    Tr.transition = t;
  }
};
O.unstable_act = os;
O.useCallback = function(e, t) {
  return ve.current.useCallback(e, t);
};
O.useContext = function(e) {
  return ve.current.useContext(e);
};
O.useDebugValue = function() {
};
O.useDeferredValue = function(e) {
  return ve.current.useDeferredValue(e);
};
O.useEffect = function(e, t) {
  return ve.current.useEffect(e, t);
};
O.useId = function() {
  return ve.current.useId();
};
O.useImperativeHandle = function(e, t, n) {
  return ve.current.useImperativeHandle(e, t, n);
};
O.useInsertionEffect = function(e, t) {
  return ve.current.useInsertionEffect(e, t);
};
O.useLayoutEffect = function(e, t) {
  return ve.current.useLayoutEffect(e, t);
};
O.useMemo = function(e, t) {
  return ve.current.useMemo(e, t);
};
O.useReducer = function(e, t, n) {
  return ve.current.useReducer(e, t, n);
};
O.useRef = function(e) {
  return ve.current.useRef(e);
};
O.useState = function(e) {
  return ve.current.useState(e);
};
O.useSyncExternalStore = function(e, t, n) {
  return ve.current.useSyncExternalStore(e, t, n);
};
O.useTransition = function() {
  return ve.current.useTransition();
};
O.version = "18.3.1";
Ju.exports = O;
var D = Ju.exports;
const Pc = /* @__PURE__ */ fc(D);
/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var zc = D, Tc = Symbol.for("react.element"), Lc = Symbol.for("react.fragment"), Rc = Object.prototype.hasOwnProperty, Mc = zc.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner, Ic = { key: !0, ref: !0, __self: !0, __source: !0 };
function is(e, t, n) {
  var r, l = {}, o = null, i = null;
  n !== void 0 && (o = "" + n), t.key !== void 0 && (o = "" + t.key), t.ref !== void 0 && (i = t.ref);
  for (r in t)
    Rc.call(t, r) && !Ic.hasOwnProperty(r) && (l[r] = t[r]);
  if (e && e.defaultProps)
    for (r in t = e.defaultProps, t)
      l[r] === void 0 && (l[r] = t[r]);
  return { $$typeof: Tc, type: e, key: o, ref: i, props: l, _owner: Mc.current };
}
cl.Fragment = Lc;
cl.jsx = is;
cl.jsxs = is;
Zu.exports = cl;
var us = Zu.exports;
const z = us.jsx, I = us.jsxs;
var ss = { exports: {} }, Pe = {}, as = { exports: {} }, cs = {};
/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
(function(e) {
  function t(C, L) {
    var R = C.length;
    C.push(L);
    e:
      for (; 0 < R; ) {
        var Y = R - 1 >>> 1, b = C[Y];
        if (0 < l(b, L))
          C[Y] = L, C[R] = b, R = Y;
        else
          break e;
      }
  }
  function n(C) {
    return C.length === 0 ? null : C[0];
  }
  function r(C) {
    if (C.length === 0)
      return null;
    var L = C[0], R = C.pop();
    if (R !== L) {
      C[0] = R;
      e:
        for (var Y = 0, b = C.length, Qt = b >>> 1; Y < Qt; ) {
          var Qe = 2 * (Y + 1) - 1, v = C[Qe], M = Qe + 1, F = C[M];
          if (0 > l(v, R))
            M < b && 0 > l(F, v) ? (C[Y] = F, C[M] = R, Y = M) : (C[Y] = v, C[Qe] = R, Y = Qe);
          else if (M < b && 0 > l(F, R))
            C[Y] = F, C[M] = R, Y = M;
          else
            break e;
        }
    }
    return L;
  }
  function l(C, L) {
    var R = C.sortIndex - L.sortIndex;
    return R !== 0 ? R : C.id - L.id;
  }
  if (typeof performance == "object" && typeof performance.now == "function") {
    var o = performance;
    e.unstable_now = function() {
      return o.now();
    };
  } else {
    var i = Date, u = i.now();
    e.unstable_now = function() {
      return i.now() - u;
    };
  }
  var s = [], c = [], m = 1, h = null, p = 3, w = !1, k = !1, S = !1, U = typeof setTimeout == "function" ? setTimeout : null, f = typeof clearTimeout == "function" ? clearTimeout : null, a = typeof setImmediate < "u" ? setImmediate : null;
  typeof navigator < "u" && navigator.scheduling !== void 0 && navigator.scheduling.isInputPending !== void 0 && navigator.scheduling.isInputPending.bind(navigator.scheduling);
  function d(C) {
    for (var L = n(c); L !== null; ) {
      if (L.callback === null)
        r(c);
      else if (L.startTime <= C)
        r(c), L.sortIndex = L.expirationTime, t(s, L);
      else
        break;
      L = n(c);
    }
  }
  function y(C) {
    if (S = !1, d(C), !k)
      if (n(s) !== null)
        k = !0, He(E);
      else {
        var L = n(c);
        L !== null && zt(y, L.startTime - C);
      }
  }
  function E(C, L) {
    k = !1, S && (S = !1, f(P), P = -1), w = !0;
    var R = p;
    try {
      for (d(L), h = n(s); h !== null && (!(h.expirationTime > L) || C && !oe()); ) {
        var Y = h.callback;
        if (typeof Y == "function") {
          h.callback = null, p = h.priorityLevel;
          var b = Y(h.expirationTime <= L);
          L = e.unstable_now(), typeof b == "function" ? h.callback = b : h === n(s) && r(s), d(L);
        } else
          r(s);
        h = n(s);
      }
      if (h !== null)
        var Qt = !0;
      else {
        var Qe = n(c);
        Qe !== null && zt(y, Qe.startTime - L), Qt = !1;
      }
      return Qt;
    } finally {
      h = null, p = R, w = !1;
    }
  }
  var N = !1, _ = null, P = -1, V = 5, T = -1;
  function oe() {
    return !(e.unstable_now() - T < V);
  }
  function Ze() {
    if (_ !== null) {
      var C = e.unstable_now();
      T = C;
      var L = !0;
      try {
        L = _(!0, C);
      } finally {
        L ? Pt() : (N = !1, _ = null);
      }
    } else
      N = !1;
  }
  var Pt;
  if (typeof a == "function")
    Pt = function() {
      a(Ze);
    };
  else if (typeof MessageChannel < "u") {
    var Te = new MessageChannel(), Ht = Te.port2;
    Te.port1.onmessage = Ze, Pt = function() {
      Ht.postMessage(null);
    };
  } else
    Pt = function() {
      U(Ze, 0);
    };
  function He(C) {
    _ = C, N || (N = !0, Pt());
  }
  function zt(C, L) {
    P = U(function() {
      C(e.unstable_now());
    }, L);
  }
  e.unstable_IdlePriority = 5, e.unstable_ImmediatePriority = 1, e.unstable_LowPriority = 4, e.unstable_NormalPriority = 3, e.unstable_Profiling = null, e.unstable_UserBlockingPriority = 2, e.unstable_cancelCallback = function(C) {
    C.callback = null;
  }, e.unstable_continueExecution = function() {
    k || w || (k = !0, He(E));
  }, e.unstable_forceFrameRate = function(C) {
    0 > C || 125 < C ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : V = 0 < C ? Math.floor(1e3 / C) : 5;
  }, e.unstable_getCurrentPriorityLevel = function() {
    return p;
  }, e.unstable_getFirstCallbackNode = function() {
    return n(s);
  }, e.unstable_next = function(C) {
    switch (p) {
      case 1:
      case 2:
      case 3:
        var L = 3;
        break;
      default:
        L = p;
    }
    var R = p;
    p = L;
    try {
      return C();
    } finally {
      p = R;
    }
  }, e.unstable_pauseExecution = function() {
  }, e.unstable_requestPaint = function() {
  }, e.unstable_runWithPriority = function(C, L) {
    switch (C) {
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
        break;
      default:
        C = 3;
    }
    var R = p;
    p = C;
    try {
      return L();
    } finally {
      p = R;
    }
  }, e.unstable_scheduleCallback = function(C, L, R) {
    var Y = e.unstable_now();
    switch (typeof R == "object" && R !== null ? (R = R.delay, R = typeof R == "number" && 0 < R ? Y + R : Y) : R = Y, C) {
      case 1:
        var b = -1;
        break;
      case 2:
        b = 250;
        break;
      case 5:
        b = 1073741823;
        break;
      case 4:
        b = 1e4;
        break;
      default:
        b = 5e3;
    }
    return b = R + b, C = { id: m++, callback: L, priorityLevel: C, startTime: R, expirationTime: b, sortIndex: -1 }, R > Y ? (C.sortIndex = R, t(c, C), n(s) === null && C === n(c) && (S ? (f(P), P = -1) : S = !0, zt(y, R - Y))) : (C.sortIndex = b, t(s, C), k || w || (k = !0, He(E))), C;
  }, e.unstable_shouldYield = oe, e.unstable_wrapCallback = function(C) {
    var L = p;
    return function() {
      var R = p;
      p = L;
      try {
        return C.apply(this, arguments);
      } finally {
        p = R;
      }
    };
  };
})(cs);
as.exports = cs;
var Oc = as.exports;
/**
 * @license React
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var Dc = D, _e = Oc;
function g(e) {
  for (var t = "https://reactjs.org/docs/error-decoder.html?invariant=" + e, n = 1; n < arguments.length; n++)
    t += "&args[]=" + encodeURIComponent(arguments[n]);
  return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
}
var fs = /* @__PURE__ */ new Set(), Hn = {};
function Vt(e, t) {
  fn(e, t), fn(e + "Capture", t);
}
function fn(e, t) {
  for (Hn[e] = t, e = 0; e < t.length; e++)
    fs.add(t[e]);
}
var nt = !(typeof window > "u" || typeof window.document > "u" || typeof window.document.createElement > "u"), ql = Object.prototype.hasOwnProperty, Fc = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/, Bi = {}, Hi = {};
function jc(e) {
  return ql.call(Hi, e) ? !0 : ql.call(Bi, e) ? !1 : Fc.test(e) ? Hi[e] = !0 : (Bi[e] = !0, !1);
}
function $c(e, t, n, r) {
  if (n !== null && n.type === 0)
    return !1;
  switch (typeof t) {
    case "function":
    case "symbol":
      return !0;
    case "boolean":
      return r ? !1 : n !== null ? !n.acceptsBooleans : (e = e.toLowerCase().slice(0, 5), e !== "data-" && e !== "aria-");
    default:
      return !1;
  }
}
function Uc(e, t, n, r) {
  if (t === null || typeof t > "u" || $c(e, t, n, r))
    return !0;
  if (r)
    return !1;
  if (n !== null)
    switch (n.type) {
      case 3:
        return !t;
      case 4:
        return t === !1;
      case 5:
        return isNaN(t);
      case 6:
        return isNaN(t) || 1 > t;
    }
  return !1;
}
function ye(e, t, n, r, l, o, i) {
  this.acceptsBooleans = t === 2 || t === 3 || t === 4, this.attributeName = r, this.attributeNamespace = l, this.mustUseProperty = n, this.propertyName = e, this.type = t, this.sanitizeURL = o, this.removeEmptyString = i;
}
var se = {};
"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(e) {
  se[e] = new ye(e, 0, !1, e, null, !1, !1);
});
[["acceptCharset", "accept-charset"], ["className", "class"], ["htmlFor", "for"], ["httpEquiv", "http-equiv"]].forEach(function(e) {
  var t = e[0];
  se[t] = new ye(t, 1, !1, e[1], null, !1, !1);
});
["contentEditable", "draggable", "spellCheck", "value"].forEach(function(e) {
  se[e] = new ye(e, 2, !1, e.toLowerCase(), null, !1, !1);
});
["autoReverse", "externalResourcesRequired", "focusable", "preserveAlpha"].forEach(function(e) {
  se[e] = new ye(e, 2, !1, e, null, !1, !1);
});
"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(e) {
  se[e] = new ye(e, 3, !1, e.toLowerCase(), null, !1, !1);
});
["checked", "multiple", "muted", "selected"].forEach(function(e) {
  se[e] = new ye(e, 3, !0, e, null, !1, !1);
});
["capture", "download"].forEach(function(e) {
  se[e] = new ye(e, 4, !1, e, null, !1, !1);
});
["cols", "rows", "size", "span"].forEach(function(e) {
  se[e] = new ye(e, 6, !1, e, null, !1, !1);
});
["rowSpan", "start"].forEach(function(e) {
  se[e] = new ye(e, 5, !1, e.toLowerCase(), null, !1, !1);
});
var Go = /[\-:]([a-z])/g;
function Zo(e) {
  return e[1].toUpperCase();
}
"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(e) {
  var t = e.replace(
    Go,
    Zo
  );
  se[t] = new ye(t, 1, !1, e, null, !1, !1);
});
"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(e) {
  var t = e.replace(Go, Zo);
  se[t] = new ye(t, 1, !1, e, "http://www.w3.org/1999/xlink", !1, !1);
});
["xml:base", "xml:lang", "xml:space"].forEach(function(e) {
  var t = e.replace(Go, Zo);
  se[t] = new ye(t, 1, !1, e, "http://www.w3.org/XML/1998/namespace", !1, !1);
});
["tabIndex", "crossOrigin"].forEach(function(e) {
  se[e] = new ye(e, 1, !1, e.toLowerCase(), null, !1, !1);
});
se.xlinkHref = new ye("xlinkHref", 1, !1, "xlink:href", "http://www.w3.org/1999/xlink", !0, !1);
["src", "href", "action", "formAction"].forEach(function(e) {
  se[e] = new ye(e, 1, !1, e.toLowerCase(), null, !0, !0);
});
function Jo(e, t, n, r) {
  var l = se.hasOwnProperty(t) ? se[t] : null;
  (l !== null ? l.type !== 0 : r || !(2 < t.length) || t[0] !== "o" && t[0] !== "O" || t[1] !== "n" && t[1] !== "N") && (Uc(t, n, l, r) && (n = null), r || l === null ? jc(t) && (n === null ? e.removeAttribute(t) : e.setAttribute(t, "" + n)) : l.mustUseProperty ? e[l.propertyName] = n === null ? l.type === 3 ? !1 : "" : n : (t = l.attributeName, r = l.attributeNamespace, n === null ? e.removeAttribute(t) : (l = l.type, n = l === 3 || l === 4 && n === !0 ? "" : "" + n, r ? e.setAttributeNS(r, t, n) : e.setAttribute(t, n))));
}
var it = Dc.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, dr = Symbol.for("react.element"), Kt = Symbol.for("react.portal"), Yt = Symbol.for("react.fragment"), qo = Symbol.for("react.strict_mode"), bl = Symbol.for("react.profiler"), ds = Symbol.for("react.provider"), ps = Symbol.for("react.context"), bo = Symbol.for("react.forward_ref"), eo = Symbol.for("react.suspense"), to = Symbol.for("react.suspense_list"), ei = Symbol.for("react.memo"), st = Symbol.for("react.lazy"), ms = Symbol.for("react.offscreen"), Qi = Symbol.iterator;
function Sn(e) {
  return e === null || typeof e != "object" ? null : (e = Qi && e[Qi] || e["@@iterator"], typeof e == "function" ? e : null);
}
var Z = Object.assign, Pl;
function Ln(e) {
  if (Pl === void 0)
    try {
      throw Error();
    } catch (n) {
      var t = n.stack.trim().match(/\n( *(at )?)/);
      Pl = t && t[1] || "";
    }
  return `
` + Pl + e;
}
var zl = !1;
function Tl(e, t) {
  if (!e || zl)
    return "";
  zl = !0;
  var n = Error.prepareStackTrace;
  Error.prepareStackTrace = void 0;
  try {
    if (t)
      if (t = function() {
        throw Error();
      }, Object.defineProperty(t.prototype, "props", { set: function() {
        throw Error();
      } }), typeof Reflect == "object" && Reflect.construct) {
        try {
          Reflect.construct(t, []);
        } catch (c) {
          var r = c;
        }
        Reflect.construct(e, [], t);
      } else {
        try {
          t.call();
        } catch (c) {
          r = c;
        }
        e.call(t.prototype);
      }
    else {
      try {
        throw Error();
      } catch (c) {
        r = c;
      }
      e();
    }
  } catch (c) {
    if (c && r && typeof c.stack == "string") {
      for (var l = c.stack.split(`
`), o = r.stack.split(`
`), i = l.length - 1, u = o.length - 1; 1 <= i && 0 <= u && l[i] !== o[u]; )
        u--;
      for (; 1 <= i && 0 <= u; i--, u--)
        if (l[i] !== o[u]) {
          if (i !== 1 || u !== 1)
            do
              if (i--, u--, 0 > u || l[i] !== o[u]) {
                var s = `
` + l[i].replace(" at new ", " at ");
                return e.displayName && s.includes("<anonymous>") && (s = s.replace("<anonymous>", e.displayName)), s;
              }
            while (1 <= i && 0 <= u);
          break;
        }
    }
  } finally {
    zl = !1, Error.prepareStackTrace = n;
  }
  return (e = e ? e.displayName || e.name : "") ? Ln(e) : "";
}
function Ac(e) {
  switch (e.tag) {
    case 5:
      return Ln(e.type);
    case 16:
      return Ln("Lazy");
    case 13:
      return Ln("Suspense");
    case 19:
      return Ln("SuspenseList");
    case 0:
    case 2:
    case 15:
      return e = Tl(e.type, !1), e;
    case 11:
      return e = Tl(e.type.render, !1), e;
    case 1:
      return e = Tl(e.type, !0), e;
    default:
      return "";
  }
}
function no(e) {
  if (e == null)
    return null;
  if (typeof e == "function")
    return e.displayName || e.name || null;
  if (typeof e == "string")
    return e;
  switch (e) {
    case Yt:
      return "Fragment";
    case Kt:
      return "Portal";
    case bl:
      return "Profiler";
    case qo:
      return "StrictMode";
    case eo:
      return "Suspense";
    case to:
      return "SuspenseList";
  }
  if (typeof e == "object")
    switch (e.$$typeof) {
      case ps:
        return (e.displayName || "Context") + ".Consumer";
      case ds:
        return (e._context.displayName || "Context") + ".Provider";
      case bo:
        var t = e.render;
        return e = e.displayName, e || (e = t.displayName || t.name || "", e = e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef"), e;
      case ei:
        return t = e.displayName || null, t !== null ? t : no(e.type) || "Memo";
      case st:
        t = e._payload, e = e._init;
        try {
          return no(e(t));
        } catch {
        }
    }
  return null;
}
function Vc(e) {
  var t = e.type;
  switch (e.tag) {
    case 24:
      return "Cache";
    case 9:
      return (t.displayName || "Context") + ".Consumer";
    case 10:
      return (t._context.displayName || "Context") + ".Provider";
    case 18:
      return "DehydratedFragment";
    case 11:
      return e = t.render, e = e.displayName || e.name || "", t.displayName || (e !== "" ? "ForwardRef(" + e + ")" : "ForwardRef");
    case 7:
      return "Fragment";
    case 5:
      return t;
    case 4:
      return "Portal";
    case 3:
      return "Root";
    case 6:
      return "Text";
    case 16:
      return no(t);
    case 8:
      return t === qo ? "StrictMode" : "Mode";
    case 22:
      return "Offscreen";
    case 12:
      return "Profiler";
    case 21:
      return "Scope";
    case 13:
      return "Suspense";
    case 19:
      return "SuspenseList";
    case 25:
      return "TracingMarker";
    case 1:
    case 0:
    case 17:
    case 2:
    case 14:
    case 15:
      if (typeof t == "function")
        return t.displayName || t.name || null;
      if (typeof t == "string")
        return t;
  }
  return null;
}
function Et(e) {
  switch (typeof e) {
    case "boolean":
    case "number":
    case "string":
    case "undefined":
      return e;
    case "object":
      return e;
    default:
      return "";
  }
}
function hs(e) {
  var t = e.type;
  return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
}
function Bc(e) {
  var t = hs(e) ? "checked" : "value", n = Object.getOwnPropertyDescriptor(e.constructor.prototype, t), r = "" + e[t];
  if (!e.hasOwnProperty(t) && typeof n < "u" && typeof n.get == "function" && typeof n.set == "function") {
    var l = n.get, o = n.set;
    return Object.defineProperty(e, t, { configurable: !0, get: function() {
      return l.call(this);
    }, set: function(i) {
      r = "" + i, o.call(this, i);
    } }), Object.defineProperty(e, t, { enumerable: n.enumerable }), { getValue: function() {
      return r;
    }, setValue: function(i) {
      r = "" + i;
    }, stopTracking: function() {
      e._valueTracker = null, delete e[t];
    } };
  }
}
function pr(e) {
  e._valueTracker || (e._valueTracker = Bc(e));
}
function vs(e) {
  if (!e)
    return !1;
  var t = e._valueTracker;
  if (!t)
    return !0;
  var n = t.getValue(), r = "";
  return e && (r = hs(e) ? e.checked ? "true" : "false" : e.value), e = r, e !== n ? (t.setValue(e), !0) : !1;
}
function Ar(e) {
  if (e = e || (typeof document < "u" ? document : void 0), typeof e > "u")
    return null;
  try {
    return e.activeElement || e.body;
  } catch {
    return e.body;
  }
}
function ro(e, t) {
  var n = t.checked;
  return Z({}, t, { defaultChecked: void 0, defaultValue: void 0, value: void 0, checked: n ?? e._wrapperState.initialChecked });
}
function Wi(e, t) {
  var n = t.defaultValue == null ? "" : t.defaultValue, r = t.checked != null ? t.checked : t.defaultChecked;
  n = Et(t.value != null ? t.value : n), e._wrapperState = { initialChecked: r, initialValue: n, controlled: t.type === "checkbox" || t.type === "radio" ? t.checked != null : t.value != null };
}
function ys(e, t) {
  t = t.checked, t != null && Jo(e, "checked", t, !1);
}
function lo(e, t) {
  ys(e, t);
  var n = Et(t.value), r = t.type;
  if (n != null)
    r === "number" ? (n === 0 && e.value === "" || e.value != n) && (e.value = "" + n) : e.value !== "" + n && (e.value = "" + n);
  else if (r === "submit" || r === "reset") {
    e.removeAttribute("value");
    return;
  }
  t.hasOwnProperty("value") ? oo(e, t.type, n) : t.hasOwnProperty("defaultValue") && oo(e, t.type, Et(t.defaultValue)), t.checked == null && t.defaultChecked != null && (e.defaultChecked = !!t.defaultChecked);
}
function Ki(e, t, n) {
  if (t.hasOwnProperty("value") || t.hasOwnProperty("defaultValue")) {
    var r = t.type;
    if (!(r !== "submit" && r !== "reset" || t.value !== void 0 && t.value !== null))
      return;
    t = "" + e._wrapperState.initialValue, n || t === e.value || (e.value = t), e.defaultValue = t;
  }
  n = e.name, n !== "" && (e.name = ""), e.defaultChecked = !!e._wrapperState.initialChecked, n !== "" && (e.name = n);
}
function oo(e, t, n) {
  (t !== "number" || Ar(e.ownerDocument) !== e) && (n == null ? e.defaultValue = "" + e._wrapperState.initialValue : e.defaultValue !== "" + n && (e.defaultValue = "" + n));
}
var Rn = Array.isArray;
function ln(e, t, n, r) {
  if (e = e.options, t) {
    t = {};
    for (var l = 0; l < n.length; l++)
      t["$" + n[l]] = !0;
    for (n = 0; n < e.length; n++)
      l = t.hasOwnProperty("$" + e[n].value), e[n].selected !== l && (e[n].selected = l), l && r && (e[n].defaultSelected = !0);
  } else {
    for (n = "" + Et(n), t = null, l = 0; l < e.length; l++) {
      if (e[l].value === n) {
        e[l].selected = !0, r && (e[l].defaultSelected = !0);
        return;
      }
      t !== null || e[l].disabled || (t = e[l]);
    }
    t !== null && (t.selected = !0);
  }
}
function io(e, t) {
  if (t.dangerouslySetInnerHTML != null)
    throw Error(g(91));
  return Z({}, t, { value: void 0, defaultValue: void 0, children: "" + e._wrapperState.initialValue });
}
function Yi(e, t) {
  var n = t.value;
  if (n == null) {
    if (n = t.children, t = t.defaultValue, n != null) {
      if (t != null)
        throw Error(g(92));
      if (Rn(n)) {
        if (1 < n.length)
          throw Error(g(93));
        n = n[0];
      }
      t = n;
    }
    t == null && (t = ""), n = t;
  }
  e._wrapperState = { initialValue: Et(n) };
}
function gs(e, t) {
  var n = Et(t.value), r = Et(t.defaultValue);
  n != null && (n = "" + n, n !== e.value && (e.value = n), t.defaultValue == null && e.defaultValue !== n && (e.defaultValue = n)), r != null && (e.defaultValue = "" + r);
}
function Xi(e) {
  var t = e.textContent;
  t === e._wrapperState.initialValue && t !== "" && t !== null && (e.value = t);
}
function ws(e) {
  switch (e) {
    case "svg":
      return "http://www.w3.org/2000/svg";
    case "math":
      return "http://www.w3.org/1998/Math/MathML";
    default:
      return "http://www.w3.org/1999/xhtml";
  }
}
function uo(e, t) {
  return e == null || e === "http://www.w3.org/1999/xhtml" ? ws(t) : e === "http://www.w3.org/2000/svg" && t === "foreignObject" ? "http://www.w3.org/1999/xhtml" : e;
}
var mr, ks = function(e) {
  return typeof MSApp < "u" && MSApp.execUnsafeLocalFunction ? function(t, n, r, l) {
    MSApp.execUnsafeLocalFunction(function() {
      return e(t, n, r, l);
    });
  } : e;
}(function(e, t) {
  if (e.namespaceURI !== "http://www.w3.org/2000/svg" || "innerHTML" in e)
    e.innerHTML = t;
  else {
    for (mr = mr || document.createElement("div"), mr.innerHTML = "<svg>" + t.valueOf().toString() + "</svg>", t = mr.firstChild; e.firstChild; )
      e.removeChild(e.firstChild);
    for (; t.firstChild; )
      e.appendChild(t.firstChild);
  }
});
function Qn(e, t) {
  if (t) {
    var n = e.firstChild;
    if (n && n === e.lastChild && n.nodeType === 3) {
      n.nodeValue = t;
      return;
    }
  }
  e.textContent = t;
}
var On = {
  animationIterationCount: !0,
  aspectRatio: !0,
  borderImageOutset: !0,
  borderImageSlice: !0,
  borderImageWidth: !0,
  boxFlex: !0,
  boxFlexGroup: !0,
  boxOrdinalGroup: !0,
  columnCount: !0,
  columns: !0,
  flex: !0,
  flexGrow: !0,
  flexPositive: !0,
  flexShrink: !0,
  flexNegative: !0,
  flexOrder: !0,
  gridArea: !0,
  gridRow: !0,
  gridRowEnd: !0,
  gridRowSpan: !0,
  gridRowStart: !0,
  gridColumn: !0,
  gridColumnEnd: !0,
  gridColumnSpan: !0,
  gridColumnStart: !0,
  fontWeight: !0,
  lineClamp: !0,
  lineHeight: !0,
  opacity: !0,
  order: !0,
  orphans: !0,
  tabSize: !0,
  widows: !0,
  zIndex: !0,
  zoom: !0,
  fillOpacity: !0,
  floodOpacity: !0,
  stopOpacity: !0,
  strokeDasharray: !0,
  strokeDashoffset: !0,
  strokeMiterlimit: !0,
  strokeOpacity: !0,
  strokeWidth: !0
}, Hc = ["Webkit", "ms", "Moz", "O"];
Object.keys(On).forEach(function(e) {
  Hc.forEach(function(t) {
    t = t + e.charAt(0).toUpperCase() + e.substring(1), On[t] = On[e];
  });
});
function Ss(e, t, n) {
  return t == null || typeof t == "boolean" || t === "" ? "" : n || typeof t != "number" || t === 0 || On.hasOwnProperty(e) && On[e] ? ("" + t).trim() : t + "px";
}
function Es(e, t) {
  e = e.style;
  for (var n in t)
    if (t.hasOwnProperty(n)) {
      var r = n.indexOf("--") === 0, l = Ss(n, t[n], r);
      n === "float" && (n = "cssFloat"), r ? e.setProperty(n, l) : e[n] = l;
    }
}
var Qc = Z({ menuitem: !0 }, { area: !0, base: !0, br: !0, col: !0, embed: !0, hr: !0, img: !0, input: !0, keygen: !0, link: !0, meta: !0, param: !0, source: !0, track: !0, wbr: !0 });
function so(e, t) {
  if (t) {
    if (Qc[e] && (t.children != null || t.dangerouslySetInnerHTML != null))
      throw Error(g(137, e));
    if (t.dangerouslySetInnerHTML != null) {
      if (t.children != null)
        throw Error(g(60));
      if (typeof t.dangerouslySetInnerHTML != "object" || !("__html" in t.dangerouslySetInnerHTML))
        throw Error(g(61));
    }
    if (t.style != null && typeof t.style != "object")
      throw Error(g(62));
  }
}
function ao(e, t) {
  if (e.indexOf("-") === -1)
    return typeof t.is == "string";
  switch (e) {
    case "annotation-xml":
    case "color-profile":
    case "font-face":
    case "font-face-src":
    case "font-face-uri":
    case "font-face-format":
    case "font-face-name":
    case "missing-glyph":
      return !1;
    default:
      return !0;
  }
}
var co = null;
function ti(e) {
  return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
}
var fo = null, on = null, un = null;
function Gi(e) {
  if (e = ar(e)) {
    if (typeof fo != "function")
      throw Error(g(280));
    var t = e.stateNode;
    t && (t = hl(t), fo(e.stateNode, e.type, t));
  }
}
function Cs(e) {
  on ? un ? un.push(e) : un = [e] : on = e;
}
function xs() {
  if (on) {
    var e = on, t = un;
    if (un = on = null, Gi(e), t)
      for (e = 0; e < t.length; e++)
        Gi(t[e]);
  }
}
function Ns(e, t) {
  return e(t);
}
function _s() {
}
var Ll = !1;
function Ps(e, t, n) {
  if (Ll)
    return e(t, n);
  Ll = !0;
  try {
    return Ns(e, t, n);
  } finally {
    Ll = !1, (on !== null || un !== null) && (_s(), xs());
  }
}
function Wn(e, t) {
  var n = e.stateNode;
  if (n === null)
    return null;
  var r = hl(n);
  if (r === null)
    return null;
  n = r[t];
  e:
    switch (t) {
      case "onClick":
      case "onClickCapture":
      case "onDoubleClick":
      case "onDoubleClickCapture":
      case "onMouseDown":
      case "onMouseDownCapture":
      case "onMouseMove":
      case "onMouseMoveCapture":
      case "onMouseUp":
      case "onMouseUpCapture":
      case "onMouseEnter":
        (r = !r.disabled) || (e = e.type, r = !(e === "button" || e === "input" || e === "select" || e === "textarea")), e = !r;
        break e;
      default:
        e = !1;
    }
  if (e)
    return null;
  if (n && typeof n != "function")
    throw Error(g(231, t, typeof n));
  return n;
}
var po = !1;
if (nt)
  try {
    var En = {};
    Object.defineProperty(En, "passive", { get: function() {
      po = !0;
    } }), window.addEventListener("test", En, En), window.removeEventListener("test", En, En);
  } catch {
    po = !1;
  }
function Wc(e, t, n, r, l, o, i, u, s) {
  var c = Array.prototype.slice.call(arguments, 3);
  try {
    t.apply(n, c);
  } catch (m) {
    this.onError(m);
  }
}
var Dn = !1, Vr = null, Br = !1, mo = null, Kc = { onError: function(e) {
  Dn = !0, Vr = e;
} };
function Yc(e, t, n, r, l, o, i, u, s) {
  Dn = !1, Vr = null, Wc.apply(Kc, arguments);
}
function Xc(e, t, n, r, l, o, i, u, s) {
  if (Yc.apply(this, arguments), Dn) {
    if (Dn) {
      var c = Vr;
      Dn = !1, Vr = null;
    } else
      throw Error(g(198));
    Br || (Br = !0, mo = c);
  }
}
function Bt(e) {
  var t = e, n = e;
  if (e.alternate)
    for (; t.return; )
      t = t.return;
  else {
    e = t;
    do
      t = e, t.flags & 4098 && (n = t.return), e = t.return;
    while (e);
  }
  return t.tag === 3 ? n : null;
}
function zs(e) {
  if (e.tag === 13) {
    var t = e.memoizedState;
    if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null)
      return t.dehydrated;
  }
  return null;
}
function Zi(e) {
  if (Bt(e) !== e)
    throw Error(g(188));
}
function Gc(e) {
  var t = e.alternate;
  if (!t) {
    if (t = Bt(e), t === null)
      throw Error(g(188));
    return t !== e ? null : e;
  }
  for (var n = e, r = t; ; ) {
    var l = n.return;
    if (l === null)
      break;
    var o = l.alternate;
    if (o === null) {
      if (r = l.return, r !== null) {
        n = r;
        continue;
      }
      break;
    }
    if (l.child === o.child) {
      for (o = l.child; o; ) {
        if (o === n)
          return Zi(l), e;
        if (o === r)
          return Zi(l), t;
        o = o.sibling;
      }
      throw Error(g(188));
    }
    if (n.return !== r.return)
      n = l, r = o;
    else {
      for (var i = !1, u = l.child; u; ) {
        if (u === n) {
          i = !0, n = l, r = o;
          break;
        }
        if (u === r) {
          i = !0, r = l, n = o;
          break;
        }
        u = u.sibling;
      }
      if (!i) {
        for (u = o.child; u; ) {
          if (u === n) {
            i = !0, n = o, r = l;
            break;
          }
          if (u === r) {
            i = !0, r = o, n = l;
            break;
          }
          u = u.sibling;
        }
        if (!i)
          throw Error(g(189));
      }
    }
    if (n.alternate !== r)
      throw Error(g(190));
  }
  if (n.tag !== 3)
    throw Error(g(188));
  return n.stateNode.current === n ? e : t;
}
function Ts(e) {
  return e = Gc(e), e !== null ? Ls(e) : null;
}
function Ls(e) {
  if (e.tag === 5 || e.tag === 6)
    return e;
  for (e = e.child; e !== null; ) {
    var t = Ls(e);
    if (t !== null)
      return t;
    e = e.sibling;
  }
  return null;
}
var Rs = _e.unstable_scheduleCallback, Ji = _e.unstable_cancelCallback, Zc = _e.unstable_shouldYield, Jc = _e.unstable_requestPaint, q = _e.unstable_now, qc = _e.unstable_getCurrentPriorityLevel, ni = _e.unstable_ImmediatePriority, Ms = _e.unstable_UserBlockingPriority, Hr = _e.unstable_NormalPriority, bc = _e.unstable_LowPriority, Is = _e.unstable_IdlePriority, fl = null, Xe = null;
function ef(e) {
  if (Xe && typeof Xe.onCommitFiberRoot == "function")
    try {
      Xe.onCommitFiberRoot(fl, e, void 0, (e.current.flags & 128) === 128);
    } catch {
    }
}
var Ae = Math.clz32 ? Math.clz32 : rf, tf = Math.log, nf = Math.LN2;
function rf(e) {
  return e >>>= 0, e === 0 ? 32 : 31 - (tf(e) / nf | 0) | 0;
}
var hr = 64, vr = 4194304;
function Mn(e) {
  switch (e & -e) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 4:
      return 4;
    case 8:
      return 8;
    case 16:
      return 16;
    case 32:
      return 32;
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return e & 4194240;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
      return e & 130023424;
    case 134217728:
      return 134217728;
    case 268435456:
      return 268435456;
    case 536870912:
      return 536870912;
    case 1073741824:
      return 1073741824;
    default:
      return e;
  }
}
function Qr(e, t) {
  var n = e.pendingLanes;
  if (n === 0)
    return 0;
  var r = 0, l = e.suspendedLanes, o = e.pingedLanes, i = n & 268435455;
  if (i !== 0) {
    var u = i & ~l;
    u !== 0 ? r = Mn(u) : (o &= i, o !== 0 && (r = Mn(o)));
  } else
    i = n & ~l, i !== 0 ? r = Mn(i) : o !== 0 && (r = Mn(o));
  if (r === 0)
    return 0;
  if (t !== 0 && t !== r && !(t & l) && (l = r & -r, o = t & -t, l >= o || l === 16 && (o & 4194240) !== 0))
    return t;
  if (r & 4 && (r |= n & 16), t = e.entangledLanes, t !== 0)
    for (e = e.entanglements, t &= r; 0 < t; )
      n = 31 - Ae(t), l = 1 << n, r |= e[n], t &= ~l;
  return r;
}
function lf(e, t) {
  switch (e) {
    case 1:
    case 2:
    case 4:
      return t + 250;
    case 8:
    case 16:
    case 32:
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return t + 5e3;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
      return -1;
    case 134217728:
    case 268435456:
    case 536870912:
    case 1073741824:
      return -1;
    default:
      return -1;
  }
}
function of(e, t) {
  for (var n = e.suspendedLanes, r = e.pingedLanes, l = e.expirationTimes, o = e.pendingLanes; 0 < o; ) {
    var i = 31 - Ae(o), u = 1 << i, s = l[i];
    s === -1 ? (!(u & n) || u & r) && (l[i] = lf(u, t)) : s <= t && (e.expiredLanes |= u), o &= ~u;
  }
}
function ho(e) {
  return e = e.pendingLanes & -1073741825, e !== 0 ? e : e & 1073741824 ? 1073741824 : 0;
}
function Os() {
  var e = hr;
  return hr <<= 1, !(hr & 4194240) && (hr = 64), e;
}
function Rl(e) {
  for (var t = [], n = 0; 31 > n; n++)
    t.push(e);
  return t;
}
function ur(e, t, n) {
  e.pendingLanes |= t, t !== 536870912 && (e.suspendedLanes = 0, e.pingedLanes = 0), e = e.eventTimes, t = 31 - Ae(t), e[t] = n;
}
function uf(e, t) {
  var n = e.pendingLanes & ~t;
  e.pendingLanes = t, e.suspendedLanes = 0, e.pingedLanes = 0, e.expiredLanes &= t, e.mutableReadLanes &= t, e.entangledLanes &= t, t = e.entanglements;
  var r = e.eventTimes;
  for (e = e.expirationTimes; 0 < n; ) {
    var l = 31 - Ae(n), o = 1 << l;
    t[l] = 0, r[l] = -1, e[l] = -1, n &= ~o;
  }
}
function ri(e, t) {
  var n = e.entangledLanes |= t;
  for (e = e.entanglements; n; ) {
    var r = 31 - Ae(n), l = 1 << r;
    l & t | e[r] & t && (e[r] |= t), n &= ~l;
  }
}
var A = 0;
function Ds(e) {
  return e &= -e, 1 < e ? 4 < e ? e & 268435455 ? 16 : 536870912 : 4 : 1;
}
var Fs, li, js, $s, Us, vo = !1, yr = [], mt = null, ht = null, vt = null, Kn = /* @__PURE__ */ new Map(), Yn = /* @__PURE__ */ new Map(), ct = [], sf = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
function qi(e, t) {
  switch (e) {
    case "focusin":
    case "focusout":
      mt = null;
      break;
    case "dragenter":
    case "dragleave":
      ht = null;
      break;
    case "mouseover":
    case "mouseout":
      vt = null;
      break;
    case "pointerover":
    case "pointerout":
      Kn.delete(t.pointerId);
      break;
    case "gotpointercapture":
    case "lostpointercapture":
      Yn.delete(t.pointerId);
  }
}
function Cn(e, t, n, r, l, o) {
  return e === null || e.nativeEvent !== o ? (e = { blockedOn: t, domEventName: n, eventSystemFlags: r, nativeEvent: o, targetContainers: [l] }, t !== null && (t = ar(t), t !== null && li(t)), e) : (e.eventSystemFlags |= r, t = e.targetContainers, l !== null && t.indexOf(l) === -1 && t.push(l), e);
}
function af(e, t, n, r, l) {
  switch (t) {
    case "focusin":
      return mt = Cn(mt, e, t, n, r, l), !0;
    case "dragenter":
      return ht = Cn(ht, e, t, n, r, l), !0;
    case "mouseover":
      return vt = Cn(vt, e, t, n, r, l), !0;
    case "pointerover":
      var o = l.pointerId;
      return Kn.set(o, Cn(Kn.get(o) || null, e, t, n, r, l)), !0;
    case "gotpointercapture":
      return o = l.pointerId, Yn.set(o, Cn(Yn.get(o) || null, e, t, n, r, l)), !0;
  }
  return !1;
}
function As(e) {
  var t = Rt(e.target);
  if (t !== null) {
    var n = Bt(t);
    if (n !== null) {
      if (t = n.tag, t === 13) {
        if (t = zs(n), t !== null) {
          e.blockedOn = t, Us(e.priority, function() {
            js(n);
          });
          return;
        }
      } else if (t === 3 && n.stateNode.current.memoizedState.isDehydrated) {
        e.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
        return;
      }
    }
  }
  e.blockedOn = null;
}
function Lr(e) {
  if (e.blockedOn !== null)
    return !1;
  for (var t = e.targetContainers; 0 < t.length; ) {
    var n = yo(e.domEventName, e.eventSystemFlags, t[0], e.nativeEvent);
    if (n === null) {
      n = e.nativeEvent;
      var r = new n.constructor(n.type, n);
      co = r, n.target.dispatchEvent(r), co = null;
    } else
      return t = ar(n), t !== null && li(t), e.blockedOn = n, !1;
    t.shift();
  }
  return !0;
}
function bi(e, t, n) {
  Lr(e) && n.delete(t);
}
function cf() {
  vo = !1, mt !== null && Lr(mt) && (mt = null), ht !== null && Lr(ht) && (ht = null), vt !== null && Lr(vt) && (vt = null), Kn.forEach(bi), Yn.forEach(bi);
}
function xn(e, t) {
  e.blockedOn === t && (e.blockedOn = null, vo || (vo = !0, _e.unstable_scheduleCallback(_e.unstable_NormalPriority, cf)));
}
function Xn(e) {
  function t(l) {
    return xn(l, e);
  }
  if (0 < yr.length) {
    xn(yr[0], e);
    for (var n = 1; n < yr.length; n++) {
      var r = yr[n];
      r.blockedOn === e && (r.blockedOn = null);
    }
  }
  for (mt !== null && xn(mt, e), ht !== null && xn(ht, e), vt !== null && xn(vt, e), Kn.forEach(t), Yn.forEach(t), n = 0; n < ct.length; n++)
    r = ct[n], r.blockedOn === e && (r.blockedOn = null);
  for (; 0 < ct.length && (n = ct[0], n.blockedOn === null); )
    As(n), n.blockedOn === null && ct.shift();
}
var sn = it.ReactCurrentBatchConfig, Wr = !0;
function ff(e, t, n, r) {
  var l = A, o = sn.transition;
  sn.transition = null;
  try {
    A = 1, oi(e, t, n, r);
  } finally {
    A = l, sn.transition = o;
  }
}
function df(e, t, n, r) {
  var l = A, o = sn.transition;
  sn.transition = null;
  try {
    A = 4, oi(e, t, n, r);
  } finally {
    A = l, sn.transition = o;
  }
}
function oi(e, t, n, r) {
  if (Wr) {
    var l = yo(e, t, n, r);
    if (l === null)
      Vl(e, t, r, Kr, n), qi(e, r);
    else if (af(l, e, t, n, r))
      r.stopPropagation();
    else if (qi(e, r), t & 4 && -1 < sf.indexOf(e)) {
      for (; l !== null; ) {
        var o = ar(l);
        if (o !== null && Fs(o), o = yo(e, t, n, r), o === null && Vl(e, t, r, Kr, n), o === l)
          break;
        l = o;
      }
      l !== null && r.stopPropagation();
    } else
      Vl(e, t, r, null, n);
  }
}
var Kr = null;
function yo(e, t, n, r) {
  if (Kr = null, e = ti(r), e = Rt(e), e !== null)
    if (t = Bt(e), t === null)
      e = null;
    else if (n = t.tag, n === 13) {
      if (e = zs(t), e !== null)
        return e;
      e = null;
    } else if (n === 3) {
      if (t.stateNode.current.memoizedState.isDehydrated)
        return t.tag === 3 ? t.stateNode.containerInfo : null;
      e = null;
    } else
      t !== e && (e = null);
  return Kr = e, null;
}
function Vs(e) {
  switch (e) {
    case "cancel":
    case "click":
    case "close":
    case "contextmenu":
    case "copy":
    case "cut":
    case "auxclick":
    case "dblclick":
    case "dragend":
    case "dragstart":
    case "drop":
    case "focusin":
    case "focusout":
    case "input":
    case "invalid":
    case "keydown":
    case "keypress":
    case "keyup":
    case "mousedown":
    case "mouseup":
    case "paste":
    case "pause":
    case "play":
    case "pointercancel":
    case "pointerdown":
    case "pointerup":
    case "ratechange":
    case "reset":
    case "resize":
    case "seeked":
    case "submit":
    case "touchcancel":
    case "touchend":
    case "touchstart":
    case "volumechange":
    case "change":
    case "selectionchange":
    case "textInput":
    case "compositionstart":
    case "compositionend":
    case "compositionupdate":
    case "beforeblur":
    case "afterblur":
    case "beforeinput":
    case "blur":
    case "fullscreenchange":
    case "focus":
    case "hashchange":
    case "popstate":
    case "select":
    case "selectstart":
      return 1;
    case "drag":
    case "dragenter":
    case "dragexit":
    case "dragleave":
    case "dragover":
    case "mousemove":
    case "mouseout":
    case "mouseover":
    case "pointermove":
    case "pointerout":
    case "pointerover":
    case "scroll":
    case "toggle":
    case "touchmove":
    case "wheel":
    case "mouseenter":
    case "mouseleave":
    case "pointerenter":
    case "pointerleave":
      return 4;
    case "message":
      switch (qc()) {
        case ni:
          return 1;
        case Ms:
          return 4;
        case Hr:
        case bc:
          return 16;
        case Is:
          return 536870912;
        default:
          return 16;
      }
    default:
      return 16;
  }
}
var dt = null, ii = null, Rr = null;
function Bs() {
  if (Rr)
    return Rr;
  var e, t = ii, n = t.length, r, l = "value" in dt ? dt.value : dt.textContent, o = l.length;
  for (e = 0; e < n && t[e] === l[e]; e++)
    ;
  var i = n - e;
  for (r = 1; r <= i && t[n - r] === l[o - r]; r++)
    ;
  return Rr = l.slice(e, 1 < r ? 1 - r : void 0);
}
function Mr(e) {
  var t = e.keyCode;
  return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
}
function gr() {
  return !0;
}
function eu() {
  return !1;
}
function ze(e) {
  function t(n, r, l, o, i) {
    this._reactName = n, this._targetInst = l, this.type = r, this.nativeEvent = o, this.target = i, this.currentTarget = null;
    for (var u in e)
      e.hasOwnProperty(u) && (n = e[u], this[u] = n ? n(o) : o[u]);
    return this.isDefaultPrevented = (o.defaultPrevented != null ? o.defaultPrevented : o.returnValue === !1) ? gr : eu, this.isPropagationStopped = eu, this;
  }
  return Z(t.prototype, { preventDefault: function() {
    this.defaultPrevented = !0;
    var n = this.nativeEvent;
    n && (n.preventDefault ? n.preventDefault() : typeof n.returnValue != "unknown" && (n.returnValue = !1), this.isDefaultPrevented = gr);
  }, stopPropagation: function() {
    var n = this.nativeEvent;
    n && (n.stopPropagation ? n.stopPropagation() : typeof n.cancelBubble != "unknown" && (n.cancelBubble = !0), this.isPropagationStopped = gr);
  }, persist: function() {
  }, isPersistent: gr }), t;
}
var wn = { eventPhase: 0, bubbles: 0, cancelable: 0, timeStamp: function(e) {
  return e.timeStamp || Date.now();
}, defaultPrevented: 0, isTrusted: 0 }, ui = ze(wn), sr = Z({}, wn, { view: 0, detail: 0 }), pf = ze(sr), Ml, Il, Nn, dl = Z({}, sr, { screenX: 0, screenY: 0, clientX: 0, clientY: 0, pageX: 0, pageY: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, getModifierState: si, button: 0, buttons: 0, relatedTarget: function(e) {
  return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
}, movementX: function(e) {
  return "movementX" in e ? e.movementX : (e !== Nn && (Nn && e.type === "mousemove" ? (Ml = e.screenX - Nn.screenX, Il = e.screenY - Nn.screenY) : Il = Ml = 0, Nn = e), Ml);
}, movementY: function(e) {
  return "movementY" in e ? e.movementY : Il;
} }), tu = ze(dl), mf = Z({}, dl, { dataTransfer: 0 }), hf = ze(mf), vf = Z({}, sr, { relatedTarget: 0 }), Ol = ze(vf), yf = Z({}, wn, { animationName: 0, elapsedTime: 0, pseudoElement: 0 }), gf = ze(yf), wf = Z({}, wn, { clipboardData: function(e) {
  return "clipboardData" in e ? e.clipboardData : window.clipboardData;
} }), kf = ze(wf), Sf = Z({}, wn, { data: 0 }), nu = ze(Sf), Ef = {
  Esc: "Escape",
  Spacebar: " ",
  Left: "ArrowLeft",
  Up: "ArrowUp",
  Right: "ArrowRight",
  Down: "ArrowDown",
  Del: "Delete",
  Win: "OS",
  Menu: "ContextMenu",
  Apps: "ContextMenu",
  Scroll: "ScrollLock",
  MozPrintableKey: "Unidentified"
}, Cf = {
  8: "Backspace",
  9: "Tab",
  12: "Clear",
  13: "Enter",
  16: "Shift",
  17: "Control",
  18: "Alt",
  19: "Pause",
  20: "CapsLock",
  27: "Escape",
  32: " ",
  33: "PageUp",
  34: "PageDown",
  35: "End",
  36: "Home",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
  45: "Insert",
  46: "Delete",
  112: "F1",
  113: "F2",
  114: "F3",
  115: "F4",
  116: "F5",
  117: "F6",
  118: "F7",
  119: "F8",
  120: "F9",
  121: "F10",
  122: "F11",
  123: "F12",
  144: "NumLock",
  145: "ScrollLock",
  224: "Meta"
}, xf = { Alt: "altKey", Control: "ctrlKey", Meta: "metaKey", Shift: "shiftKey" };
function Nf(e) {
  var t = this.nativeEvent;
  return t.getModifierState ? t.getModifierState(e) : (e = xf[e]) ? !!t[e] : !1;
}
function si() {
  return Nf;
}
var _f = Z({}, sr, { key: function(e) {
  if (e.key) {
    var t = Ef[e.key] || e.key;
    if (t !== "Unidentified")
      return t;
  }
  return e.type === "keypress" ? (e = Mr(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? Cf[e.keyCode] || "Unidentified" : "";
}, code: 0, location: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, repeat: 0, locale: 0, getModifierState: si, charCode: function(e) {
  return e.type === "keypress" ? Mr(e) : 0;
}, keyCode: function(e) {
  return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
}, which: function(e) {
  return e.type === "keypress" ? Mr(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
} }), Pf = ze(_f), zf = Z({}, dl, { pointerId: 0, width: 0, height: 0, pressure: 0, tangentialPressure: 0, tiltX: 0, tiltY: 0, twist: 0, pointerType: 0, isPrimary: 0 }), ru = ze(zf), Tf = Z({}, sr, { touches: 0, targetTouches: 0, changedTouches: 0, altKey: 0, metaKey: 0, ctrlKey: 0, shiftKey: 0, getModifierState: si }), Lf = ze(Tf), Rf = Z({}, wn, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 }), Mf = ze(Rf), If = Z({}, dl, {
  deltaX: function(e) {
    return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
  },
  deltaY: function(e) {
    return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
  },
  deltaZ: 0,
  deltaMode: 0
}), Of = ze(If), Df = [9, 13, 27, 32], ai = nt && "CompositionEvent" in window, Fn = null;
nt && "documentMode" in document && (Fn = document.documentMode);
var Ff = nt && "TextEvent" in window && !Fn, Hs = nt && (!ai || Fn && 8 < Fn && 11 >= Fn), lu = String.fromCharCode(32), ou = !1;
function Qs(e, t) {
  switch (e) {
    case "keyup":
      return Df.indexOf(t.keyCode) !== -1;
    case "keydown":
      return t.keyCode !== 229;
    case "keypress":
    case "mousedown":
    case "focusout":
      return !0;
    default:
      return !1;
  }
}
function Ws(e) {
  return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
}
var Xt = !1;
function jf(e, t) {
  switch (e) {
    case "compositionend":
      return Ws(t);
    case "keypress":
      return t.which !== 32 ? null : (ou = !0, lu);
    case "textInput":
      return e = t.data, e === lu && ou ? null : e;
    default:
      return null;
  }
}
function $f(e, t) {
  if (Xt)
    return e === "compositionend" || !ai && Qs(e, t) ? (e = Bs(), Rr = ii = dt = null, Xt = !1, e) : null;
  switch (e) {
    case "paste":
      return null;
    case "keypress":
      if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
        if (t.char && 1 < t.char.length)
          return t.char;
        if (t.which)
          return String.fromCharCode(t.which);
      }
      return null;
    case "compositionend":
      return Hs && t.locale !== "ko" ? null : t.data;
    default:
      return null;
  }
}
var Uf = { color: !0, date: !0, datetime: !0, "datetime-local": !0, email: !0, month: !0, number: !0, password: !0, range: !0, search: !0, tel: !0, text: !0, time: !0, url: !0, week: !0 };
function iu(e) {
  var t = e && e.nodeName && e.nodeName.toLowerCase();
  return t === "input" ? !!Uf[e.type] : t === "textarea";
}
function Ks(e, t, n, r) {
  Cs(r), t = Yr(t, "onChange"), 0 < t.length && (n = new ui("onChange", "change", null, n, r), e.push({ event: n, listeners: t }));
}
var jn = null, Gn = null;
function Af(e) {
  ra(e, 0);
}
function pl(e) {
  var t = Jt(e);
  if (vs(t))
    return e;
}
function Vf(e, t) {
  if (e === "change")
    return t;
}
var Ys = !1;
if (nt) {
  var Dl;
  if (nt) {
    var Fl = "oninput" in document;
    if (!Fl) {
      var uu = document.createElement("div");
      uu.setAttribute("oninput", "return;"), Fl = typeof uu.oninput == "function";
    }
    Dl = Fl;
  } else
    Dl = !1;
  Ys = Dl && (!document.documentMode || 9 < document.documentMode);
}
function su() {
  jn && (jn.detachEvent("onpropertychange", Xs), Gn = jn = null);
}
function Xs(e) {
  if (e.propertyName === "value" && pl(Gn)) {
    var t = [];
    Ks(t, Gn, e, ti(e)), Ps(Af, t);
  }
}
function Bf(e, t, n) {
  e === "focusin" ? (su(), jn = t, Gn = n, jn.attachEvent("onpropertychange", Xs)) : e === "focusout" && su();
}
function Hf(e) {
  if (e === "selectionchange" || e === "keyup" || e === "keydown")
    return pl(Gn);
}
function Qf(e, t) {
  if (e === "click")
    return pl(t);
}
function Wf(e, t) {
  if (e === "input" || e === "change")
    return pl(t);
}
function Kf(e, t) {
  return e === t && (e !== 0 || 1 / e === 1 / t) || e !== e && t !== t;
}
var Be = typeof Object.is == "function" ? Object.is : Kf;
function Zn(e, t) {
  if (Be(e, t))
    return !0;
  if (typeof e != "object" || e === null || typeof t != "object" || t === null)
    return !1;
  var n = Object.keys(e), r = Object.keys(t);
  if (n.length !== r.length)
    return !1;
  for (r = 0; r < n.length; r++) {
    var l = n[r];
    if (!ql.call(t, l) || !Be(e[l], t[l]))
      return !1;
  }
  return !0;
}
function au(e) {
  for (; e && e.firstChild; )
    e = e.firstChild;
  return e;
}
function cu(e, t) {
  var n = au(e);
  e = 0;
  for (var r; n; ) {
    if (n.nodeType === 3) {
      if (r = e + n.textContent.length, e <= t && r >= t)
        return { node: n, offset: t - e };
      e = r;
    }
    e: {
      for (; n; ) {
        if (n.nextSibling) {
          n = n.nextSibling;
          break e;
        }
        n = n.parentNode;
      }
      n = void 0;
    }
    n = au(n);
  }
}
function Gs(e, t) {
  return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? Gs(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
}
function Zs() {
  for (var e = window, t = Ar(); t instanceof e.HTMLIFrameElement; ) {
    try {
      var n = typeof t.contentWindow.location.href == "string";
    } catch {
      n = !1;
    }
    if (n)
      e = t.contentWindow;
    else
      break;
    t = Ar(e.document);
  }
  return t;
}
function ci(e) {
  var t = e && e.nodeName && e.nodeName.toLowerCase();
  return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
}
function Yf(e) {
  var t = Zs(), n = e.focusedElem, r = e.selectionRange;
  if (t !== n && n && n.ownerDocument && Gs(n.ownerDocument.documentElement, n)) {
    if (r !== null && ci(n)) {
      if (t = r.start, e = r.end, e === void 0 && (e = t), "selectionStart" in n)
        n.selectionStart = t, n.selectionEnd = Math.min(e, n.value.length);
      else if (e = (t = n.ownerDocument || document) && t.defaultView || window, e.getSelection) {
        e = e.getSelection();
        var l = n.textContent.length, o = Math.min(r.start, l);
        r = r.end === void 0 ? o : Math.min(r.end, l), !e.extend && o > r && (l = r, r = o, o = l), l = cu(n, o);
        var i = cu(
          n,
          r
        );
        l && i && (e.rangeCount !== 1 || e.anchorNode !== l.node || e.anchorOffset !== l.offset || e.focusNode !== i.node || e.focusOffset !== i.offset) && (t = t.createRange(), t.setStart(l.node, l.offset), e.removeAllRanges(), o > r ? (e.addRange(t), e.extend(i.node, i.offset)) : (t.setEnd(i.node, i.offset), e.addRange(t)));
      }
    }
    for (t = [], e = n; e = e.parentNode; )
      e.nodeType === 1 && t.push({ element: e, left: e.scrollLeft, top: e.scrollTop });
    for (typeof n.focus == "function" && n.focus(), n = 0; n < t.length; n++)
      e = t[n], e.element.scrollLeft = e.left, e.element.scrollTop = e.top;
  }
}
var Xf = nt && "documentMode" in document && 11 >= document.documentMode, Gt = null, go = null, $n = null, wo = !1;
function fu(e, t, n) {
  var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
  wo || Gt == null || Gt !== Ar(r) || (r = Gt, "selectionStart" in r && ci(r) ? r = { start: r.selectionStart, end: r.selectionEnd } : (r = (r.ownerDocument && r.ownerDocument.defaultView || window).getSelection(), r = { anchorNode: r.anchorNode, anchorOffset: r.anchorOffset, focusNode: r.focusNode, focusOffset: r.focusOffset }), $n && Zn($n, r) || ($n = r, r = Yr(go, "onSelect"), 0 < r.length && (t = new ui("onSelect", "select", null, t, n), e.push({ event: t, listeners: r }), t.target = Gt)));
}
function wr(e, t) {
  var n = {};
  return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
}
var Zt = { animationend: wr("Animation", "AnimationEnd"), animationiteration: wr("Animation", "AnimationIteration"), animationstart: wr("Animation", "AnimationStart"), transitionend: wr("Transition", "TransitionEnd") }, jl = {}, Js = {};
nt && (Js = document.createElement("div").style, "AnimationEvent" in window || (delete Zt.animationend.animation, delete Zt.animationiteration.animation, delete Zt.animationstart.animation), "TransitionEvent" in window || delete Zt.transitionend.transition);
function ml(e) {
  if (jl[e])
    return jl[e];
  if (!Zt[e])
    return e;
  var t = Zt[e], n;
  for (n in t)
    if (t.hasOwnProperty(n) && n in Js)
      return jl[e] = t[n];
  return e;
}
var qs = ml("animationend"), bs = ml("animationiteration"), ea = ml("animationstart"), ta = ml("transitionend"), na = /* @__PURE__ */ new Map(), du = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
function xt(e, t) {
  na.set(e, t), Vt(t, [e]);
}
for (var $l = 0; $l < du.length; $l++) {
  var Ul = du[$l], Gf = Ul.toLowerCase(), Zf = Ul[0].toUpperCase() + Ul.slice(1);
  xt(Gf, "on" + Zf);
}
xt(qs, "onAnimationEnd");
xt(bs, "onAnimationIteration");
xt(ea, "onAnimationStart");
xt("dblclick", "onDoubleClick");
xt("focusin", "onFocus");
xt("focusout", "onBlur");
xt(ta, "onTransitionEnd");
fn("onMouseEnter", ["mouseout", "mouseover"]);
fn("onMouseLeave", ["mouseout", "mouseover"]);
fn("onPointerEnter", ["pointerout", "pointerover"]);
fn("onPointerLeave", ["pointerout", "pointerover"]);
Vt("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" "));
Vt("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));
Vt("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]);
Vt("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" "));
Vt("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" "));
Vt("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
var In = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), Jf = new Set("cancel close invalid load scroll toggle".split(" ").concat(In));
function pu(e, t, n) {
  var r = e.type || "unknown-event";
  e.currentTarget = n, Xc(r, t, void 0, e), e.currentTarget = null;
}
function ra(e, t) {
  t = (t & 4) !== 0;
  for (var n = 0; n < e.length; n++) {
    var r = e[n], l = r.event;
    r = r.listeners;
    e: {
      var o = void 0;
      if (t)
        for (var i = r.length - 1; 0 <= i; i--) {
          var u = r[i], s = u.instance, c = u.currentTarget;
          if (u = u.listener, s !== o && l.isPropagationStopped())
            break e;
          pu(l, u, c), o = s;
        }
      else
        for (i = 0; i < r.length; i++) {
          if (u = r[i], s = u.instance, c = u.currentTarget, u = u.listener, s !== o && l.isPropagationStopped())
            break e;
          pu(l, u, c), o = s;
        }
    }
  }
  if (Br)
    throw e = mo, Br = !1, mo = null, e;
}
function H(e, t) {
  var n = t[xo];
  n === void 0 && (n = t[xo] = /* @__PURE__ */ new Set());
  var r = e + "__bubble";
  n.has(r) || (la(t, e, 2, !1), n.add(r));
}
function Al(e, t, n) {
  var r = 0;
  t && (r |= 4), la(n, e, r, t);
}
var kr = "_reactListening" + Math.random().toString(36).slice(2);
function Jn(e) {
  if (!e[kr]) {
    e[kr] = !0, fs.forEach(function(n) {
      n !== "selectionchange" && (Jf.has(n) || Al(n, !1, e), Al(n, !0, e));
    });
    var t = e.nodeType === 9 ? e : e.ownerDocument;
    t === null || t[kr] || (t[kr] = !0, Al("selectionchange", !1, t));
  }
}
function la(e, t, n, r) {
  switch (Vs(t)) {
    case 1:
      var l = ff;
      break;
    case 4:
      l = df;
      break;
    default:
      l = oi;
  }
  n = l.bind(null, t, n, e), l = void 0, !po || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (l = !0), r ? l !== void 0 ? e.addEventListener(t, n, { capture: !0, passive: l }) : e.addEventListener(t, n, !0) : l !== void 0 ? e.addEventListener(t, n, { passive: l }) : e.addEventListener(t, n, !1);
}
function Vl(e, t, n, r, l) {
  var o = r;
  if (!(t & 1) && !(t & 2) && r !== null)
    e:
      for (; ; ) {
        if (r === null)
          return;
        var i = r.tag;
        if (i === 3 || i === 4) {
          var u = r.stateNode.containerInfo;
          if (u === l || u.nodeType === 8 && u.parentNode === l)
            break;
          if (i === 4)
            for (i = r.return; i !== null; ) {
              var s = i.tag;
              if ((s === 3 || s === 4) && (s = i.stateNode.containerInfo, s === l || s.nodeType === 8 && s.parentNode === l))
                return;
              i = i.return;
            }
          for (; u !== null; ) {
            if (i = Rt(u), i === null)
              return;
            if (s = i.tag, s === 5 || s === 6) {
              r = o = i;
              continue e;
            }
            u = u.parentNode;
          }
        }
        r = r.return;
      }
  Ps(function() {
    var c = o, m = ti(n), h = [];
    e: {
      var p = na.get(e);
      if (p !== void 0) {
        var w = ui, k = e;
        switch (e) {
          case "keypress":
            if (Mr(n) === 0)
              break e;
          case "keydown":
          case "keyup":
            w = Pf;
            break;
          case "focusin":
            k = "focus", w = Ol;
            break;
          case "focusout":
            k = "blur", w = Ol;
            break;
          case "beforeblur":
          case "afterblur":
            w = Ol;
            break;
          case "click":
            if (n.button === 2)
              break e;
          case "auxclick":
          case "dblclick":
          case "mousedown":
          case "mousemove":
          case "mouseup":
          case "mouseout":
          case "mouseover":
          case "contextmenu":
            w = tu;
            break;
          case "drag":
          case "dragend":
          case "dragenter":
          case "dragexit":
          case "dragleave":
          case "dragover":
          case "dragstart":
          case "drop":
            w = hf;
            break;
          case "touchcancel":
          case "touchend":
          case "touchmove":
          case "touchstart":
            w = Lf;
            break;
          case qs:
          case bs:
          case ea:
            w = gf;
            break;
          case ta:
            w = Mf;
            break;
          case "scroll":
            w = pf;
            break;
          case "wheel":
            w = Of;
            break;
          case "copy":
          case "cut":
          case "paste":
            w = kf;
            break;
          case "gotpointercapture":
          case "lostpointercapture":
          case "pointercancel":
          case "pointerdown":
          case "pointermove":
          case "pointerout":
          case "pointerover":
          case "pointerup":
            w = ru;
        }
        var S = (t & 4) !== 0, U = !S && e === "scroll", f = S ? p !== null ? p + "Capture" : null : p;
        S = [];
        for (var a = c, d; a !== null; ) {
          d = a;
          var y = d.stateNode;
          if (d.tag === 5 && y !== null && (d = y, f !== null && (y = Wn(a, f), y != null && S.push(qn(a, y, d)))), U)
            break;
          a = a.return;
        }
        0 < S.length && (p = new w(p, k, null, n, m), h.push({ event: p, listeners: S }));
      }
    }
    if (!(t & 7)) {
      e: {
        if (p = e === "mouseover" || e === "pointerover", w = e === "mouseout" || e === "pointerout", p && n !== co && (k = n.relatedTarget || n.fromElement) && (Rt(k) || k[rt]))
          break e;
        if ((w || p) && (p = m.window === m ? m : (p = m.ownerDocument) ? p.defaultView || p.parentWindow : window, w ? (k = n.relatedTarget || n.toElement, w = c, k = k ? Rt(k) : null, k !== null && (U = Bt(k), k !== U || k.tag !== 5 && k.tag !== 6) && (k = null)) : (w = null, k = c), w !== k)) {
          if (S = tu, y = "onMouseLeave", f = "onMouseEnter", a = "mouse", (e === "pointerout" || e === "pointerover") && (S = ru, y = "onPointerLeave", f = "onPointerEnter", a = "pointer"), U = w == null ? p : Jt(w), d = k == null ? p : Jt(k), p = new S(y, a + "leave", w, n, m), p.target = U, p.relatedTarget = d, y = null, Rt(m) === c && (S = new S(f, a + "enter", k, n, m), S.target = d, S.relatedTarget = U, y = S), U = y, w && k)
            t: {
              for (S = w, f = k, a = 0, d = S; d; d = Wt(d))
                a++;
              for (d = 0, y = f; y; y = Wt(y))
                d++;
              for (; 0 < a - d; )
                S = Wt(S), a--;
              for (; 0 < d - a; )
                f = Wt(f), d--;
              for (; a--; ) {
                if (S === f || f !== null && S === f.alternate)
                  break t;
                S = Wt(S), f = Wt(f);
              }
              S = null;
            }
          else
            S = null;
          w !== null && mu(h, p, w, S, !1), k !== null && U !== null && mu(h, U, k, S, !0);
        }
      }
      e: {
        if (p = c ? Jt(c) : window, w = p.nodeName && p.nodeName.toLowerCase(), w === "select" || w === "input" && p.type === "file")
          var E = Vf;
        else if (iu(p))
          if (Ys)
            E = Wf;
          else {
            E = Hf;
            var N = Bf;
          }
        else
          (w = p.nodeName) && w.toLowerCase() === "input" && (p.type === "checkbox" || p.type === "radio") && (E = Qf);
        if (E && (E = E(e, c))) {
          Ks(h, E, n, m);
          break e;
        }
        N && N(e, p, c), e === "focusout" && (N = p._wrapperState) && N.controlled && p.type === "number" && oo(p, "number", p.value);
      }
      switch (N = c ? Jt(c) : window, e) {
        case "focusin":
          (iu(N) || N.contentEditable === "true") && (Gt = N, go = c, $n = null);
          break;
        case "focusout":
          $n = go = Gt = null;
          break;
        case "mousedown":
          wo = !0;
          break;
        case "contextmenu":
        case "mouseup":
        case "dragend":
          wo = !1, fu(h, n, m);
          break;
        case "selectionchange":
          if (Xf)
            break;
        case "keydown":
        case "keyup":
          fu(h, n, m);
      }
      var _;
      if (ai)
        e: {
          switch (e) {
            case "compositionstart":
              var P = "onCompositionStart";
              break e;
            case "compositionend":
              P = "onCompositionEnd";
              break e;
            case "compositionupdate":
              P = "onCompositionUpdate";
              break e;
          }
          P = void 0;
        }
      else
        Xt ? Qs(e, n) && (P = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (P = "onCompositionStart");
      P && (Hs && n.locale !== "ko" && (Xt || P !== "onCompositionStart" ? P === "onCompositionEnd" && Xt && (_ = Bs()) : (dt = m, ii = "value" in dt ? dt.value : dt.textContent, Xt = !0)), N = Yr(c, P), 0 < N.length && (P = new nu(P, e, null, n, m), h.push({ event: P, listeners: N }), _ ? P.data = _ : (_ = Ws(n), _ !== null && (P.data = _)))), (_ = Ff ? jf(e, n) : $f(e, n)) && (c = Yr(c, "onBeforeInput"), 0 < c.length && (m = new nu("onBeforeInput", "beforeinput", null, n, m), h.push({ event: m, listeners: c }), m.data = _));
    }
    ra(h, t);
  });
}
function qn(e, t, n) {
  return { instance: e, listener: t, currentTarget: n };
}
function Yr(e, t) {
  for (var n = t + "Capture", r = []; e !== null; ) {
    var l = e, o = l.stateNode;
    l.tag === 5 && o !== null && (l = o, o = Wn(e, n), o != null && r.unshift(qn(e, o, l)), o = Wn(e, t), o != null && r.push(qn(e, o, l))), e = e.return;
  }
  return r;
}
function Wt(e) {
  if (e === null)
    return null;
  do
    e = e.return;
  while (e && e.tag !== 5);
  return e || null;
}
function mu(e, t, n, r, l) {
  for (var o = t._reactName, i = []; n !== null && n !== r; ) {
    var u = n, s = u.alternate, c = u.stateNode;
    if (s !== null && s === r)
      break;
    u.tag === 5 && c !== null && (u = c, l ? (s = Wn(n, o), s != null && i.unshift(qn(n, s, u))) : l || (s = Wn(n, o), s != null && i.push(qn(n, s, u)))), n = n.return;
  }
  i.length !== 0 && e.push({ event: t, listeners: i });
}
var qf = /\r\n?/g, bf = /\u0000|\uFFFD/g;
function hu(e) {
  return (typeof e == "string" ? e : "" + e).replace(qf, `
`).replace(bf, "");
}
function Sr(e, t, n) {
  if (t = hu(t), hu(e) !== t && n)
    throw Error(g(425));
}
function Xr() {
}
var ko = null, So = null;
function Eo(e, t) {
  return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
}
var Co = typeof setTimeout == "function" ? setTimeout : void 0, ed = typeof clearTimeout == "function" ? clearTimeout : void 0, vu = typeof Promise == "function" ? Promise : void 0, td = typeof queueMicrotask == "function" ? queueMicrotask : typeof vu < "u" ? function(e) {
  return vu.resolve(null).then(e).catch(nd);
} : Co;
function nd(e) {
  setTimeout(function() {
    throw e;
  });
}
function Bl(e, t) {
  var n = t, r = 0;
  do {
    var l = n.nextSibling;
    if (e.removeChild(n), l && l.nodeType === 8)
      if (n = l.data, n === "/$") {
        if (r === 0) {
          e.removeChild(l), Xn(t);
          return;
        }
        r--;
      } else
        n !== "$" && n !== "$?" && n !== "$!" || r++;
    n = l;
  } while (n);
  Xn(t);
}
function yt(e) {
  for (; e != null; e = e.nextSibling) {
    var t = e.nodeType;
    if (t === 1 || t === 3)
      break;
    if (t === 8) {
      if (t = e.data, t === "$" || t === "$!" || t === "$?")
        break;
      if (t === "/$")
        return null;
    }
  }
  return e;
}
function yu(e) {
  e = e.previousSibling;
  for (var t = 0; e; ) {
    if (e.nodeType === 8) {
      var n = e.data;
      if (n === "$" || n === "$!" || n === "$?") {
        if (t === 0)
          return e;
        t--;
      } else
        n === "/$" && t++;
    }
    e = e.previousSibling;
  }
  return null;
}
var kn = Math.random().toString(36).slice(2), Ye = "__reactFiber$" + kn, bn = "__reactProps$" + kn, rt = "__reactContainer$" + kn, xo = "__reactEvents$" + kn, rd = "__reactListeners$" + kn, ld = "__reactHandles$" + kn;
function Rt(e) {
  var t = e[Ye];
  if (t)
    return t;
  for (var n = e.parentNode; n; ) {
    if (t = n[rt] || n[Ye]) {
      if (n = t.alternate, t.child !== null || n !== null && n.child !== null)
        for (e = yu(e); e !== null; ) {
          if (n = e[Ye])
            return n;
          e = yu(e);
        }
      return t;
    }
    e = n, n = e.parentNode;
  }
  return null;
}
function ar(e) {
  return e = e[Ye] || e[rt], !e || e.tag !== 5 && e.tag !== 6 && e.tag !== 13 && e.tag !== 3 ? null : e;
}
function Jt(e) {
  if (e.tag === 5 || e.tag === 6)
    return e.stateNode;
  throw Error(g(33));
}
function hl(e) {
  return e[bn] || null;
}
var No = [], qt = -1;
function Nt(e) {
  return { current: e };
}
function Q(e) {
  0 > qt || (e.current = No[qt], No[qt] = null, qt--);
}
function B(e, t) {
  qt++, No[qt] = e.current, e.current = t;
}
var Ct = {}, pe = Nt(Ct), ke = Nt(!1), Ft = Ct;
function dn(e, t) {
  var n = e.type.contextTypes;
  if (!n)
    return Ct;
  var r = e.stateNode;
  if (r && r.__reactInternalMemoizedUnmaskedChildContext === t)
    return r.__reactInternalMemoizedMaskedChildContext;
  var l = {}, o;
  for (o in n)
    l[o] = t[o];
  return r && (e = e.stateNode, e.__reactInternalMemoizedUnmaskedChildContext = t, e.__reactInternalMemoizedMaskedChildContext = l), l;
}
function Se(e) {
  return e = e.childContextTypes, e != null;
}
function Gr() {
  Q(ke), Q(pe);
}
function gu(e, t, n) {
  if (pe.current !== Ct)
    throw Error(g(168));
  B(pe, t), B(ke, n);
}
function oa(e, t, n) {
  var r = e.stateNode;
  if (t = t.childContextTypes, typeof r.getChildContext != "function")
    return n;
  r = r.getChildContext();
  for (var l in r)
    if (!(l in t))
      throw Error(g(108, Vc(e) || "Unknown", l));
  return Z({}, n, r);
}
function Zr(e) {
  return e = (e = e.stateNode) && e.__reactInternalMemoizedMergedChildContext || Ct, Ft = pe.current, B(pe, e), B(ke, ke.current), !0;
}
function wu(e, t, n) {
  var r = e.stateNode;
  if (!r)
    throw Error(g(169));
  n ? (e = oa(e, t, Ft), r.__reactInternalMemoizedMergedChildContext = e, Q(ke), Q(pe), B(pe, e)) : Q(ke), B(ke, n);
}
var qe = null, vl = !1, Hl = !1;
function ia(e) {
  qe === null ? qe = [e] : qe.push(e);
}
function od(e) {
  vl = !0, ia(e);
}
function _t() {
  if (!Hl && qe !== null) {
    Hl = !0;
    var e = 0, t = A;
    try {
      var n = qe;
      for (A = 1; e < n.length; e++) {
        var r = n[e];
        do
          r = r(!0);
        while (r !== null);
      }
      qe = null, vl = !1;
    } catch (l) {
      throw qe !== null && (qe = qe.slice(e + 1)), Rs(ni, _t), l;
    } finally {
      A = t, Hl = !1;
    }
  }
  return null;
}
var bt = [], en = 0, Jr = null, qr = 0, Le = [], Re = 0, jt = null, be = 1, et = "";
function Tt(e, t) {
  bt[en++] = qr, bt[en++] = Jr, Jr = e, qr = t;
}
function ua(e, t, n) {
  Le[Re++] = be, Le[Re++] = et, Le[Re++] = jt, jt = e;
  var r = be;
  e = et;
  var l = 32 - Ae(r) - 1;
  r &= ~(1 << l), n += 1;
  var o = 32 - Ae(t) + l;
  if (30 < o) {
    var i = l - l % 5;
    o = (r & (1 << i) - 1).toString(32), r >>= i, l -= i, be = 1 << 32 - Ae(t) + l | n << l | r, et = o + e;
  } else
    be = 1 << o | n << l | r, et = e;
}
function fi(e) {
  e.return !== null && (Tt(e, 1), ua(e, 1, 0));
}
function di(e) {
  for (; e === Jr; )
    Jr = bt[--en], bt[en] = null, qr = bt[--en], bt[en] = null;
  for (; e === jt; )
    jt = Le[--Re], Le[Re] = null, et = Le[--Re], Le[Re] = null, be = Le[--Re], Le[Re] = null;
}
var Ne = null, xe = null, K = !1, Ue = null;
function sa(e, t) {
  var n = Me(5, null, null, 0);
  n.elementType = "DELETED", n.stateNode = t, n.return = e, t = e.deletions, t === null ? (e.deletions = [n], e.flags |= 16) : t.push(n);
}
function ku(e, t) {
  switch (e.tag) {
    case 5:
      var n = e.type;
      return t = t.nodeType !== 1 || n.toLowerCase() !== t.nodeName.toLowerCase() ? null : t, t !== null ? (e.stateNode = t, Ne = e, xe = yt(t.firstChild), !0) : !1;
    case 6:
      return t = e.pendingProps === "" || t.nodeType !== 3 ? null : t, t !== null ? (e.stateNode = t, Ne = e, xe = null, !0) : !1;
    case 13:
      return t = t.nodeType !== 8 ? null : t, t !== null ? (n = jt !== null ? { id: be, overflow: et } : null, e.memoizedState = { dehydrated: t, treeContext: n, retryLane: 1073741824 }, n = Me(18, null, null, 0), n.stateNode = t, n.return = e, e.child = n, Ne = e, xe = null, !0) : !1;
    default:
      return !1;
  }
}
function _o(e) {
  return (e.mode & 1) !== 0 && (e.flags & 128) === 0;
}
function Po(e) {
  if (K) {
    var t = xe;
    if (t) {
      var n = t;
      if (!ku(e, t)) {
        if (_o(e))
          throw Error(g(418));
        t = yt(n.nextSibling);
        var r = Ne;
        t && ku(e, t) ? sa(r, n) : (e.flags = e.flags & -4097 | 2, K = !1, Ne = e);
      }
    } else {
      if (_o(e))
        throw Error(g(418));
      e.flags = e.flags & -4097 | 2, K = !1, Ne = e;
    }
  }
}
function Su(e) {
  for (e = e.return; e !== null && e.tag !== 5 && e.tag !== 3 && e.tag !== 13; )
    e = e.return;
  Ne = e;
}
function Er(e) {
  if (e !== Ne)
    return !1;
  if (!K)
    return Su(e), K = !0, !1;
  var t;
  if ((t = e.tag !== 3) && !(t = e.tag !== 5) && (t = e.type, t = t !== "head" && t !== "body" && !Eo(e.type, e.memoizedProps)), t && (t = xe)) {
    if (_o(e))
      throw aa(), Error(g(418));
    for (; t; )
      sa(e, t), t = yt(t.nextSibling);
  }
  if (Su(e), e.tag === 13) {
    if (e = e.memoizedState, e = e !== null ? e.dehydrated : null, !e)
      throw Error(g(317));
    e: {
      for (e = e.nextSibling, t = 0; e; ) {
        if (e.nodeType === 8) {
          var n = e.data;
          if (n === "/$") {
            if (t === 0) {
              xe = yt(e.nextSibling);
              break e;
            }
            t--;
          } else
            n !== "$" && n !== "$!" && n !== "$?" || t++;
        }
        e = e.nextSibling;
      }
      xe = null;
    }
  } else
    xe = Ne ? yt(e.stateNode.nextSibling) : null;
  return !0;
}
function aa() {
  for (var e = xe; e; )
    e = yt(e.nextSibling);
}
function pn() {
  xe = Ne = null, K = !1;
}
function pi(e) {
  Ue === null ? Ue = [e] : Ue.push(e);
}
var id = it.ReactCurrentBatchConfig;
function _n(e, t, n) {
  if (e = n.ref, e !== null && typeof e != "function" && typeof e != "object") {
    if (n._owner) {
      if (n = n._owner, n) {
        if (n.tag !== 1)
          throw Error(g(309));
        var r = n.stateNode;
      }
      if (!r)
        throw Error(g(147, e));
      var l = r, o = "" + e;
      return t !== null && t.ref !== null && typeof t.ref == "function" && t.ref._stringRef === o ? t.ref : (t = function(i) {
        var u = l.refs;
        i === null ? delete u[o] : u[o] = i;
      }, t._stringRef = o, t);
    }
    if (typeof e != "string")
      throw Error(g(284));
    if (!n._owner)
      throw Error(g(290, e));
  }
  return e;
}
function Cr(e, t) {
  throw e = Object.prototype.toString.call(t), Error(g(31, e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e));
}
function Eu(e) {
  var t = e._init;
  return t(e._payload);
}
function ca(e) {
  function t(f, a) {
    if (e) {
      var d = f.deletions;
      d === null ? (f.deletions = [a], f.flags |= 16) : d.push(a);
    }
  }
  function n(f, a) {
    if (!e)
      return null;
    for (; a !== null; )
      t(f, a), a = a.sibling;
    return null;
  }
  function r(f, a) {
    for (f = /* @__PURE__ */ new Map(); a !== null; )
      a.key !== null ? f.set(a.key, a) : f.set(a.index, a), a = a.sibling;
    return f;
  }
  function l(f, a) {
    return f = St(f, a), f.index = 0, f.sibling = null, f;
  }
  function o(f, a, d) {
    return f.index = d, e ? (d = f.alternate, d !== null ? (d = d.index, d < a ? (f.flags |= 2, a) : d) : (f.flags |= 2, a)) : (f.flags |= 1048576, a);
  }
  function i(f) {
    return e && f.alternate === null && (f.flags |= 2), f;
  }
  function u(f, a, d, y) {
    return a === null || a.tag !== 6 ? (a = Zl(d, f.mode, y), a.return = f, a) : (a = l(a, d), a.return = f, a);
  }
  function s(f, a, d, y) {
    var E = d.type;
    return E === Yt ? m(f, a, d.props.children, y, d.key) : a !== null && (a.elementType === E || typeof E == "object" && E !== null && E.$$typeof === st && Eu(E) === a.type) ? (y = l(a, d.props), y.ref = _n(f, a, d), y.return = f, y) : (y = Ur(d.type, d.key, d.props, null, f.mode, y), y.ref = _n(f, a, d), y.return = f, y);
  }
  function c(f, a, d, y) {
    return a === null || a.tag !== 4 || a.stateNode.containerInfo !== d.containerInfo || a.stateNode.implementation !== d.implementation ? (a = Jl(d, f.mode, y), a.return = f, a) : (a = l(a, d.children || []), a.return = f, a);
  }
  function m(f, a, d, y, E) {
    return a === null || a.tag !== 7 ? (a = Dt(d, f.mode, y, E), a.return = f, a) : (a = l(a, d), a.return = f, a);
  }
  function h(f, a, d) {
    if (typeof a == "string" && a !== "" || typeof a == "number")
      return a = Zl("" + a, f.mode, d), a.return = f, a;
    if (typeof a == "object" && a !== null) {
      switch (a.$$typeof) {
        case dr:
          return d = Ur(a.type, a.key, a.props, null, f.mode, d), d.ref = _n(f, null, a), d.return = f, d;
        case Kt:
          return a = Jl(a, f.mode, d), a.return = f, a;
        case st:
          var y = a._init;
          return h(f, y(a._payload), d);
      }
      if (Rn(a) || Sn(a))
        return a = Dt(a, f.mode, d, null), a.return = f, a;
      Cr(f, a);
    }
    return null;
  }
  function p(f, a, d, y) {
    var E = a !== null ? a.key : null;
    if (typeof d == "string" && d !== "" || typeof d == "number")
      return E !== null ? null : u(f, a, "" + d, y);
    if (typeof d == "object" && d !== null) {
      switch (d.$$typeof) {
        case dr:
          return d.key === E ? s(f, a, d, y) : null;
        case Kt:
          return d.key === E ? c(f, a, d, y) : null;
        case st:
          return E = d._init, p(
            f,
            a,
            E(d._payload),
            y
          );
      }
      if (Rn(d) || Sn(d))
        return E !== null ? null : m(f, a, d, y, null);
      Cr(f, d);
    }
    return null;
  }
  function w(f, a, d, y, E) {
    if (typeof y == "string" && y !== "" || typeof y == "number")
      return f = f.get(d) || null, u(a, f, "" + y, E);
    if (typeof y == "object" && y !== null) {
      switch (y.$$typeof) {
        case dr:
          return f = f.get(y.key === null ? d : y.key) || null, s(a, f, y, E);
        case Kt:
          return f = f.get(y.key === null ? d : y.key) || null, c(a, f, y, E);
        case st:
          var N = y._init;
          return w(f, a, d, N(y._payload), E);
      }
      if (Rn(y) || Sn(y))
        return f = f.get(d) || null, m(a, f, y, E, null);
      Cr(a, y);
    }
    return null;
  }
  function k(f, a, d, y) {
    for (var E = null, N = null, _ = a, P = a = 0, V = null; _ !== null && P < d.length; P++) {
      _.index > P ? (V = _, _ = null) : V = _.sibling;
      var T = p(f, _, d[P], y);
      if (T === null) {
        _ === null && (_ = V);
        break;
      }
      e && _ && T.alternate === null && t(f, _), a = o(T, a, P), N === null ? E = T : N.sibling = T, N = T, _ = V;
    }
    if (P === d.length)
      return n(f, _), K && Tt(f, P), E;
    if (_ === null) {
      for (; P < d.length; P++)
        _ = h(f, d[P], y), _ !== null && (a = o(_, a, P), N === null ? E = _ : N.sibling = _, N = _);
      return K && Tt(f, P), E;
    }
    for (_ = r(f, _); P < d.length; P++)
      V = w(_, f, P, d[P], y), V !== null && (e && V.alternate !== null && _.delete(V.key === null ? P : V.key), a = o(V, a, P), N === null ? E = V : N.sibling = V, N = V);
    return e && _.forEach(function(oe) {
      return t(f, oe);
    }), K && Tt(f, P), E;
  }
  function S(f, a, d, y) {
    var E = Sn(d);
    if (typeof E != "function")
      throw Error(g(150));
    if (d = E.call(d), d == null)
      throw Error(g(151));
    for (var N = E = null, _ = a, P = a = 0, V = null, T = d.next(); _ !== null && !T.done; P++, T = d.next()) {
      _.index > P ? (V = _, _ = null) : V = _.sibling;
      var oe = p(f, _, T.value, y);
      if (oe === null) {
        _ === null && (_ = V);
        break;
      }
      e && _ && oe.alternate === null && t(f, _), a = o(oe, a, P), N === null ? E = oe : N.sibling = oe, N = oe, _ = V;
    }
    if (T.done)
      return n(
        f,
        _
      ), K && Tt(f, P), E;
    if (_ === null) {
      for (; !T.done; P++, T = d.next())
        T = h(f, T.value, y), T !== null && (a = o(T, a, P), N === null ? E = T : N.sibling = T, N = T);
      return K && Tt(f, P), E;
    }
    for (_ = r(f, _); !T.done; P++, T = d.next())
      T = w(_, f, P, T.value, y), T !== null && (e && T.alternate !== null && _.delete(T.key === null ? P : T.key), a = o(T, a, P), N === null ? E = T : N.sibling = T, N = T);
    return e && _.forEach(function(Ze) {
      return t(f, Ze);
    }), K && Tt(f, P), E;
  }
  function U(f, a, d, y) {
    if (typeof d == "object" && d !== null && d.type === Yt && d.key === null && (d = d.props.children), typeof d == "object" && d !== null) {
      switch (d.$$typeof) {
        case dr:
          e: {
            for (var E = d.key, N = a; N !== null; ) {
              if (N.key === E) {
                if (E = d.type, E === Yt) {
                  if (N.tag === 7) {
                    n(f, N.sibling), a = l(N, d.props.children), a.return = f, f = a;
                    break e;
                  }
                } else if (N.elementType === E || typeof E == "object" && E !== null && E.$$typeof === st && Eu(E) === N.type) {
                  n(f, N.sibling), a = l(N, d.props), a.ref = _n(f, N, d), a.return = f, f = a;
                  break e;
                }
                n(f, N);
                break;
              } else
                t(f, N);
              N = N.sibling;
            }
            d.type === Yt ? (a = Dt(d.props.children, f.mode, y, d.key), a.return = f, f = a) : (y = Ur(d.type, d.key, d.props, null, f.mode, y), y.ref = _n(f, a, d), y.return = f, f = y);
          }
          return i(f);
        case Kt:
          e: {
            for (N = d.key; a !== null; ) {
              if (a.key === N)
                if (a.tag === 4 && a.stateNode.containerInfo === d.containerInfo && a.stateNode.implementation === d.implementation) {
                  n(f, a.sibling), a = l(a, d.children || []), a.return = f, f = a;
                  break e;
                } else {
                  n(f, a);
                  break;
                }
              else
                t(f, a);
              a = a.sibling;
            }
            a = Jl(d, f.mode, y), a.return = f, f = a;
          }
          return i(f);
        case st:
          return N = d._init, U(f, a, N(d._payload), y);
      }
      if (Rn(d))
        return k(f, a, d, y);
      if (Sn(d))
        return S(f, a, d, y);
      Cr(f, d);
    }
    return typeof d == "string" && d !== "" || typeof d == "number" ? (d = "" + d, a !== null && a.tag === 6 ? (n(f, a.sibling), a = l(a, d), a.return = f, f = a) : (n(f, a), a = Zl(d, f.mode, y), a.return = f, f = a), i(f)) : n(f, a);
  }
  return U;
}
var mn = ca(!0), fa = ca(!1), br = Nt(null), el = null, tn = null, mi = null;
function hi() {
  mi = tn = el = null;
}
function vi(e) {
  var t = br.current;
  Q(br), e._currentValue = t;
}
function zo(e, t, n) {
  for (; e !== null; ) {
    var r = e.alternate;
    if ((e.childLanes & t) !== t ? (e.childLanes |= t, r !== null && (r.childLanes |= t)) : r !== null && (r.childLanes & t) !== t && (r.childLanes |= t), e === n)
      break;
    e = e.return;
  }
}
function an(e, t) {
  el = e, mi = tn = null, e = e.dependencies, e !== null && e.firstContext !== null && (e.lanes & t && (we = !0), e.firstContext = null);
}
function Oe(e) {
  var t = e._currentValue;
  if (mi !== e)
    if (e = { context: e, memoizedValue: t, next: null }, tn === null) {
      if (el === null)
        throw Error(g(308));
      tn = e, el.dependencies = { lanes: 0, firstContext: e };
    } else
      tn = tn.next = e;
  return t;
}
var Mt = null;
function yi(e) {
  Mt === null ? Mt = [e] : Mt.push(e);
}
function da(e, t, n, r) {
  var l = t.interleaved;
  return l === null ? (n.next = n, yi(t)) : (n.next = l.next, l.next = n), t.interleaved = n, lt(e, r);
}
function lt(e, t) {
  e.lanes |= t;
  var n = e.alternate;
  for (n !== null && (n.lanes |= t), n = e, e = e.return; e !== null; )
    e.childLanes |= t, n = e.alternate, n !== null && (n.childLanes |= t), n = e, e = e.return;
  return n.tag === 3 ? n.stateNode : null;
}
var at = !1;
function gi(e) {
  e.updateQueue = { baseState: e.memoizedState, firstBaseUpdate: null, lastBaseUpdate: null, shared: { pending: null, interleaved: null, lanes: 0 }, effects: null };
}
function pa(e, t) {
  e = e.updateQueue, t.updateQueue === e && (t.updateQueue = { baseState: e.baseState, firstBaseUpdate: e.firstBaseUpdate, lastBaseUpdate: e.lastBaseUpdate, shared: e.shared, effects: e.effects });
}
function tt(e, t) {
  return { eventTime: e, lane: t, tag: 0, payload: null, callback: null, next: null };
}
function gt(e, t, n) {
  var r = e.updateQueue;
  if (r === null)
    return null;
  if (r = r.shared, j & 2) {
    var l = r.pending;
    return l === null ? t.next = t : (t.next = l.next, l.next = t), r.pending = t, lt(e, n);
  }
  return l = r.interleaved, l === null ? (t.next = t, yi(r)) : (t.next = l.next, l.next = t), r.interleaved = t, lt(e, n);
}
function Ir(e, t, n) {
  if (t = t.updateQueue, t !== null && (t = t.shared, (n & 4194240) !== 0)) {
    var r = t.lanes;
    r &= e.pendingLanes, n |= r, t.lanes = n, ri(e, n);
  }
}
function Cu(e, t) {
  var n = e.updateQueue, r = e.alternate;
  if (r !== null && (r = r.updateQueue, n === r)) {
    var l = null, o = null;
    if (n = n.firstBaseUpdate, n !== null) {
      do {
        var i = { eventTime: n.eventTime, lane: n.lane, tag: n.tag, payload: n.payload, callback: n.callback, next: null };
        o === null ? l = o = i : o = o.next = i, n = n.next;
      } while (n !== null);
      o === null ? l = o = t : o = o.next = t;
    } else
      l = o = t;
    n = { baseState: r.baseState, firstBaseUpdate: l, lastBaseUpdate: o, shared: r.shared, effects: r.effects }, e.updateQueue = n;
    return;
  }
  e = n.lastBaseUpdate, e === null ? n.firstBaseUpdate = t : e.next = t, n.lastBaseUpdate = t;
}
function tl(e, t, n, r) {
  var l = e.updateQueue;
  at = !1;
  var o = l.firstBaseUpdate, i = l.lastBaseUpdate, u = l.shared.pending;
  if (u !== null) {
    l.shared.pending = null;
    var s = u, c = s.next;
    s.next = null, i === null ? o = c : i.next = c, i = s;
    var m = e.alternate;
    m !== null && (m = m.updateQueue, u = m.lastBaseUpdate, u !== i && (u === null ? m.firstBaseUpdate = c : u.next = c, m.lastBaseUpdate = s));
  }
  if (o !== null) {
    var h = l.baseState;
    i = 0, m = c = s = null, u = o;
    do {
      var p = u.lane, w = u.eventTime;
      if ((r & p) === p) {
        m !== null && (m = m.next = {
          eventTime: w,
          lane: 0,
          tag: u.tag,
          payload: u.payload,
          callback: u.callback,
          next: null
        });
        e: {
          var k = e, S = u;
          switch (p = t, w = n, S.tag) {
            case 1:
              if (k = S.payload, typeof k == "function") {
                h = k.call(w, h, p);
                break e;
              }
              h = k;
              break e;
            case 3:
              k.flags = k.flags & -65537 | 128;
            case 0:
              if (k = S.payload, p = typeof k == "function" ? k.call(w, h, p) : k, p == null)
                break e;
              h = Z({}, h, p);
              break e;
            case 2:
              at = !0;
          }
        }
        u.callback !== null && u.lane !== 0 && (e.flags |= 64, p = l.effects, p === null ? l.effects = [u] : p.push(u));
      } else
        w = { eventTime: w, lane: p, tag: u.tag, payload: u.payload, callback: u.callback, next: null }, m === null ? (c = m = w, s = h) : m = m.next = w, i |= p;
      if (u = u.next, u === null) {
        if (u = l.shared.pending, u === null)
          break;
        p = u, u = p.next, p.next = null, l.lastBaseUpdate = p, l.shared.pending = null;
      }
    } while (1);
    if (m === null && (s = h), l.baseState = s, l.firstBaseUpdate = c, l.lastBaseUpdate = m, t = l.shared.interleaved, t !== null) {
      l = t;
      do
        i |= l.lane, l = l.next;
      while (l !== t);
    } else
      o === null && (l.shared.lanes = 0);
    Ut |= i, e.lanes = i, e.memoizedState = h;
  }
}
function xu(e, t, n) {
  if (e = t.effects, t.effects = null, e !== null)
    for (t = 0; t < e.length; t++) {
      var r = e[t], l = r.callback;
      if (l !== null) {
        if (r.callback = null, r = n, typeof l != "function")
          throw Error(g(191, l));
        l.call(r);
      }
    }
}
var cr = {}, Ge = Nt(cr), er = Nt(cr), tr = Nt(cr);
function It(e) {
  if (e === cr)
    throw Error(g(174));
  return e;
}
function wi(e, t) {
  switch (B(tr, t), B(er, e), B(Ge, cr), e = t.nodeType, e) {
    case 9:
    case 11:
      t = (t = t.documentElement) ? t.namespaceURI : uo(null, "");
      break;
    default:
      e = e === 8 ? t.parentNode : t, t = e.namespaceURI || null, e = e.tagName, t = uo(t, e);
  }
  Q(Ge), B(Ge, t);
}
function hn() {
  Q(Ge), Q(er), Q(tr);
}
function ma(e) {
  It(tr.current);
  var t = It(Ge.current), n = uo(t, e.type);
  t !== n && (B(er, e), B(Ge, n));
}
function ki(e) {
  er.current === e && (Q(Ge), Q(er));
}
var X = Nt(0);
function nl(e) {
  for (var t = e; t !== null; ) {
    if (t.tag === 13) {
      var n = t.memoizedState;
      if (n !== null && (n = n.dehydrated, n === null || n.data === "$?" || n.data === "$!"))
        return t;
    } else if (t.tag === 19 && t.memoizedProps.revealOrder !== void 0) {
      if (t.flags & 128)
        return t;
    } else if (t.child !== null) {
      t.child.return = t, t = t.child;
      continue;
    }
    if (t === e)
      break;
    for (; t.sibling === null; ) {
      if (t.return === null || t.return === e)
        return null;
      t = t.return;
    }
    t.sibling.return = t.return, t = t.sibling;
  }
  return null;
}
var Ql = [];
function Si() {
  for (var e = 0; e < Ql.length; e++)
    Ql[e]._workInProgressVersionPrimary = null;
  Ql.length = 0;
}
var Or = it.ReactCurrentDispatcher, Wl = it.ReactCurrentBatchConfig, $t = 0, G = null, te = null, re = null, rl = !1, Un = !1, nr = 0, ud = 0;
function ce() {
  throw Error(g(321));
}
function Ei(e, t) {
  if (t === null)
    return !1;
  for (var n = 0; n < t.length && n < e.length; n++)
    if (!Be(e[n], t[n]))
      return !1;
  return !0;
}
function Ci(e, t, n, r, l, o) {
  if ($t = o, G = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, Or.current = e === null || e.memoizedState === null ? fd : dd, e = n(r, l), Un) {
    o = 0;
    do {
      if (Un = !1, nr = 0, 25 <= o)
        throw Error(g(301));
      o += 1, re = te = null, t.updateQueue = null, Or.current = pd, e = n(r, l);
    } while (Un);
  }
  if (Or.current = ll, t = te !== null && te.next !== null, $t = 0, re = te = G = null, rl = !1, t)
    throw Error(g(300));
  return e;
}
function xi() {
  var e = nr !== 0;
  return nr = 0, e;
}
function Ke() {
  var e = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null };
  return re === null ? G.memoizedState = re = e : re = re.next = e, re;
}
function De() {
  if (te === null) {
    var e = G.alternate;
    e = e !== null ? e.memoizedState : null;
  } else
    e = te.next;
  var t = re === null ? G.memoizedState : re.next;
  if (t !== null)
    re = t, te = e;
  else {
    if (e === null)
      throw Error(g(310));
    te = e, e = { memoizedState: te.memoizedState, baseState: te.baseState, baseQueue: te.baseQueue, queue: te.queue, next: null }, re === null ? G.memoizedState = re = e : re = re.next = e;
  }
  return re;
}
function rr(e, t) {
  return typeof t == "function" ? t(e) : t;
}
function Kl(e) {
  var t = De(), n = t.queue;
  if (n === null)
    throw Error(g(311));
  n.lastRenderedReducer = e;
  var r = te, l = r.baseQueue, o = n.pending;
  if (o !== null) {
    if (l !== null) {
      var i = l.next;
      l.next = o.next, o.next = i;
    }
    r.baseQueue = l = o, n.pending = null;
  }
  if (l !== null) {
    o = l.next, r = r.baseState;
    var u = i = null, s = null, c = o;
    do {
      var m = c.lane;
      if (($t & m) === m)
        s !== null && (s = s.next = { lane: 0, action: c.action, hasEagerState: c.hasEagerState, eagerState: c.eagerState, next: null }), r = c.hasEagerState ? c.eagerState : e(r, c.action);
      else {
        var h = {
          lane: m,
          action: c.action,
          hasEagerState: c.hasEagerState,
          eagerState: c.eagerState,
          next: null
        };
        s === null ? (u = s = h, i = r) : s = s.next = h, G.lanes |= m, Ut |= m;
      }
      c = c.next;
    } while (c !== null && c !== o);
    s === null ? i = r : s.next = u, Be(r, t.memoizedState) || (we = !0), t.memoizedState = r, t.baseState = i, t.baseQueue = s, n.lastRenderedState = r;
  }
  if (e = n.interleaved, e !== null) {
    l = e;
    do
      o = l.lane, G.lanes |= o, Ut |= o, l = l.next;
    while (l !== e);
  } else
    l === null && (n.lanes = 0);
  return [t.memoizedState, n.dispatch];
}
function Yl(e) {
  var t = De(), n = t.queue;
  if (n === null)
    throw Error(g(311));
  n.lastRenderedReducer = e;
  var r = n.dispatch, l = n.pending, o = t.memoizedState;
  if (l !== null) {
    n.pending = null;
    var i = l = l.next;
    do
      o = e(o, i.action), i = i.next;
    while (i !== l);
    Be(o, t.memoizedState) || (we = !0), t.memoizedState = o, t.baseQueue === null && (t.baseState = o), n.lastRenderedState = o;
  }
  return [o, r];
}
function ha() {
}
function va(e, t) {
  var n = G, r = De(), l = t(), o = !Be(r.memoizedState, l);
  if (o && (r.memoizedState = l, we = !0), r = r.queue, Ni(wa.bind(null, n, r, e), [e]), r.getSnapshot !== t || o || re !== null && re.memoizedState.tag & 1) {
    if (n.flags |= 2048, lr(9, ga.bind(null, n, r, l, t), void 0, null), le === null)
      throw Error(g(349));
    $t & 30 || ya(n, t, l);
  }
  return l;
}
function ya(e, t, n) {
  e.flags |= 16384, e = { getSnapshot: t, value: n }, t = G.updateQueue, t === null ? (t = { lastEffect: null, stores: null }, G.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e));
}
function ga(e, t, n, r) {
  t.value = n, t.getSnapshot = r, ka(t) && Sa(e);
}
function wa(e, t, n) {
  return n(function() {
    ka(t) && Sa(e);
  });
}
function ka(e) {
  var t = e.getSnapshot;
  e = e.value;
  try {
    var n = t();
    return !Be(e, n);
  } catch {
    return !0;
  }
}
function Sa(e) {
  var t = lt(e, 1);
  t !== null && Ve(t, e, 1, -1);
}
function Nu(e) {
  var t = Ke();
  return typeof e == "function" && (e = e()), t.memoizedState = t.baseState = e, e = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: rr, lastRenderedState: e }, t.queue = e, e = e.dispatch = cd.bind(null, G, e), [t.memoizedState, e];
}
function lr(e, t, n, r) {
  return e = { tag: e, create: t, destroy: n, deps: r, next: null }, t = G.updateQueue, t === null ? (t = { lastEffect: null, stores: null }, G.updateQueue = t, t.lastEffect = e.next = e) : (n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (r = n.next, n.next = e, e.next = r, t.lastEffect = e)), e;
}
function Ea() {
  return De().memoizedState;
}
function Dr(e, t, n, r) {
  var l = Ke();
  G.flags |= e, l.memoizedState = lr(1 | t, n, void 0, r === void 0 ? null : r);
}
function yl(e, t, n, r) {
  var l = De();
  r = r === void 0 ? null : r;
  var o = void 0;
  if (te !== null) {
    var i = te.memoizedState;
    if (o = i.destroy, r !== null && Ei(r, i.deps)) {
      l.memoizedState = lr(t, n, o, r);
      return;
    }
  }
  G.flags |= e, l.memoizedState = lr(1 | t, n, o, r);
}
function _u(e, t) {
  return Dr(8390656, 8, e, t);
}
function Ni(e, t) {
  return yl(2048, 8, e, t);
}
function Ca(e, t) {
  return yl(4, 2, e, t);
}
function xa(e, t) {
  return yl(4, 4, e, t);
}
function Na(e, t) {
  if (typeof t == "function")
    return e = e(), t(e), function() {
      t(null);
    };
  if (t != null)
    return e = e(), t.current = e, function() {
      t.current = null;
    };
}
function _a(e, t, n) {
  return n = n != null ? n.concat([e]) : null, yl(4, 4, Na.bind(null, t, e), n);
}
function _i() {
}
function Pa(e, t) {
  var n = De();
  t = t === void 0 ? null : t;
  var r = n.memoizedState;
  return r !== null && t !== null && Ei(t, r[1]) ? r[0] : (n.memoizedState = [e, t], e);
}
function za(e, t) {
  var n = De();
  t = t === void 0 ? null : t;
  var r = n.memoizedState;
  return r !== null && t !== null && Ei(t, r[1]) ? r[0] : (e = e(), n.memoizedState = [e, t], e);
}
function Ta(e, t, n) {
  return $t & 21 ? (Be(n, t) || (n = Os(), G.lanes |= n, Ut |= n, e.baseState = !0), t) : (e.baseState && (e.baseState = !1, we = !0), e.memoizedState = n);
}
function sd(e, t) {
  var n = A;
  A = n !== 0 && 4 > n ? n : 4, e(!0);
  var r = Wl.transition;
  Wl.transition = {};
  try {
    e(!1), t();
  } finally {
    A = n, Wl.transition = r;
  }
}
function La() {
  return De().memoizedState;
}
function ad(e, t, n) {
  var r = kt(e);
  if (n = { lane: r, action: n, hasEagerState: !1, eagerState: null, next: null }, Ra(e))
    Ma(t, n);
  else if (n = da(e, t, n, r), n !== null) {
    var l = he();
    Ve(n, e, r, l), Ia(n, t, r);
  }
}
function cd(e, t, n) {
  var r = kt(e), l = { lane: r, action: n, hasEagerState: !1, eagerState: null, next: null };
  if (Ra(e))
    Ma(t, l);
  else {
    var o = e.alternate;
    if (e.lanes === 0 && (o === null || o.lanes === 0) && (o = t.lastRenderedReducer, o !== null))
      try {
        var i = t.lastRenderedState, u = o(i, n);
        if (l.hasEagerState = !0, l.eagerState = u, Be(u, i)) {
          var s = t.interleaved;
          s === null ? (l.next = l, yi(t)) : (l.next = s.next, s.next = l), t.interleaved = l;
          return;
        }
      } catch {
      } finally {
      }
    n = da(e, t, l, r), n !== null && (l = he(), Ve(n, e, r, l), Ia(n, t, r));
  }
}
function Ra(e) {
  var t = e.alternate;
  return e === G || t !== null && t === G;
}
function Ma(e, t) {
  Un = rl = !0;
  var n = e.pending;
  n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
}
function Ia(e, t, n) {
  if (n & 4194240) {
    var r = t.lanes;
    r &= e.pendingLanes, n |= r, t.lanes = n, ri(e, n);
  }
}
var ll = { readContext: Oe, useCallback: ce, useContext: ce, useEffect: ce, useImperativeHandle: ce, useInsertionEffect: ce, useLayoutEffect: ce, useMemo: ce, useReducer: ce, useRef: ce, useState: ce, useDebugValue: ce, useDeferredValue: ce, useTransition: ce, useMutableSource: ce, useSyncExternalStore: ce, useId: ce, unstable_isNewReconciler: !1 }, fd = { readContext: Oe, useCallback: function(e, t) {
  return Ke().memoizedState = [e, t === void 0 ? null : t], e;
}, useContext: Oe, useEffect: _u, useImperativeHandle: function(e, t, n) {
  return n = n != null ? n.concat([e]) : null, Dr(
    4194308,
    4,
    Na.bind(null, t, e),
    n
  );
}, useLayoutEffect: function(e, t) {
  return Dr(4194308, 4, e, t);
}, useInsertionEffect: function(e, t) {
  return Dr(4, 2, e, t);
}, useMemo: function(e, t) {
  var n = Ke();
  return t = t === void 0 ? null : t, e = e(), n.memoizedState = [e, t], e;
}, useReducer: function(e, t, n) {
  var r = Ke();
  return t = n !== void 0 ? n(t) : t, r.memoizedState = r.baseState = t, e = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: e, lastRenderedState: t }, r.queue = e, e = e.dispatch = ad.bind(null, G, e), [r.memoizedState, e];
}, useRef: function(e) {
  var t = Ke();
  return e = { current: e }, t.memoizedState = e;
}, useState: Nu, useDebugValue: _i, useDeferredValue: function(e) {
  return Ke().memoizedState = e;
}, useTransition: function() {
  var e = Nu(!1), t = e[0];
  return e = sd.bind(null, e[1]), Ke().memoizedState = e, [t, e];
}, useMutableSource: function() {
}, useSyncExternalStore: function(e, t, n) {
  var r = G, l = Ke();
  if (K) {
    if (n === void 0)
      throw Error(g(407));
    n = n();
  } else {
    if (n = t(), le === null)
      throw Error(g(349));
    $t & 30 || ya(r, t, n);
  }
  l.memoizedState = n;
  var o = { value: n, getSnapshot: t };
  return l.queue = o, _u(wa.bind(
    null,
    r,
    o,
    e
  ), [e]), r.flags |= 2048, lr(9, ga.bind(null, r, o, n, t), void 0, null), n;
}, useId: function() {
  var e = Ke(), t = le.identifierPrefix;
  if (K) {
    var n = et, r = be;
    n = (r & ~(1 << 32 - Ae(r) - 1)).toString(32) + n, t = ":" + t + "R" + n, n = nr++, 0 < n && (t += "H" + n.toString(32)), t += ":";
  } else
    n = ud++, t = ":" + t + "r" + n.toString(32) + ":";
  return e.memoizedState = t;
}, unstable_isNewReconciler: !1 }, dd = {
  readContext: Oe,
  useCallback: Pa,
  useContext: Oe,
  useEffect: Ni,
  useImperativeHandle: _a,
  useInsertionEffect: Ca,
  useLayoutEffect: xa,
  useMemo: za,
  useReducer: Kl,
  useRef: Ea,
  useState: function() {
    return Kl(rr);
  },
  useDebugValue: _i,
  useDeferredValue: function(e) {
    var t = De();
    return Ta(t, te.memoizedState, e);
  },
  useTransition: function() {
    var e = Kl(rr)[0], t = De().memoizedState;
    return [e, t];
  },
  useMutableSource: ha,
  useSyncExternalStore: va,
  useId: La,
  unstable_isNewReconciler: !1
}, pd = { readContext: Oe, useCallback: Pa, useContext: Oe, useEffect: Ni, useImperativeHandle: _a, useInsertionEffect: Ca, useLayoutEffect: xa, useMemo: za, useReducer: Yl, useRef: Ea, useState: function() {
  return Yl(rr);
}, useDebugValue: _i, useDeferredValue: function(e) {
  var t = De();
  return te === null ? t.memoizedState = e : Ta(t, te.memoizedState, e);
}, useTransition: function() {
  var e = Yl(rr)[0], t = De().memoizedState;
  return [e, t];
}, useMutableSource: ha, useSyncExternalStore: va, useId: La, unstable_isNewReconciler: !1 };
function je(e, t) {
  if (e && e.defaultProps) {
    t = Z({}, t), e = e.defaultProps;
    for (var n in e)
      t[n] === void 0 && (t[n] = e[n]);
    return t;
  }
  return t;
}
function To(e, t, n, r) {
  t = e.memoizedState, n = n(r, t), n = n == null ? t : Z({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n);
}
var gl = { isMounted: function(e) {
  return (e = e._reactInternals) ? Bt(e) === e : !1;
}, enqueueSetState: function(e, t, n) {
  e = e._reactInternals;
  var r = he(), l = kt(e), o = tt(r, l);
  o.payload = t, n != null && (o.callback = n), t = gt(e, o, l), t !== null && (Ve(t, e, l, r), Ir(t, e, l));
}, enqueueReplaceState: function(e, t, n) {
  e = e._reactInternals;
  var r = he(), l = kt(e), o = tt(r, l);
  o.tag = 1, o.payload = t, n != null && (o.callback = n), t = gt(e, o, l), t !== null && (Ve(t, e, l, r), Ir(t, e, l));
}, enqueueForceUpdate: function(e, t) {
  e = e._reactInternals;
  var n = he(), r = kt(e), l = tt(n, r);
  l.tag = 2, t != null && (l.callback = t), t = gt(e, l, r), t !== null && (Ve(t, e, r, n), Ir(t, e, r));
} };
function Pu(e, t, n, r, l, o, i) {
  return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(r, o, i) : t.prototype && t.prototype.isPureReactComponent ? !Zn(n, r) || !Zn(l, o) : !0;
}
function Oa(e, t, n) {
  var r = !1, l = Ct, o = t.contextType;
  return typeof o == "object" && o !== null ? o = Oe(o) : (l = Se(t) ? Ft : pe.current, r = t.contextTypes, o = (r = r != null) ? dn(e, l) : Ct), t = new t(n, o), e.memoizedState = t.state !== null && t.state !== void 0 ? t.state : null, t.updater = gl, e.stateNode = t, t._reactInternals = e, r && (e = e.stateNode, e.__reactInternalMemoizedUnmaskedChildContext = l, e.__reactInternalMemoizedMaskedChildContext = o), t;
}
function zu(e, t, n, r) {
  e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, r), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, r), t.state !== e && gl.enqueueReplaceState(t, t.state, null);
}
function Lo(e, t, n, r) {
  var l = e.stateNode;
  l.props = n, l.state = e.memoizedState, l.refs = {}, gi(e);
  var o = t.contextType;
  typeof o == "object" && o !== null ? l.context = Oe(o) : (o = Se(t) ? Ft : pe.current, l.context = dn(e, o)), l.state = e.memoizedState, o = t.getDerivedStateFromProps, typeof o == "function" && (To(e, t, o, n), l.state = e.memoizedState), typeof t.getDerivedStateFromProps == "function" || typeof l.getSnapshotBeforeUpdate == "function" || typeof l.UNSAFE_componentWillMount != "function" && typeof l.componentWillMount != "function" || (t = l.state, typeof l.componentWillMount == "function" && l.componentWillMount(), typeof l.UNSAFE_componentWillMount == "function" && l.UNSAFE_componentWillMount(), t !== l.state && gl.enqueueReplaceState(l, l.state, null), tl(e, n, l, r), l.state = e.memoizedState), typeof l.componentDidMount == "function" && (e.flags |= 4194308);
}
function vn(e, t) {
  try {
    var n = "", r = t;
    do
      n += Ac(r), r = r.return;
    while (r);
    var l = n;
  } catch (o) {
    l = `
Error generating stack: ` + o.message + `
` + o.stack;
  }
  return { value: e, source: t, stack: l, digest: null };
}
function Xl(e, t, n) {
  return { value: e, source: null, stack: n ?? null, digest: t ?? null };
}
function Ro(e, t) {
  try {
    console.error(t.value);
  } catch (n) {
    setTimeout(function() {
      throw n;
    });
  }
}
var md = typeof WeakMap == "function" ? WeakMap : Map;
function Da(e, t, n) {
  n = tt(-1, n), n.tag = 3, n.payload = { element: null };
  var r = t.value;
  return n.callback = function() {
    il || (il = !0, Vo = r), Ro(e, t);
  }, n;
}
function Fa(e, t, n) {
  n = tt(-1, n), n.tag = 3;
  var r = e.type.getDerivedStateFromError;
  if (typeof r == "function") {
    var l = t.value;
    n.payload = function() {
      return r(l);
    }, n.callback = function() {
      Ro(e, t);
    };
  }
  var o = e.stateNode;
  return o !== null && typeof o.componentDidCatch == "function" && (n.callback = function() {
    Ro(e, t), typeof r != "function" && (wt === null ? wt = /* @__PURE__ */ new Set([this]) : wt.add(this));
    var i = t.stack;
    this.componentDidCatch(t.value, { componentStack: i !== null ? i : "" });
  }), n;
}
function Tu(e, t, n) {
  var r = e.pingCache;
  if (r === null) {
    r = e.pingCache = new md();
    var l = /* @__PURE__ */ new Set();
    r.set(t, l);
  } else
    l = r.get(t), l === void 0 && (l = /* @__PURE__ */ new Set(), r.set(t, l));
  l.has(n) || (l.add(n), e = zd.bind(null, e, t, n), t.then(e, e));
}
function Lu(e) {
  do {
    var t;
    if ((t = e.tag === 13) && (t = e.memoizedState, t = t !== null ? t.dehydrated !== null : !0), t)
      return e;
    e = e.return;
  } while (e !== null);
  return null;
}
function Ru(e, t, n, r, l) {
  return e.mode & 1 ? (e.flags |= 65536, e.lanes = l, e) : (e === t ? e.flags |= 65536 : (e.flags |= 128, n.flags |= 131072, n.flags &= -52805, n.tag === 1 && (n.alternate === null ? n.tag = 17 : (t = tt(-1, 1), t.tag = 2, gt(n, t, 1))), n.lanes |= 1), e);
}
var hd = it.ReactCurrentOwner, we = !1;
function me(e, t, n, r) {
  t.child = e === null ? fa(t, null, n, r) : mn(t, e.child, n, r);
}
function Mu(e, t, n, r, l) {
  n = n.render;
  var o = t.ref;
  return an(t, l), r = Ci(e, t, n, r, o, l), n = xi(), e !== null && !we ? (t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~l, ot(e, t, l)) : (K && n && fi(t), t.flags |= 1, me(e, t, r, l), t.child);
}
function Iu(e, t, n, r, l) {
  if (e === null) {
    var o = n.type;
    return typeof o == "function" && !Oi(o) && o.defaultProps === void 0 && n.compare === null && n.defaultProps === void 0 ? (t.tag = 15, t.type = o, ja(e, t, o, r, l)) : (e = Ur(n.type, null, r, t, t.mode, l), e.ref = t.ref, e.return = t, t.child = e);
  }
  if (o = e.child, !(e.lanes & l)) {
    var i = o.memoizedProps;
    if (n = n.compare, n = n !== null ? n : Zn, n(i, r) && e.ref === t.ref)
      return ot(e, t, l);
  }
  return t.flags |= 1, e = St(o, r), e.ref = t.ref, e.return = t, t.child = e;
}
function ja(e, t, n, r, l) {
  if (e !== null) {
    var o = e.memoizedProps;
    if (Zn(o, r) && e.ref === t.ref)
      if (we = !1, t.pendingProps = r = o, (e.lanes & l) !== 0)
        e.flags & 131072 && (we = !0);
      else
        return t.lanes = e.lanes, ot(e, t, l);
  }
  return Mo(e, t, n, r, l);
}
function $a(e, t, n) {
  var r = t.pendingProps, l = r.children, o = e !== null ? e.memoizedState : null;
  if (r.mode === "hidden")
    if (!(t.mode & 1))
      t.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, B(rn, Ce), Ce |= n;
    else {
      if (!(n & 1073741824))
        return e = o !== null ? o.baseLanes | n : n, t.lanes = t.childLanes = 1073741824, t.memoizedState = { baseLanes: e, cachePool: null, transitions: null }, t.updateQueue = null, B(rn, Ce), Ce |= e, null;
      t.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, r = o !== null ? o.baseLanes : n, B(rn, Ce), Ce |= r;
    }
  else
    o !== null ? (r = o.baseLanes | n, t.memoizedState = null) : r = n, B(rn, Ce), Ce |= r;
  return me(e, t, l, n), t.child;
}
function Ua(e, t) {
  var n = t.ref;
  (e === null && n !== null || e !== null && e.ref !== n) && (t.flags |= 512, t.flags |= 2097152);
}
function Mo(e, t, n, r, l) {
  var o = Se(n) ? Ft : pe.current;
  return o = dn(t, o), an(t, l), n = Ci(e, t, n, r, o, l), r = xi(), e !== null && !we ? (t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~l, ot(e, t, l)) : (K && r && fi(t), t.flags |= 1, me(e, t, n, l), t.child);
}
function Ou(e, t, n, r, l) {
  if (Se(n)) {
    var o = !0;
    Zr(t);
  } else
    o = !1;
  if (an(t, l), t.stateNode === null)
    Fr(e, t), Oa(t, n, r), Lo(t, n, r, l), r = !0;
  else if (e === null) {
    var i = t.stateNode, u = t.memoizedProps;
    i.props = u;
    var s = i.context, c = n.contextType;
    typeof c == "object" && c !== null ? c = Oe(c) : (c = Se(n) ? Ft : pe.current, c = dn(t, c));
    var m = n.getDerivedStateFromProps, h = typeof m == "function" || typeof i.getSnapshotBeforeUpdate == "function";
    h || typeof i.UNSAFE_componentWillReceiveProps != "function" && typeof i.componentWillReceiveProps != "function" || (u !== r || s !== c) && zu(t, i, r, c), at = !1;
    var p = t.memoizedState;
    i.state = p, tl(t, r, i, l), s = t.memoizedState, u !== r || p !== s || ke.current || at ? (typeof m == "function" && (To(t, n, m, r), s = t.memoizedState), (u = at || Pu(t, n, u, r, p, s, c)) ? (h || typeof i.UNSAFE_componentWillMount != "function" && typeof i.componentWillMount != "function" || (typeof i.componentWillMount == "function" && i.componentWillMount(), typeof i.UNSAFE_componentWillMount == "function" && i.UNSAFE_componentWillMount()), typeof i.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof i.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = r, t.memoizedState = s), i.props = r, i.state = s, i.context = c, r = u) : (typeof i.componentDidMount == "function" && (t.flags |= 4194308), r = !1);
  } else {
    i = t.stateNode, pa(e, t), u = t.memoizedProps, c = t.type === t.elementType ? u : je(t.type, u), i.props = c, h = t.pendingProps, p = i.context, s = n.contextType, typeof s == "object" && s !== null ? s = Oe(s) : (s = Se(n) ? Ft : pe.current, s = dn(t, s));
    var w = n.getDerivedStateFromProps;
    (m = typeof w == "function" || typeof i.getSnapshotBeforeUpdate == "function") || typeof i.UNSAFE_componentWillReceiveProps != "function" && typeof i.componentWillReceiveProps != "function" || (u !== h || p !== s) && zu(t, i, r, s), at = !1, p = t.memoizedState, i.state = p, tl(t, r, i, l);
    var k = t.memoizedState;
    u !== h || p !== k || ke.current || at ? (typeof w == "function" && (To(t, n, w, r), k = t.memoizedState), (c = at || Pu(t, n, c, r, p, k, s) || !1) ? (m || typeof i.UNSAFE_componentWillUpdate != "function" && typeof i.componentWillUpdate != "function" || (typeof i.componentWillUpdate == "function" && i.componentWillUpdate(r, k, s), typeof i.UNSAFE_componentWillUpdate == "function" && i.UNSAFE_componentWillUpdate(r, k, s)), typeof i.componentDidUpdate == "function" && (t.flags |= 4), typeof i.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof i.componentDidUpdate != "function" || u === e.memoizedProps && p === e.memoizedState || (t.flags |= 4), typeof i.getSnapshotBeforeUpdate != "function" || u === e.memoizedProps && p === e.memoizedState || (t.flags |= 1024), t.memoizedProps = r, t.memoizedState = k), i.props = r, i.state = k, i.context = s, r = c) : (typeof i.componentDidUpdate != "function" || u === e.memoizedProps && p === e.memoizedState || (t.flags |= 4), typeof i.getSnapshotBeforeUpdate != "function" || u === e.memoizedProps && p === e.memoizedState || (t.flags |= 1024), r = !1);
  }
  return Io(e, t, n, r, o, l);
}
function Io(e, t, n, r, l, o) {
  Ua(e, t);
  var i = (t.flags & 128) !== 0;
  if (!r && !i)
    return l && wu(t, n, !1), ot(e, t, o);
  r = t.stateNode, hd.current = t;
  var u = i && typeof n.getDerivedStateFromError != "function" ? null : r.render();
  return t.flags |= 1, e !== null && i ? (t.child = mn(t, e.child, null, o), t.child = mn(t, null, u, o)) : me(e, t, u, o), t.memoizedState = r.state, l && wu(t, n, !0), t.child;
}
function Aa(e) {
  var t = e.stateNode;
  t.pendingContext ? gu(e, t.pendingContext, t.pendingContext !== t.context) : t.context && gu(e, t.context, !1), wi(e, t.containerInfo);
}
function Du(e, t, n, r, l) {
  return pn(), pi(l), t.flags |= 256, me(e, t, n, r), t.child;
}
var Oo = { dehydrated: null, treeContext: null, retryLane: 0 };
function Do(e) {
  return { baseLanes: e, cachePool: null, transitions: null };
}
function Va(e, t, n) {
  var r = t.pendingProps, l = X.current, o = !1, i = (t.flags & 128) !== 0, u;
  if ((u = i) || (u = e !== null && e.memoizedState === null ? !1 : (l & 2) !== 0), u ? (o = !0, t.flags &= -129) : (e === null || e.memoizedState !== null) && (l |= 1), B(X, l & 1), e === null)
    return Po(t), e = t.memoizedState, e !== null && (e = e.dehydrated, e !== null) ? (t.mode & 1 ? e.data === "$!" ? t.lanes = 8 : t.lanes = 1073741824 : t.lanes = 1, null) : (i = r.children, e = r.fallback, o ? (r = t.mode, o = t.child, i = { mode: "hidden", children: i }, !(r & 1) && o !== null ? (o.childLanes = 0, o.pendingProps = i) : o = Sl(i, r, 0, null), e = Dt(e, r, n, null), o.return = t, e.return = t, o.sibling = e, t.child = o, t.child.memoizedState = Do(n), t.memoizedState = Oo, e) : Pi(t, i));
  if (l = e.memoizedState, l !== null && (u = l.dehydrated, u !== null))
    return vd(e, t, i, r, u, l, n);
  if (o) {
    o = r.fallback, i = t.mode, l = e.child, u = l.sibling;
    var s = { mode: "hidden", children: r.children };
    return !(i & 1) && t.child !== l ? (r = t.child, r.childLanes = 0, r.pendingProps = s, t.deletions = null) : (r = St(l, s), r.subtreeFlags = l.subtreeFlags & 14680064), u !== null ? o = St(u, o) : (o = Dt(o, i, n, null), o.flags |= 2), o.return = t, r.return = t, r.sibling = o, t.child = r, r = o, o = t.child, i = e.child.memoizedState, i = i === null ? Do(n) : { baseLanes: i.baseLanes | n, cachePool: null, transitions: i.transitions }, o.memoizedState = i, o.childLanes = e.childLanes & ~n, t.memoizedState = Oo, r;
  }
  return o = e.child, e = o.sibling, r = St(o, { mode: "visible", children: r.children }), !(t.mode & 1) && (r.lanes = n), r.return = t, r.sibling = null, e !== null && (n = t.deletions, n === null ? (t.deletions = [e], t.flags |= 16) : n.push(e)), t.child = r, t.memoizedState = null, r;
}
function Pi(e, t) {
  return t = Sl({ mode: "visible", children: t }, e.mode, 0, null), t.return = e, e.child = t;
}
function xr(e, t, n, r) {
  return r !== null && pi(r), mn(t, e.child, null, n), e = Pi(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e;
}
function vd(e, t, n, r, l, o, i) {
  if (n)
    return t.flags & 256 ? (t.flags &= -257, r = Xl(Error(g(422))), xr(e, t, i, r)) : t.memoizedState !== null ? (t.child = e.child, t.flags |= 128, null) : (o = r.fallback, l = t.mode, r = Sl({ mode: "visible", children: r.children }, l, 0, null), o = Dt(o, l, i, null), o.flags |= 2, r.return = t, o.return = t, r.sibling = o, t.child = r, t.mode & 1 && mn(t, e.child, null, i), t.child.memoizedState = Do(i), t.memoizedState = Oo, o);
  if (!(t.mode & 1))
    return xr(e, t, i, null);
  if (l.data === "$!") {
    if (r = l.nextSibling && l.nextSibling.dataset, r)
      var u = r.dgst;
    return r = u, o = Error(g(419)), r = Xl(o, r, void 0), xr(e, t, i, r);
  }
  if (u = (i & e.childLanes) !== 0, we || u) {
    if (r = le, r !== null) {
      switch (i & -i) {
        case 4:
          l = 2;
          break;
        case 16:
          l = 8;
          break;
        case 64:
        case 128:
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
        case 67108864:
          l = 32;
          break;
        case 536870912:
          l = 268435456;
          break;
        default:
          l = 0;
      }
      l = l & (r.suspendedLanes | i) ? 0 : l, l !== 0 && l !== o.retryLane && (o.retryLane = l, lt(e, l), Ve(r, e, l, -1));
    }
    return Ii(), r = Xl(Error(g(421))), xr(e, t, i, r);
  }
  return l.data === "$?" ? (t.flags |= 128, t.child = e.child, t = Td.bind(null, e), l._reactRetry = t, null) : (e = o.treeContext, xe = yt(l.nextSibling), Ne = t, K = !0, Ue = null, e !== null && (Le[Re++] = be, Le[Re++] = et, Le[Re++] = jt, be = e.id, et = e.overflow, jt = t), t = Pi(t, r.children), t.flags |= 4096, t);
}
function Fu(e, t, n) {
  e.lanes |= t;
  var r = e.alternate;
  r !== null && (r.lanes |= t), zo(e.return, t, n);
}
function Gl(e, t, n, r, l) {
  var o = e.memoizedState;
  o === null ? e.memoizedState = { isBackwards: t, rendering: null, renderingStartTime: 0, last: r, tail: n, tailMode: l } : (o.isBackwards = t, o.rendering = null, o.renderingStartTime = 0, o.last = r, o.tail = n, o.tailMode = l);
}
function Ba(e, t, n) {
  var r = t.pendingProps, l = r.revealOrder, o = r.tail;
  if (me(e, t, r.children, n), r = X.current, r & 2)
    r = r & 1 | 2, t.flags |= 128;
  else {
    if (e !== null && e.flags & 128)
      e:
        for (e = t.child; e !== null; ) {
          if (e.tag === 13)
            e.memoizedState !== null && Fu(e, n, t);
          else if (e.tag === 19)
            Fu(e, n, t);
          else if (e.child !== null) {
            e.child.return = e, e = e.child;
            continue;
          }
          if (e === t)
            break e;
          for (; e.sibling === null; ) {
            if (e.return === null || e.return === t)
              break e;
            e = e.return;
          }
          e.sibling.return = e.return, e = e.sibling;
        }
    r &= 1;
  }
  if (B(X, r), !(t.mode & 1))
    t.memoizedState = null;
  else
    switch (l) {
      case "forwards":
        for (n = t.child, l = null; n !== null; )
          e = n.alternate, e !== null && nl(e) === null && (l = n), n = n.sibling;
        n = l, n === null ? (l = t.child, t.child = null) : (l = n.sibling, n.sibling = null), Gl(t, !1, l, n, o);
        break;
      case "backwards":
        for (n = null, l = t.child, t.child = null; l !== null; ) {
          if (e = l.alternate, e !== null && nl(e) === null) {
            t.child = l;
            break;
          }
          e = l.sibling, l.sibling = n, n = l, l = e;
        }
        Gl(t, !0, n, null, o);
        break;
      case "together":
        Gl(t, !1, null, null, void 0);
        break;
      default:
        t.memoizedState = null;
    }
  return t.child;
}
function Fr(e, t) {
  !(t.mode & 1) && e !== null && (e.alternate = null, t.alternate = null, t.flags |= 2);
}
function ot(e, t, n) {
  if (e !== null && (t.dependencies = e.dependencies), Ut |= t.lanes, !(n & t.childLanes))
    return null;
  if (e !== null && t.child !== e.child)
    throw Error(g(153));
  if (t.child !== null) {
    for (e = t.child, n = St(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null; )
      e = e.sibling, n = n.sibling = St(e, e.pendingProps), n.return = t;
    n.sibling = null;
  }
  return t.child;
}
function yd(e, t, n) {
  switch (t.tag) {
    case 3:
      Aa(t), pn();
      break;
    case 5:
      ma(t);
      break;
    case 1:
      Se(t.type) && Zr(t);
      break;
    case 4:
      wi(t, t.stateNode.containerInfo);
      break;
    case 10:
      var r = t.type._context, l = t.memoizedProps.value;
      B(br, r._currentValue), r._currentValue = l;
      break;
    case 13:
      if (r = t.memoizedState, r !== null)
        return r.dehydrated !== null ? (B(X, X.current & 1), t.flags |= 128, null) : n & t.child.childLanes ? Va(e, t, n) : (B(X, X.current & 1), e = ot(e, t, n), e !== null ? e.sibling : null);
      B(X, X.current & 1);
      break;
    case 19:
      if (r = (n & t.childLanes) !== 0, e.flags & 128) {
        if (r)
          return Ba(e, t, n);
        t.flags |= 128;
      }
      if (l = t.memoizedState, l !== null && (l.rendering = null, l.tail = null, l.lastEffect = null), B(X, X.current), r)
        break;
      return null;
    case 22:
    case 23:
      return t.lanes = 0, $a(e, t, n);
  }
  return ot(e, t, n);
}
var Ha, Fo, Qa, Wa;
Ha = function(e, t) {
  for (var n = t.child; n !== null; ) {
    if (n.tag === 5 || n.tag === 6)
      e.appendChild(n.stateNode);
    else if (n.tag !== 4 && n.child !== null) {
      n.child.return = n, n = n.child;
      continue;
    }
    if (n === t)
      break;
    for (; n.sibling === null; ) {
      if (n.return === null || n.return === t)
        return;
      n = n.return;
    }
    n.sibling.return = n.return, n = n.sibling;
  }
};
Fo = function() {
};
Qa = function(e, t, n, r) {
  var l = e.memoizedProps;
  if (l !== r) {
    e = t.stateNode, It(Ge.current);
    var o = null;
    switch (n) {
      case "input":
        l = ro(e, l), r = ro(e, r), o = [];
        break;
      case "select":
        l = Z({}, l, { value: void 0 }), r = Z({}, r, { value: void 0 }), o = [];
        break;
      case "textarea":
        l = io(e, l), r = io(e, r), o = [];
        break;
      default:
        typeof l.onClick != "function" && typeof r.onClick == "function" && (e.onclick = Xr);
    }
    so(n, r);
    var i;
    n = null;
    for (c in l)
      if (!r.hasOwnProperty(c) && l.hasOwnProperty(c) && l[c] != null)
        if (c === "style") {
          var u = l[c];
          for (i in u)
            u.hasOwnProperty(i) && (n || (n = {}), n[i] = "");
        } else
          c !== "dangerouslySetInnerHTML" && c !== "children" && c !== "suppressContentEditableWarning" && c !== "suppressHydrationWarning" && c !== "autoFocus" && (Hn.hasOwnProperty(c) ? o || (o = []) : (o = o || []).push(c, null));
    for (c in r) {
      var s = r[c];
      if (u = l != null ? l[c] : void 0, r.hasOwnProperty(c) && s !== u && (s != null || u != null))
        if (c === "style")
          if (u) {
            for (i in u)
              !u.hasOwnProperty(i) || s && s.hasOwnProperty(i) || (n || (n = {}), n[i] = "");
            for (i in s)
              s.hasOwnProperty(i) && u[i] !== s[i] && (n || (n = {}), n[i] = s[i]);
          } else
            n || (o || (o = []), o.push(
              c,
              n
            )), n = s;
        else
          c === "dangerouslySetInnerHTML" ? (s = s ? s.__html : void 0, u = u ? u.__html : void 0, s != null && u !== s && (o = o || []).push(c, s)) : c === "children" ? typeof s != "string" && typeof s != "number" || (o = o || []).push(c, "" + s) : c !== "suppressContentEditableWarning" && c !== "suppressHydrationWarning" && (Hn.hasOwnProperty(c) ? (s != null && c === "onScroll" && H("scroll", e), o || u === s || (o = [])) : (o = o || []).push(c, s));
    }
    n && (o = o || []).push("style", n);
    var c = o;
    (t.updateQueue = c) && (t.flags |= 4);
  }
};
Wa = function(e, t, n, r) {
  n !== r && (t.flags |= 4);
};
function Pn(e, t) {
  if (!K)
    switch (e.tailMode) {
      case "hidden":
        t = e.tail;
        for (var n = null; t !== null; )
          t.alternate !== null && (n = t), t = t.sibling;
        n === null ? e.tail = null : n.sibling = null;
        break;
      case "collapsed":
        n = e.tail;
        for (var r = null; n !== null; )
          n.alternate !== null && (r = n), n = n.sibling;
        r === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : r.sibling = null;
    }
}
function fe(e) {
  var t = e.alternate !== null && e.alternate.child === e.child, n = 0, r = 0;
  if (t)
    for (var l = e.child; l !== null; )
      n |= l.lanes | l.childLanes, r |= l.subtreeFlags & 14680064, r |= l.flags & 14680064, l.return = e, l = l.sibling;
  else
    for (l = e.child; l !== null; )
      n |= l.lanes | l.childLanes, r |= l.subtreeFlags, r |= l.flags, l.return = e, l = l.sibling;
  return e.subtreeFlags |= r, e.childLanes = n, t;
}
function gd(e, t, n) {
  var r = t.pendingProps;
  switch (di(t), t.tag) {
    case 2:
    case 16:
    case 15:
    case 0:
    case 11:
    case 7:
    case 8:
    case 12:
    case 9:
    case 14:
      return fe(t), null;
    case 1:
      return Se(t.type) && Gr(), fe(t), null;
    case 3:
      return r = t.stateNode, hn(), Q(ke), Q(pe), Si(), r.pendingContext && (r.context = r.pendingContext, r.pendingContext = null), (e === null || e.child === null) && (Er(t) ? t.flags |= 4 : e === null || e.memoizedState.isDehydrated && !(t.flags & 256) || (t.flags |= 1024, Ue !== null && (Qo(Ue), Ue = null))), Fo(e, t), fe(t), null;
    case 5:
      ki(t);
      var l = It(tr.current);
      if (n = t.type, e !== null && t.stateNode != null)
        Qa(e, t, n, r, l), e.ref !== t.ref && (t.flags |= 512, t.flags |= 2097152);
      else {
        if (!r) {
          if (t.stateNode === null)
            throw Error(g(166));
          return fe(t), null;
        }
        if (e = It(Ge.current), Er(t)) {
          r = t.stateNode, n = t.type;
          var o = t.memoizedProps;
          switch (r[Ye] = t, r[bn] = o, e = (t.mode & 1) !== 0, n) {
            case "dialog":
              H("cancel", r), H("close", r);
              break;
            case "iframe":
            case "object":
            case "embed":
              H("load", r);
              break;
            case "video":
            case "audio":
              for (l = 0; l < In.length; l++)
                H(In[l], r);
              break;
            case "source":
              H("error", r);
              break;
            case "img":
            case "image":
            case "link":
              H(
                "error",
                r
              ), H("load", r);
              break;
            case "details":
              H("toggle", r);
              break;
            case "input":
              Wi(r, o), H("invalid", r);
              break;
            case "select":
              r._wrapperState = { wasMultiple: !!o.multiple }, H("invalid", r);
              break;
            case "textarea":
              Yi(r, o), H("invalid", r);
          }
          so(n, o), l = null;
          for (var i in o)
            if (o.hasOwnProperty(i)) {
              var u = o[i];
              i === "children" ? typeof u == "string" ? r.textContent !== u && (o.suppressHydrationWarning !== !0 && Sr(r.textContent, u, e), l = ["children", u]) : typeof u == "number" && r.textContent !== "" + u && (o.suppressHydrationWarning !== !0 && Sr(
                r.textContent,
                u,
                e
              ), l = ["children", "" + u]) : Hn.hasOwnProperty(i) && u != null && i === "onScroll" && H("scroll", r);
            }
          switch (n) {
            case "input":
              pr(r), Ki(r, o, !0);
              break;
            case "textarea":
              pr(r), Xi(r);
              break;
            case "select":
            case "option":
              break;
            default:
              typeof o.onClick == "function" && (r.onclick = Xr);
          }
          r = l, t.updateQueue = r, r !== null && (t.flags |= 4);
        } else {
          i = l.nodeType === 9 ? l : l.ownerDocument, e === "http://www.w3.org/1999/xhtml" && (e = ws(n)), e === "http://www.w3.org/1999/xhtml" ? n === "script" ? (e = i.createElement("div"), e.innerHTML = "<script><\/script>", e = e.removeChild(e.firstChild)) : typeof r.is == "string" ? e = i.createElement(n, { is: r.is }) : (e = i.createElement(n), n === "select" && (i = e, r.multiple ? i.multiple = !0 : r.size && (i.size = r.size))) : e = i.createElementNS(e, n), e[Ye] = t, e[bn] = r, Ha(e, t, !1, !1), t.stateNode = e;
          e: {
            switch (i = ao(n, r), n) {
              case "dialog":
                H("cancel", e), H("close", e), l = r;
                break;
              case "iframe":
              case "object":
              case "embed":
                H("load", e), l = r;
                break;
              case "video":
              case "audio":
                for (l = 0; l < In.length; l++)
                  H(In[l], e);
                l = r;
                break;
              case "source":
                H("error", e), l = r;
                break;
              case "img":
              case "image":
              case "link":
                H(
                  "error",
                  e
                ), H("load", e), l = r;
                break;
              case "details":
                H("toggle", e), l = r;
                break;
              case "input":
                Wi(e, r), l = ro(e, r), H("invalid", e);
                break;
              case "option":
                l = r;
                break;
              case "select":
                e._wrapperState = { wasMultiple: !!r.multiple }, l = Z({}, r, { value: void 0 }), H("invalid", e);
                break;
              case "textarea":
                Yi(e, r), l = io(e, r), H("invalid", e);
                break;
              default:
                l = r;
            }
            so(n, l), u = l;
            for (o in u)
              if (u.hasOwnProperty(o)) {
                var s = u[o];
                o === "style" ? Es(e, s) : o === "dangerouslySetInnerHTML" ? (s = s ? s.__html : void 0, s != null && ks(e, s)) : o === "children" ? typeof s == "string" ? (n !== "textarea" || s !== "") && Qn(e, s) : typeof s == "number" && Qn(e, "" + s) : o !== "suppressContentEditableWarning" && o !== "suppressHydrationWarning" && o !== "autoFocus" && (Hn.hasOwnProperty(o) ? s != null && o === "onScroll" && H("scroll", e) : s != null && Jo(e, o, s, i));
              }
            switch (n) {
              case "input":
                pr(e), Ki(e, r, !1);
                break;
              case "textarea":
                pr(e), Xi(e);
                break;
              case "option":
                r.value != null && e.setAttribute("value", "" + Et(r.value));
                break;
              case "select":
                e.multiple = !!r.multiple, o = r.value, o != null ? ln(e, !!r.multiple, o, !1) : r.defaultValue != null && ln(
                  e,
                  !!r.multiple,
                  r.defaultValue,
                  !0
                );
                break;
              default:
                typeof l.onClick == "function" && (e.onclick = Xr);
            }
            switch (n) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                r = !!r.autoFocus;
                break e;
              case "img":
                r = !0;
                break e;
              default:
                r = !1;
            }
          }
          r && (t.flags |= 4);
        }
        t.ref !== null && (t.flags |= 512, t.flags |= 2097152);
      }
      return fe(t), null;
    case 6:
      if (e && t.stateNode != null)
        Wa(e, t, e.memoizedProps, r);
      else {
        if (typeof r != "string" && t.stateNode === null)
          throw Error(g(166));
        if (n = It(tr.current), It(Ge.current), Er(t)) {
          if (r = t.stateNode, n = t.memoizedProps, r[Ye] = t, (o = r.nodeValue !== n) && (e = Ne, e !== null))
            switch (e.tag) {
              case 3:
                Sr(r.nodeValue, n, (e.mode & 1) !== 0);
                break;
              case 5:
                e.memoizedProps.suppressHydrationWarning !== !0 && Sr(r.nodeValue, n, (e.mode & 1) !== 0);
            }
          o && (t.flags |= 4);
        } else
          r = (n.nodeType === 9 ? n : n.ownerDocument).createTextNode(r), r[Ye] = t, t.stateNode = r;
      }
      return fe(t), null;
    case 13:
      if (Q(X), r = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
        if (K && xe !== null && t.mode & 1 && !(t.flags & 128))
          aa(), pn(), t.flags |= 98560, o = !1;
        else if (o = Er(t), r !== null && r.dehydrated !== null) {
          if (e === null) {
            if (!o)
              throw Error(g(318));
            if (o = t.memoizedState, o = o !== null ? o.dehydrated : null, !o)
              throw Error(g(317));
            o[Ye] = t;
          } else
            pn(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
          fe(t), o = !1;
        } else
          Ue !== null && (Qo(Ue), Ue = null), o = !0;
        if (!o)
          return t.flags & 65536 ? t : null;
      }
      return t.flags & 128 ? (t.lanes = n, t) : (r = r !== null, r !== (e !== null && e.memoizedState !== null) && r && (t.child.flags |= 8192, t.mode & 1 && (e === null || X.current & 1 ? ne === 0 && (ne = 3) : Ii())), t.updateQueue !== null && (t.flags |= 4), fe(t), null);
    case 4:
      return hn(), Fo(e, t), e === null && Jn(t.stateNode.containerInfo), fe(t), null;
    case 10:
      return vi(t.type._context), fe(t), null;
    case 17:
      return Se(t.type) && Gr(), fe(t), null;
    case 19:
      if (Q(X), o = t.memoizedState, o === null)
        return fe(t), null;
      if (r = (t.flags & 128) !== 0, i = o.rendering, i === null)
        if (r)
          Pn(o, !1);
        else {
          if (ne !== 0 || e !== null && e.flags & 128)
            for (e = t.child; e !== null; ) {
              if (i = nl(e), i !== null) {
                for (t.flags |= 128, Pn(o, !1), r = i.updateQueue, r !== null && (t.updateQueue = r, t.flags |= 4), t.subtreeFlags = 0, r = n, n = t.child; n !== null; )
                  o = n, e = r, o.flags &= 14680066, i = o.alternate, i === null ? (o.childLanes = 0, o.lanes = e, o.child = null, o.subtreeFlags = 0, o.memoizedProps = null, o.memoizedState = null, o.updateQueue = null, o.dependencies = null, o.stateNode = null) : (o.childLanes = i.childLanes, o.lanes = i.lanes, o.child = i.child, o.subtreeFlags = 0, o.deletions = null, o.memoizedProps = i.memoizedProps, o.memoizedState = i.memoizedState, o.updateQueue = i.updateQueue, o.type = i.type, e = i.dependencies, o.dependencies = e === null ? null : { lanes: e.lanes, firstContext: e.firstContext }), n = n.sibling;
                return B(X, X.current & 1 | 2), t.child;
              }
              e = e.sibling;
            }
          o.tail !== null && q() > yn && (t.flags |= 128, r = !0, Pn(o, !1), t.lanes = 4194304);
        }
      else {
        if (!r)
          if (e = nl(i), e !== null) {
            if (t.flags |= 128, r = !0, n = e.updateQueue, n !== null && (t.updateQueue = n, t.flags |= 4), Pn(o, !0), o.tail === null && o.tailMode === "hidden" && !i.alternate && !K)
              return fe(t), null;
          } else
            2 * q() - o.renderingStartTime > yn && n !== 1073741824 && (t.flags |= 128, r = !0, Pn(o, !1), t.lanes = 4194304);
        o.isBackwards ? (i.sibling = t.child, t.child = i) : (n = o.last, n !== null ? n.sibling = i : t.child = i, o.last = i);
      }
      return o.tail !== null ? (t = o.tail, o.rendering = t, o.tail = t.sibling, o.renderingStartTime = q(), t.sibling = null, n = X.current, B(X, r ? n & 1 | 2 : n & 1), t) : (fe(t), null);
    case 22:
    case 23:
      return Mi(), r = t.memoizedState !== null, e !== null && e.memoizedState !== null !== r && (t.flags |= 8192), r && t.mode & 1 ? Ce & 1073741824 && (fe(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : fe(t), null;
    case 24:
      return null;
    case 25:
      return null;
  }
  throw Error(g(156, t.tag));
}
function wd(e, t) {
  switch (di(t), t.tag) {
    case 1:
      return Se(t.type) && Gr(), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
    case 3:
      return hn(), Q(ke), Q(pe), Si(), e = t.flags, e & 65536 && !(e & 128) ? (t.flags = e & -65537 | 128, t) : null;
    case 5:
      return ki(t), null;
    case 13:
      if (Q(X), e = t.memoizedState, e !== null && e.dehydrated !== null) {
        if (t.alternate === null)
          throw Error(g(340));
        pn();
      }
      return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
    case 19:
      return Q(X), null;
    case 4:
      return hn(), null;
    case 10:
      return vi(t.type._context), null;
    case 22:
    case 23:
      return Mi(), null;
    case 24:
      return null;
    default:
      return null;
  }
}
var Nr = !1, de = !1, kd = typeof WeakSet == "function" ? WeakSet : Set, x = null;
function nn(e, t) {
  var n = e.ref;
  if (n !== null)
    if (typeof n == "function")
      try {
        n(null);
      } catch (r) {
        J(e, t, r);
      }
    else
      n.current = null;
}
function jo(e, t, n) {
  try {
    n();
  } catch (r) {
    J(e, t, r);
  }
}
var ju = !1;
function Sd(e, t) {
  if (ko = Wr, e = Zs(), ci(e)) {
    if ("selectionStart" in e)
      var n = { start: e.selectionStart, end: e.selectionEnd };
    else
      e: {
        n = (n = e.ownerDocument) && n.defaultView || window;
        var r = n.getSelection && n.getSelection();
        if (r && r.rangeCount !== 0) {
          n = r.anchorNode;
          var l = r.anchorOffset, o = r.focusNode;
          r = r.focusOffset;
          try {
            n.nodeType, o.nodeType;
          } catch {
            n = null;
            break e;
          }
          var i = 0, u = -1, s = -1, c = 0, m = 0, h = e, p = null;
          t:
            for (; ; ) {
              for (var w; h !== n || l !== 0 && h.nodeType !== 3 || (u = i + l), h !== o || r !== 0 && h.nodeType !== 3 || (s = i + r), h.nodeType === 3 && (i += h.nodeValue.length), (w = h.firstChild) !== null; )
                p = h, h = w;
              for (; ; ) {
                if (h === e)
                  break t;
                if (p === n && ++c === l && (u = i), p === o && ++m === r && (s = i), (w = h.nextSibling) !== null)
                  break;
                h = p, p = h.parentNode;
              }
              h = w;
            }
          n = u === -1 || s === -1 ? null : { start: u, end: s };
        } else
          n = null;
      }
    n = n || { start: 0, end: 0 };
  } else
    n = null;
  for (So = { focusedElem: e, selectionRange: n }, Wr = !1, x = t; x !== null; )
    if (t = x, e = t.child, (t.subtreeFlags & 1028) !== 0 && e !== null)
      e.return = t, x = e;
    else
      for (; x !== null; ) {
        t = x;
        try {
          var k = t.alternate;
          if (t.flags & 1024)
            switch (t.tag) {
              case 0:
              case 11:
              case 15:
                break;
              case 1:
                if (k !== null) {
                  var S = k.memoizedProps, U = k.memoizedState, f = t.stateNode, a = f.getSnapshotBeforeUpdate(t.elementType === t.type ? S : je(t.type, S), U);
                  f.__reactInternalSnapshotBeforeUpdate = a;
                }
                break;
              case 3:
                var d = t.stateNode.containerInfo;
                d.nodeType === 1 ? d.textContent = "" : d.nodeType === 9 && d.documentElement && d.removeChild(d.documentElement);
                break;
              case 5:
              case 6:
              case 4:
              case 17:
                break;
              default:
                throw Error(g(163));
            }
        } catch (y) {
          J(t, t.return, y);
        }
        if (e = t.sibling, e !== null) {
          e.return = t.return, x = e;
          break;
        }
        x = t.return;
      }
  return k = ju, ju = !1, k;
}
function An(e, t, n) {
  var r = t.updateQueue;
  if (r = r !== null ? r.lastEffect : null, r !== null) {
    var l = r = r.next;
    do {
      if ((l.tag & e) === e) {
        var o = l.destroy;
        l.destroy = void 0, o !== void 0 && jo(t, n, o);
      }
      l = l.next;
    } while (l !== r);
  }
}
function wl(e, t) {
  if (t = t.updateQueue, t = t !== null ? t.lastEffect : null, t !== null) {
    var n = t = t.next;
    do {
      if ((n.tag & e) === e) {
        var r = n.create;
        n.destroy = r();
      }
      n = n.next;
    } while (n !== t);
  }
}
function $o(e) {
  var t = e.ref;
  if (t !== null) {
    var n = e.stateNode;
    switch (e.tag) {
      case 5:
        e = n;
        break;
      default:
        e = n;
    }
    typeof t == "function" ? t(e) : t.current = e;
  }
}
function Ka(e) {
  var t = e.alternate;
  t !== null && (e.alternate = null, Ka(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && (delete t[Ye], delete t[bn], delete t[xo], delete t[rd], delete t[ld])), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
}
function Ya(e) {
  return e.tag === 5 || e.tag === 3 || e.tag === 4;
}
function $u(e) {
  e:
    for (; ; ) {
      for (; e.sibling === null; ) {
        if (e.return === null || Ya(e.return))
          return null;
        e = e.return;
      }
      for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18; ) {
        if (e.flags & 2 || e.child === null || e.tag === 4)
          continue e;
        e.child.return = e, e = e.child;
      }
      if (!(e.flags & 2))
        return e.stateNode;
    }
}
function Uo(e, t, n) {
  var r = e.tag;
  if (r === 5 || r === 6)
    e = e.stateNode, t ? n.nodeType === 8 ? n.parentNode.insertBefore(e, t) : n.insertBefore(e, t) : (n.nodeType === 8 ? (t = n.parentNode, t.insertBefore(e, n)) : (t = n, t.appendChild(e)), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = Xr));
  else if (r !== 4 && (e = e.child, e !== null))
    for (Uo(e, t, n), e = e.sibling; e !== null; )
      Uo(e, t, n), e = e.sibling;
}
function Ao(e, t, n) {
  var r = e.tag;
  if (r === 5 || r === 6)
    e = e.stateNode, t ? n.insertBefore(e, t) : n.appendChild(e);
  else if (r !== 4 && (e = e.child, e !== null))
    for (Ao(e, t, n), e = e.sibling; e !== null; )
      Ao(e, t, n), e = e.sibling;
}
var ie = null, $e = !1;
function ut(e, t, n) {
  for (n = n.child; n !== null; )
    Xa(e, t, n), n = n.sibling;
}
function Xa(e, t, n) {
  if (Xe && typeof Xe.onCommitFiberUnmount == "function")
    try {
      Xe.onCommitFiberUnmount(fl, n);
    } catch {
    }
  switch (n.tag) {
    case 5:
      de || nn(n, t);
    case 6:
      var r = ie, l = $e;
      ie = null, ut(e, t, n), ie = r, $e = l, ie !== null && ($e ? (e = ie, n = n.stateNode, e.nodeType === 8 ? e.parentNode.removeChild(n) : e.removeChild(n)) : ie.removeChild(n.stateNode));
      break;
    case 18:
      ie !== null && ($e ? (e = ie, n = n.stateNode, e.nodeType === 8 ? Bl(e.parentNode, n) : e.nodeType === 1 && Bl(e, n), Xn(e)) : Bl(ie, n.stateNode));
      break;
    case 4:
      r = ie, l = $e, ie = n.stateNode.containerInfo, $e = !0, ut(e, t, n), ie = r, $e = l;
      break;
    case 0:
    case 11:
    case 14:
    case 15:
      if (!de && (r = n.updateQueue, r !== null && (r = r.lastEffect, r !== null))) {
        l = r = r.next;
        do {
          var o = l, i = o.destroy;
          o = o.tag, i !== void 0 && (o & 2 || o & 4) && jo(n, t, i), l = l.next;
        } while (l !== r);
      }
      ut(e, t, n);
      break;
    case 1:
      if (!de && (nn(n, t), r = n.stateNode, typeof r.componentWillUnmount == "function"))
        try {
          r.props = n.memoizedProps, r.state = n.memoizedState, r.componentWillUnmount();
        } catch (u) {
          J(n, t, u);
        }
      ut(e, t, n);
      break;
    case 21:
      ut(e, t, n);
      break;
    case 22:
      n.mode & 1 ? (de = (r = de) || n.memoizedState !== null, ut(e, t, n), de = r) : ut(e, t, n);
      break;
    default:
      ut(e, t, n);
  }
}
function Uu(e) {
  var t = e.updateQueue;
  if (t !== null) {
    e.updateQueue = null;
    var n = e.stateNode;
    n === null && (n = e.stateNode = new kd()), t.forEach(function(r) {
      var l = Ld.bind(null, e, r);
      n.has(r) || (n.add(r), r.then(l, l));
    });
  }
}
function Fe(e, t) {
  var n = t.deletions;
  if (n !== null)
    for (var r = 0; r < n.length; r++) {
      var l = n[r];
      try {
        var o = e, i = t, u = i;
        e:
          for (; u !== null; ) {
            switch (u.tag) {
              case 5:
                ie = u.stateNode, $e = !1;
                break e;
              case 3:
                ie = u.stateNode.containerInfo, $e = !0;
                break e;
              case 4:
                ie = u.stateNode.containerInfo, $e = !0;
                break e;
            }
            u = u.return;
          }
        if (ie === null)
          throw Error(g(160));
        Xa(o, i, l), ie = null, $e = !1;
        var s = l.alternate;
        s !== null && (s.return = null), l.return = null;
      } catch (c) {
        J(l, t, c);
      }
    }
  if (t.subtreeFlags & 12854)
    for (t = t.child; t !== null; )
      Ga(t, e), t = t.sibling;
}
function Ga(e, t) {
  var n = e.alternate, r = e.flags;
  switch (e.tag) {
    case 0:
    case 11:
    case 14:
    case 15:
      if (Fe(t, e), We(e), r & 4) {
        try {
          An(3, e, e.return), wl(3, e);
        } catch (S) {
          J(e, e.return, S);
        }
        try {
          An(5, e, e.return);
        } catch (S) {
          J(e, e.return, S);
        }
      }
      break;
    case 1:
      Fe(t, e), We(e), r & 512 && n !== null && nn(n, n.return);
      break;
    case 5:
      if (Fe(t, e), We(e), r & 512 && n !== null && nn(n, n.return), e.flags & 32) {
        var l = e.stateNode;
        try {
          Qn(l, "");
        } catch (S) {
          J(e, e.return, S);
        }
      }
      if (r & 4 && (l = e.stateNode, l != null)) {
        var o = e.memoizedProps, i = n !== null ? n.memoizedProps : o, u = e.type, s = e.updateQueue;
        if (e.updateQueue = null, s !== null)
          try {
            u === "input" && o.type === "radio" && o.name != null && ys(l, o), ao(u, i);
            var c = ao(u, o);
            for (i = 0; i < s.length; i += 2) {
              var m = s[i], h = s[i + 1];
              m === "style" ? Es(l, h) : m === "dangerouslySetInnerHTML" ? ks(l, h) : m === "children" ? Qn(l, h) : Jo(l, m, h, c);
            }
            switch (u) {
              case "input":
                lo(l, o);
                break;
              case "textarea":
                gs(l, o);
                break;
              case "select":
                var p = l._wrapperState.wasMultiple;
                l._wrapperState.wasMultiple = !!o.multiple;
                var w = o.value;
                w != null ? ln(l, !!o.multiple, w, !1) : p !== !!o.multiple && (o.defaultValue != null ? ln(
                  l,
                  !!o.multiple,
                  o.defaultValue,
                  !0
                ) : ln(l, !!o.multiple, o.multiple ? [] : "", !1));
            }
            l[bn] = o;
          } catch (S) {
            J(e, e.return, S);
          }
      }
      break;
    case 6:
      if (Fe(t, e), We(e), r & 4) {
        if (e.stateNode === null)
          throw Error(g(162));
        l = e.stateNode, o = e.memoizedProps;
        try {
          l.nodeValue = o;
        } catch (S) {
          J(e, e.return, S);
        }
      }
      break;
    case 3:
      if (Fe(t, e), We(e), r & 4 && n !== null && n.memoizedState.isDehydrated)
        try {
          Xn(t.containerInfo);
        } catch (S) {
          J(e, e.return, S);
        }
      break;
    case 4:
      Fe(t, e), We(e);
      break;
    case 13:
      Fe(t, e), We(e), l = e.child, l.flags & 8192 && (o = l.memoizedState !== null, l.stateNode.isHidden = o, !o || l.alternate !== null && l.alternate.memoizedState !== null || (Li = q())), r & 4 && Uu(e);
      break;
    case 22:
      if (m = n !== null && n.memoizedState !== null, e.mode & 1 ? (de = (c = de) || m, Fe(t, e), de = c) : Fe(t, e), We(e), r & 8192) {
        if (c = e.memoizedState !== null, (e.stateNode.isHidden = c) && !m && e.mode & 1)
          for (x = e, m = e.child; m !== null; ) {
            for (h = x = m; x !== null; ) {
              switch (p = x, w = p.child, p.tag) {
                case 0:
                case 11:
                case 14:
                case 15:
                  An(4, p, p.return);
                  break;
                case 1:
                  nn(p, p.return);
                  var k = p.stateNode;
                  if (typeof k.componentWillUnmount == "function") {
                    r = p, n = p.return;
                    try {
                      t = r, k.props = t.memoizedProps, k.state = t.memoizedState, k.componentWillUnmount();
                    } catch (S) {
                      J(r, n, S);
                    }
                  }
                  break;
                case 5:
                  nn(p, p.return);
                  break;
                case 22:
                  if (p.memoizedState !== null) {
                    Vu(h);
                    continue;
                  }
              }
              w !== null ? (w.return = p, x = w) : Vu(h);
            }
            m = m.sibling;
          }
        e:
          for (m = null, h = e; ; ) {
            if (h.tag === 5) {
              if (m === null) {
                m = h;
                try {
                  l = h.stateNode, c ? (o = l.style, typeof o.setProperty == "function" ? o.setProperty("display", "none", "important") : o.display = "none") : (u = h.stateNode, s = h.memoizedProps.style, i = s != null && s.hasOwnProperty("display") ? s.display : null, u.style.display = Ss("display", i));
                } catch (S) {
                  J(e, e.return, S);
                }
              }
            } else if (h.tag === 6) {
              if (m === null)
                try {
                  h.stateNode.nodeValue = c ? "" : h.memoizedProps;
                } catch (S) {
                  J(e, e.return, S);
                }
            } else if ((h.tag !== 22 && h.tag !== 23 || h.memoizedState === null || h === e) && h.child !== null) {
              h.child.return = h, h = h.child;
              continue;
            }
            if (h === e)
              break e;
            for (; h.sibling === null; ) {
              if (h.return === null || h.return === e)
                break e;
              m === h && (m = null), h = h.return;
            }
            m === h && (m = null), h.sibling.return = h.return, h = h.sibling;
          }
      }
      break;
    case 19:
      Fe(t, e), We(e), r & 4 && Uu(e);
      break;
    case 21:
      break;
    default:
      Fe(
        t,
        e
      ), We(e);
  }
}
function We(e) {
  var t = e.flags;
  if (t & 2) {
    try {
      e: {
        for (var n = e.return; n !== null; ) {
          if (Ya(n)) {
            var r = n;
            break e;
          }
          n = n.return;
        }
        throw Error(g(160));
      }
      switch (r.tag) {
        case 5:
          var l = r.stateNode;
          r.flags & 32 && (Qn(l, ""), r.flags &= -33);
          var o = $u(e);
          Ao(e, o, l);
          break;
        case 3:
        case 4:
          var i = r.stateNode.containerInfo, u = $u(e);
          Uo(e, u, i);
          break;
        default:
          throw Error(g(161));
      }
    } catch (s) {
      J(e, e.return, s);
    }
    e.flags &= -3;
  }
  t & 4096 && (e.flags &= -4097);
}
function Ed(e, t, n) {
  x = e, Za(e);
}
function Za(e, t, n) {
  for (var r = (e.mode & 1) !== 0; x !== null; ) {
    var l = x, o = l.child;
    if (l.tag === 22 && r) {
      var i = l.memoizedState !== null || Nr;
      if (!i) {
        var u = l.alternate, s = u !== null && u.memoizedState !== null || de;
        u = Nr;
        var c = de;
        if (Nr = i, (de = s) && !c)
          for (x = l; x !== null; )
            i = x, s = i.child, i.tag === 22 && i.memoizedState !== null ? Bu(l) : s !== null ? (s.return = i, x = s) : Bu(l);
        for (; o !== null; )
          x = o, Za(o), o = o.sibling;
        x = l, Nr = u, de = c;
      }
      Au(e);
    } else
      l.subtreeFlags & 8772 && o !== null ? (o.return = l, x = o) : Au(e);
  }
}
function Au(e) {
  for (; x !== null; ) {
    var t = x;
    if (t.flags & 8772) {
      var n = t.alternate;
      try {
        if (t.flags & 8772)
          switch (t.tag) {
            case 0:
            case 11:
            case 15:
              de || wl(5, t);
              break;
            case 1:
              var r = t.stateNode;
              if (t.flags & 4 && !de)
                if (n === null)
                  r.componentDidMount();
                else {
                  var l = t.elementType === t.type ? n.memoizedProps : je(t.type, n.memoizedProps);
                  r.componentDidUpdate(l, n.memoizedState, r.__reactInternalSnapshotBeforeUpdate);
                }
              var o = t.updateQueue;
              o !== null && xu(t, o, r);
              break;
            case 3:
              var i = t.updateQueue;
              if (i !== null) {
                if (n = null, t.child !== null)
                  switch (t.child.tag) {
                    case 5:
                      n = t.child.stateNode;
                      break;
                    case 1:
                      n = t.child.stateNode;
                  }
                xu(t, i, n);
              }
              break;
            case 5:
              var u = t.stateNode;
              if (n === null && t.flags & 4) {
                n = u;
                var s = t.memoizedProps;
                switch (t.type) {
                  case "button":
                  case "input":
                  case "select":
                  case "textarea":
                    s.autoFocus && n.focus();
                    break;
                  case "img":
                    s.src && (n.src = s.src);
                }
              }
              break;
            case 6:
              break;
            case 4:
              break;
            case 12:
              break;
            case 13:
              if (t.memoizedState === null) {
                var c = t.alternate;
                if (c !== null) {
                  var m = c.memoizedState;
                  if (m !== null) {
                    var h = m.dehydrated;
                    h !== null && Xn(h);
                  }
                }
              }
              break;
            case 19:
            case 17:
            case 21:
            case 22:
            case 23:
            case 25:
              break;
            default:
              throw Error(g(163));
          }
        de || t.flags & 512 && $o(t);
      } catch (p) {
        J(t, t.return, p);
      }
    }
    if (t === e) {
      x = null;
      break;
    }
    if (n = t.sibling, n !== null) {
      n.return = t.return, x = n;
      break;
    }
    x = t.return;
  }
}
function Vu(e) {
  for (; x !== null; ) {
    var t = x;
    if (t === e) {
      x = null;
      break;
    }
    var n = t.sibling;
    if (n !== null) {
      n.return = t.return, x = n;
      break;
    }
    x = t.return;
  }
}
function Bu(e) {
  for (; x !== null; ) {
    var t = x;
    try {
      switch (t.tag) {
        case 0:
        case 11:
        case 15:
          var n = t.return;
          try {
            wl(4, t);
          } catch (s) {
            J(t, n, s);
          }
          break;
        case 1:
          var r = t.stateNode;
          if (typeof r.componentDidMount == "function") {
            var l = t.return;
            try {
              r.componentDidMount();
            } catch (s) {
              J(t, l, s);
            }
          }
          var o = t.return;
          try {
            $o(t);
          } catch (s) {
            J(t, o, s);
          }
          break;
        case 5:
          var i = t.return;
          try {
            $o(t);
          } catch (s) {
            J(t, i, s);
          }
      }
    } catch (s) {
      J(t, t.return, s);
    }
    if (t === e) {
      x = null;
      break;
    }
    var u = t.sibling;
    if (u !== null) {
      u.return = t.return, x = u;
      break;
    }
    x = t.return;
  }
}
var Cd = Math.ceil, ol = it.ReactCurrentDispatcher, zi = it.ReactCurrentOwner, Ie = it.ReactCurrentBatchConfig, j = 0, le = null, ee = null, ue = 0, Ce = 0, rn = Nt(0), ne = 0, or = null, Ut = 0, kl = 0, Ti = 0, Vn = null, ge = null, Li = 0, yn = 1 / 0, Je = null, il = !1, Vo = null, wt = null, _r = !1, pt = null, ul = 0, Bn = 0, Bo = null, jr = -1, $r = 0;
function he() {
  return j & 6 ? q() : jr !== -1 ? jr : jr = q();
}
function kt(e) {
  return e.mode & 1 ? j & 2 && ue !== 0 ? ue & -ue : id.transition !== null ? ($r === 0 && ($r = Os()), $r) : (e = A, e !== 0 || (e = window.event, e = e === void 0 ? 16 : Vs(e.type)), e) : 1;
}
function Ve(e, t, n, r) {
  if (50 < Bn)
    throw Bn = 0, Bo = null, Error(g(185));
  ur(e, n, r), (!(j & 2) || e !== le) && (e === le && (!(j & 2) && (kl |= n), ne === 4 && ft(e, ue)), Ee(e, r), n === 1 && j === 0 && !(t.mode & 1) && (yn = q() + 500, vl && _t()));
}
function Ee(e, t) {
  var n = e.callbackNode;
  of(e, t);
  var r = Qr(e, e === le ? ue : 0);
  if (r === 0)
    n !== null && Ji(n), e.callbackNode = null, e.callbackPriority = 0;
  else if (t = r & -r, e.callbackPriority !== t) {
    if (n != null && Ji(n), t === 1)
      e.tag === 0 ? od(Hu.bind(null, e)) : ia(Hu.bind(null, e)), td(function() {
        !(j & 6) && _t();
      }), n = null;
    else {
      switch (Ds(r)) {
        case 1:
          n = ni;
          break;
        case 4:
          n = Ms;
          break;
        case 16:
          n = Hr;
          break;
        case 536870912:
          n = Is;
          break;
        default:
          n = Hr;
      }
      n = lc(n, Ja.bind(null, e));
    }
    e.callbackPriority = t, e.callbackNode = n;
  }
}
function Ja(e, t) {
  if (jr = -1, $r = 0, j & 6)
    throw Error(g(327));
  var n = e.callbackNode;
  if (cn() && e.callbackNode !== n)
    return null;
  var r = Qr(e, e === le ? ue : 0);
  if (r === 0)
    return null;
  if (r & 30 || r & e.expiredLanes || t)
    t = sl(e, r);
  else {
    t = r;
    var l = j;
    j |= 2;
    var o = ba();
    (le !== e || ue !== t) && (Je = null, yn = q() + 500, Ot(e, t));
    do
      try {
        _d();
        break;
      } catch (u) {
        qa(e, u);
      }
    while (1);
    hi(), ol.current = o, j = l, ee !== null ? t = 0 : (le = null, ue = 0, t = ne);
  }
  if (t !== 0) {
    if (t === 2 && (l = ho(e), l !== 0 && (r = l, t = Ho(e, l))), t === 1)
      throw n = or, Ot(e, 0), ft(e, r), Ee(e, q()), n;
    if (t === 6)
      ft(e, r);
    else {
      if (l = e.current.alternate, !(r & 30) && !xd(l) && (t = sl(e, r), t === 2 && (o = ho(e), o !== 0 && (r = o, t = Ho(e, o))), t === 1))
        throw n = or, Ot(e, 0), ft(e, r), Ee(e, q()), n;
      switch (e.finishedWork = l, e.finishedLanes = r, t) {
        case 0:
        case 1:
          throw Error(g(345));
        case 2:
          Lt(e, ge, Je);
          break;
        case 3:
          if (ft(e, r), (r & 130023424) === r && (t = Li + 500 - q(), 10 < t)) {
            if (Qr(e, 0) !== 0)
              break;
            if (l = e.suspendedLanes, (l & r) !== r) {
              he(), e.pingedLanes |= e.suspendedLanes & l;
              break;
            }
            e.timeoutHandle = Co(Lt.bind(null, e, ge, Je), t);
            break;
          }
          Lt(e, ge, Je);
          break;
        case 4:
          if (ft(e, r), (r & 4194240) === r)
            break;
          for (t = e.eventTimes, l = -1; 0 < r; ) {
            var i = 31 - Ae(r);
            o = 1 << i, i = t[i], i > l && (l = i), r &= ~o;
          }
          if (r = l, r = q() - r, r = (120 > r ? 120 : 480 > r ? 480 : 1080 > r ? 1080 : 1920 > r ? 1920 : 3e3 > r ? 3e3 : 4320 > r ? 4320 : 1960 * Cd(r / 1960)) - r, 10 < r) {
            e.timeoutHandle = Co(Lt.bind(null, e, ge, Je), r);
            break;
          }
          Lt(e, ge, Je);
          break;
        case 5:
          Lt(e, ge, Je);
          break;
        default:
          throw Error(g(329));
      }
    }
  }
  return Ee(e, q()), e.callbackNode === n ? Ja.bind(null, e) : null;
}
function Ho(e, t) {
  var n = Vn;
  return e.current.memoizedState.isDehydrated && (Ot(e, t).flags |= 256), e = sl(e, t), e !== 2 && (t = ge, ge = n, t !== null && Qo(t)), e;
}
function Qo(e) {
  ge === null ? ge = e : ge.push.apply(ge, e);
}
function xd(e) {
  for (var t = e; ; ) {
    if (t.flags & 16384) {
      var n = t.updateQueue;
      if (n !== null && (n = n.stores, n !== null))
        for (var r = 0; r < n.length; r++) {
          var l = n[r], o = l.getSnapshot;
          l = l.value;
          try {
            if (!Be(o(), l))
              return !1;
          } catch {
            return !1;
          }
        }
    }
    if (n = t.child, t.subtreeFlags & 16384 && n !== null)
      n.return = t, t = n;
    else {
      if (t === e)
        break;
      for (; t.sibling === null; ) {
        if (t.return === null || t.return === e)
          return !0;
        t = t.return;
      }
      t.sibling.return = t.return, t = t.sibling;
    }
  }
  return !0;
}
function ft(e, t) {
  for (t &= ~Ti, t &= ~kl, e.suspendedLanes |= t, e.pingedLanes &= ~t, e = e.expirationTimes; 0 < t; ) {
    var n = 31 - Ae(t), r = 1 << n;
    e[n] = -1, t &= ~r;
  }
}
function Hu(e) {
  if (j & 6)
    throw Error(g(327));
  cn();
  var t = Qr(e, 0);
  if (!(t & 1))
    return Ee(e, q()), null;
  var n = sl(e, t);
  if (e.tag !== 0 && n === 2) {
    var r = ho(e);
    r !== 0 && (t = r, n = Ho(e, r));
  }
  if (n === 1)
    throw n = or, Ot(e, 0), ft(e, t), Ee(e, q()), n;
  if (n === 6)
    throw Error(g(345));
  return e.finishedWork = e.current.alternate, e.finishedLanes = t, Lt(e, ge, Je), Ee(e, q()), null;
}
function Ri(e, t) {
  var n = j;
  j |= 1;
  try {
    return e(t);
  } finally {
    j = n, j === 0 && (yn = q() + 500, vl && _t());
  }
}
function At(e) {
  pt !== null && pt.tag === 0 && !(j & 6) && cn();
  var t = j;
  j |= 1;
  var n = Ie.transition, r = A;
  try {
    if (Ie.transition = null, A = 1, e)
      return e();
  } finally {
    A = r, Ie.transition = n, j = t, !(j & 6) && _t();
  }
}
function Mi() {
  Ce = rn.current, Q(rn);
}
function Ot(e, t) {
  e.finishedWork = null, e.finishedLanes = 0;
  var n = e.timeoutHandle;
  if (n !== -1 && (e.timeoutHandle = -1, ed(n)), ee !== null)
    for (n = ee.return; n !== null; ) {
      var r = n;
      switch (di(r), r.tag) {
        case 1:
          r = r.type.childContextTypes, r != null && Gr();
          break;
        case 3:
          hn(), Q(ke), Q(pe), Si();
          break;
        case 5:
          ki(r);
          break;
        case 4:
          hn();
          break;
        case 13:
          Q(X);
          break;
        case 19:
          Q(X);
          break;
        case 10:
          vi(r.type._context);
          break;
        case 22:
        case 23:
          Mi();
      }
      n = n.return;
    }
  if (le = e, ee = e = St(e.current, null), ue = Ce = t, ne = 0, or = null, Ti = kl = Ut = 0, ge = Vn = null, Mt !== null) {
    for (t = 0; t < Mt.length; t++)
      if (n = Mt[t], r = n.interleaved, r !== null) {
        n.interleaved = null;
        var l = r.next, o = n.pending;
        if (o !== null) {
          var i = o.next;
          o.next = l, r.next = i;
        }
        n.pending = r;
      }
    Mt = null;
  }
  return e;
}
function qa(e, t) {
  do {
    var n = ee;
    try {
      if (hi(), Or.current = ll, rl) {
        for (var r = G.memoizedState; r !== null; ) {
          var l = r.queue;
          l !== null && (l.pending = null), r = r.next;
        }
        rl = !1;
      }
      if ($t = 0, re = te = G = null, Un = !1, nr = 0, zi.current = null, n === null || n.return === null) {
        ne = 1, or = t, ee = null;
        break;
      }
      e: {
        var o = e, i = n.return, u = n, s = t;
        if (t = ue, u.flags |= 32768, s !== null && typeof s == "object" && typeof s.then == "function") {
          var c = s, m = u, h = m.tag;
          if (!(m.mode & 1) && (h === 0 || h === 11 || h === 15)) {
            var p = m.alternate;
            p ? (m.updateQueue = p.updateQueue, m.memoizedState = p.memoizedState, m.lanes = p.lanes) : (m.updateQueue = null, m.memoizedState = null);
          }
          var w = Lu(i);
          if (w !== null) {
            w.flags &= -257, Ru(w, i, u, o, t), w.mode & 1 && Tu(o, c, t), t = w, s = c;
            var k = t.updateQueue;
            if (k === null) {
              var S = /* @__PURE__ */ new Set();
              S.add(s), t.updateQueue = S;
            } else
              k.add(s);
            break e;
          } else {
            if (!(t & 1)) {
              Tu(o, c, t), Ii();
              break e;
            }
            s = Error(g(426));
          }
        } else if (K && u.mode & 1) {
          var U = Lu(i);
          if (U !== null) {
            !(U.flags & 65536) && (U.flags |= 256), Ru(U, i, u, o, t), pi(vn(s, u));
            break e;
          }
        }
        o = s = vn(s, u), ne !== 4 && (ne = 2), Vn === null ? Vn = [o] : Vn.push(o), o = i;
        do {
          switch (o.tag) {
            case 3:
              o.flags |= 65536, t &= -t, o.lanes |= t;
              var f = Da(o, s, t);
              Cu(o, f);
              break e;
            case 1:
              u = s;
              var a = o.type, d = o.stateNode;
              if (!(o.flags & 128) && (typeof a.getDerivedStateFromError == "function" || d !== null && typeof d.componentDidCatch == "function" && (wt === null || !wt.has(d)))) {
                o.flags |= 65536, t &= -t, o.lanes |= t;
                var y = Fa(o, u, t);
                Cu(o, y);
                break e;
              }
          }
          o = o.return;
        } while (o !== null);
      }
      tc(n);
    } catch (E) {
      t = E, ee === n && n !== null && (ee = n = n.return);
      continue;
    }
    break;
  } while (1);
}
function ba() {
  var e = ol.current;
  return ol.current = ll, e === null ? ll : e;
}
function Ii() {
  (ne === 0 || ne === 3 || ne === 2) && (ne = 4), le === null || !(Ut & 268435455) && !(kl & 268435455) || ft(le, ue);
}
function sl(e, t) {
  var n = j;
  j |= 2;
  var r = ba();
  (le !== e || ue !== t) && (Je = null, Ot(e, t));
  do
    try {
      Nd();
      break;
    } catch (l) {
      qa(e, l);
    }
  while (1);
  if (hi(), j = n, ol.current = r, ee !== null)
    throw Error(g(261));
  return le = null, ue = 0, ne;
}
function Nd() {
  for (; ee !== null; )
    ec(ee);
}
function _d() {
  for (; ee !== null && !Zc(); )
    ec(ee);
}
function ec(e) {
  var t = rc(e.alternate, e, Ce);
  e.memoizedProps = e.pendingProps, t === null ? tc(e) : ee = t, zi.current = null;
}
function tc(e) {
  var t = e;
  do {
    var n = t.alternate;
    if (e = t.return, t.flags & 32768) {
      if (n = wd(n, t), n !== null) {
        n.flags &= 32767, ee = n;
        return;
      }
      if (e !== null)
        e.flags |= 32768, e.subtreeFlags = 0, e.deletions = null;
      else {
        ne = 6, ee = null;
        return;
      }
    } else if (n = gd(n, t, Ce), n !== null) {
      ee = n;
      return;
    }
    if (t = t.sibling, t !== null) {
      ee = t;
      return;
    }
    ee = t = e;
  } while (t !== null);
  ne === 0 && (ne = 5);
}
function Lt(e, t, n) {
  var r = A, l = Ie.transition;
  try {
    Ie.transition = null, A = 1, Pd(e, t, n, r);
  } finally {
    Ie.transition = l, A = r;
  }
  return null;
}
function Pd(e, t, n, r) {
  do
    cn();
  while (pt !== null);
  if (j & 6)
    throw Error(g(327));
  n = e.finishedWork;
  var l = e.finishedLanes;
  if (n === null)
    return null;
  if (e.finishedWork = null, e.finishedLanes = 0, n === e.current)
    throw Error(g(177));
  e.callbackNode = null, e.callbackPriority = 0;
  var o = n.lanes | n.childLanes;
  if (uf(e, o), e === le && (ee = le = null, ue = 0), !(n.subtreeFlags & 2064) && !(n.flags & 2064) || _r || (_r = !0, lc(Hr, function() {
    return cn(), null;
  })), o = (n.flags & 15990) !== 0, n.subtreeFlags & 15990 || o) {
    o = Ie.transition, Ie.transition = null;
    var i = A;
    A = 1;
    var u = j;
    j |= 4, zi.current = null, Sd(e, n), Ga(n, e), Yf(So), Wr = !!ko, So = ko = null, e.current = n, Ed(n), Jc(), j = u, A = i, Ie.transition = o;
  } else
    e.current = n;
  if (_r && (_r = !1, pt = e, ul = l), o = e.pendingLanes, o === 0 && (wt = null), ef(n.stateNode), Ee(e, q()), t !== null)
    for (r = e.onRecoverableError, n = 0; n < t.length; n++)
      l = t[n], r(l.value, { componentStack: l.stack, digest: l.digest });
  if (il)
    throw il = !1, e = Vo, Vo = null, e;
  return ul & 1 && e.tag !== 0 && cn(), o = e.pendingLanes, o & 1 ? e === Bo ? Bn++ : (Bn = 0, Bo = e) : Bn = 0, _t(), null;
}
function cn() {
  if (pt !== null) {
    var e = Ds(ul), t = Ie.transition, n = A;
    try {
      if (Ie.transition = null, A = 16 > e ? 16 : e, pt === null)
        var r = !1;
      else {
        if (e = pt, pt = null, ul = 0, j & 6)
          throw Error(g(331));
        var l = j;
        for (j |= 4, x = e.current; x !== null; ) {
          var o = x, i = o.child;
          if (x.flags & 16) {
            var u = o.deletions;
            if (u !== null) {
              for (var s = 0; s < u.length; s++) {
                var c = u[s];
                for (x = c; x !== null; ) {
                  var m = x;
                  switch (m.tag) {
                    case 0:
                    case 11:
                    case 15:
                      An(8, m, o);
                  }
                  var h = m.child;
                  if (h !== null)
                    h.return = m, x = h;
                  else
                    for (; x !== null; ) {
                      m = x;
                      var p = m.sibling, w = m.return;
                      if (Ka(m), m === c) {
                        x = null;
                        break;
                      }
                      if (p !== null) {
                        p.return = w, x = p;
                        break;
                      }
                      x = w;
                    }
                }
              }
              var k = o.alternate;
              if (k !== null) {
                var S = k.child;
                if (S !== null) {
                  k.child = null;
                  do {
                    var U = S.sibling;
                    S.sibling = null, S = U;
                  } while (S !== null);
                }
              }
              x = o;
            }
          }
          if (o.subtreeFlags & 2064 && i !== null)
            i.return = o, x = i;
          else
            e:
              for (; x !== null; ) {
                if (o = x, o.flags & 2048)
                  switch (o.tag) {
                    case 0:
                    case 11:
                    case 15:
                      An(9, o, o.return);
                  }
                var f = o.sibling;
                if (f !== null) {
                  f.return = o.return, x = f;
                  break e;
                }
                x = o.return;
              }
        }
        var a = e.current;
        for (x = a; x !== null; ) {
          i = x;
          var d = i.child;
          if (i.subtreeFlags & 2064 && d !== null)
            d.return = i, x = d;
          else
            e:
              for (i = a; x !== null; ) {
                if (u = x, u.flags & 2048)
                  try {
                    switch (u.tag) {
                      case 0:
                      case 11:
                      case 15:
                        wl(9, u);
                    }
                  } catch (E) {
                    J(u, u.return, E);
                  }
                if (u === i) {
                  x = null;
                  break e;
                }
                var y = u.sibling;
                if (y !== null) {
                  y.return = u.return, x = y;
                  break e;
                }
                x = u.return;
              }
        }
        if (j = l, _t(), Xe && typeof Xe.onPostCommitFiberRoot == "function")
          try {
            Xe.onPostCommitFiberRoot(fl, e);
          } catch {
          }
        r = !0;
      }
      return r;
    } finally {
      A = n, Ie.transition = t;
    }
  }
  return !1;
}
function Qu(e, t, n) {
  t = vn(n, t), t = Da(e, t, 1), e = gt(e, t, 1), t = he(), e !== null && (ur(e, 1, t), Ee(e, t));
}
function J(e, t, n) {
  if (e.tag === 3)
    Qu(e, e, n);
  else
    for (; t !== null; ) {
      if (t.tag === 3) {
        Qu(t, e, n);
        break;
      } else if (t.tag === 1) {
        var r = t.stateNode;
        if (typeof t.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (wt === null || !wt.has(r))) {
          e = vn(n, e), e = Fa(t, e, 1), t = gt(t, e, 1), e = he(), t !== null && (ur(t, 1, e), Ee(t, e));
          break;
        }
      }
      t = t.return;
    }
}
function zd(e, t, n) {
  var r = e.pingCache;
  r !== null && r.delete(t), t = he(), e.pingedLanes |= e.suspendedLanes & n, le === e && (ue & n) === n && (ne === 4 || ne === 3 && (ue & 130023424) === ue && 500 > q() - Li ? Ot(e, 0) : Ti |= n), Ee(e, t);
}
function nc(e, t) {
  t === 0 && (e.mode & 1 ? (t = vr, vr <<= 1, !(vr & 130023424) && (vr = 4194304)) : t = 1);
  var n = he();
  e = lt(e, t), e !== null && (ur(e, t, n), Ee(e, n));
}
function Td(e) {
  var t = e.memoizedState, n = 0;
  t !== null && (n = t.retryLane), nc(e, n);
}
function Ld(e, t) {
  var n = 0;
  switch (e.tag) {
    case 13:
      var r = e.stateNode, l = e.memoizedState;
      l !== null && (n = l.retryLane);
      break;
    case 19:
      r = e.stateNode;
      break;
    default:
      throw Error(g(314));
  }
  r !== null && r.delete(t), nc(e, n);
}
var rc;
rc = function(e, t, n) {
  if (e !== null)
    if (e.memoizedProps !== t.pendingProps || ke.current)
      we = !0;
    else {
      if (!(e.lanes & n) && !(t.flags & 128))
        return we = !1, yd(e, t, n);
      we = !!(e.flags & 131072);
    }
  else
    we = !1, K && t.flags & 1048576 && ua(t, qr, t.index);
  switch (t.lanes = 0, t.tag) {
    case 2:
      var r = t.type;
      Fr(e, t), e = t.pendingProps;
      var l = dn(t, pe.current);
      an(t, n), l = Ci(null, t, r, e, l, n);
      var o = xi();
      return t.flags |= 1, typeof l == "object" && l !== null && typeof l.render == "function" && l.$$typeof === void 0 ? (t.tag = 1, t.memoizedState = null, t.updateQueue = null, Se(r) ? (o = !0, Zr(t)) : o = !1, t.memoizedState = l.state !== null && l.state !== void 0 ? l.state : null, gi(t), l.updater = gl, t.stateNode = l, l._reactInternals = t, Lo(t, r, e, n), t = Io(null, t, r, !0, o, n)) : (t.tag = 0, K && o && fi(t), me(null, t, l, n), t = t.child), t;
    case 16:
      r = t.elementType;
      e: {
        switch (Fr(e, t), e = t.pendingProps, l = r._init, r = l(r._payload), t.type = r, l = t.tag = Md(r), e = je(r, e), l) {
          case 0:
            t = Mo(null, t, r, e, n);
            break e;
          case 1:
            t = Ou(null, t, r, e, n);
            break e;
          case 11:
            t = Mu(null, t, r, e, n);
            break e;
          case 14:
            t = Iu(null, t, r, je(r.type, e), n);
            break e;
        }
        throw Error(g(
          306,
          r,
          ""
        ));
      }
      return t;
    case 0:
      return r = t.type, l = t.pendingProps, l = t.elementType === r ? l : je(r, l), Mo(e, t, r, l, n);
    case 1:
      return r = t.type, l = t.pendingProps, l = t.elementType === r ? l : je(r, l), Ou(e, t, r, l, n);
    case 3:
      e: {
        if (Aa(t), e === null)
          throw Error(g(387));
        r = t.pendingProps, o = t.memoizedState, l = o.element, pa(e, t), tl(t, r, null, n);
        var i = t.memoizedState;
        if (r = i.element, o.isDehydrated)
          if (o = { element: r, isDehydrated: !1, cache: i.cache, pendingSuspenseBoundaries: i.pendingSuspenseBoundaries, transitions: i.transitions }, t.updateQueue.baseState = o, t.memoizedState = o, t.flags & 256) {
            l = vn(Error(g(423)), t), t = Du(e, t, r, n, l);
            break e;
          } else if (r !== l) {
            l = vn(Error(g(424)), t), t = Du(e, t, r, n, l);
            break e;
          } else
            for (xe = yt(t.stateNode.containerInfo.firstChild), Ne = t, K = !0, Ue = null, n = fa(t, null, r, n), t.child = n; n; )
              n.flags = n.flags & -3 | 4096, n = n.sibling;
        else {
          if (pn(), r === l) {
            t = ot(e, t, n);
            break e;
          }
          me(e, t, r, n);
        }
        t = t.child;
      }
      return t;
    case 5:
      return ma(t), e === null && Po(t), r = t.type, l = t.pendingProps, o = e !== null ? e.memoizedProps : null, i = l.children, Eo(r, l) ? i = null : o !== null && Eo(r, o) && (t.flags |= 32), Ua(e, t), me(e, t, i, n), t.child;
    case 6:
      return e === null && Po(t), null;
    case 13:
      return Va(e, t, n);
    case 4:
      return wi(t, t.stateNode.containerInfo), r = t.pendingProps, e === null ? t.child = mn(t, null, r, n) : me(e, t, r, n), t.child;
    case 11:
      return r = t.type, l = t.pendingProps, l = t.elementType === r ? l : je(r, l), Mu(e, t, r, l, n);
    case 7:
      return me(e, t, t.pendingProps, n), t.child;
    case 8:
      return me(e, t, t.pendingProps.children, n), t.child;
    case 12:
      return me(e, t, t.pendingProps.children, n), t.child;
    case 10:
      e: {
        if (r = t.type._context, l = t.pendingProps, o = t.memoizedProps, i = l.value, B(br, r._currentValue), r._currentValue = i, o !== null)
          if (Be(o.value, i)) {
            if (o.children === l.children && !ke.current) {
              t = ot(e, t, n);
              break e;
            }
          } else
            for (o = t.child, o !== null && (o.return = t); o !== null; ) {
              var u = o.dependencies;
              if (u !== null) {
                i = o.child;
                for (var s = u.firstContext; s !== null; ) {
                  if (s.context === r) {
                    if (o.tag === 1) {
                      s = tt(-1, n & -n), s.tag = 2;
                      var c = o.updateQueue;
                      if (c !== null) {
                        c = c.shared;
                        var m = c.pending;
                        m === null ? s.next = s : (s.next = m.next, m.next = s), c.pending = s;
                      }
                    }
                    o.lanes |= n, s = o.alternate, s !== null && (s.lanes |= n), zo(
                      o.return,
                      n,
                      t
                    ), u.lanes |= n;
                    break;
                  }
                  s = s.next;
                }
              } else if (o.tag === 10)
                i = o.type === t.type ? null : o.child;
              else if (o.tag === 18) {
                if (i = o.return, i === null)
                  throw Error(g(341));
                i.lanes |= n, u = i.alternate, u !== null && (u.lanes |= n), zo(i, n, t), i = o.sibling;
              } else
                i = o.child;
              if (i !== null)
                i.return = o;
              else
                for (i = o; i !== null; ) {
                  if (i === t) {
                    i = null;
                    break;
                  }
                  if (o = i.sibling, o !== null) {
                    o.return = i.return, i = o;
                    break;
                  }
                  i = i.return;
                }
              o = i;
            }
        me(e, t, l.children, n), t = t.child;
      }
      return t;
    case 9:
      return l = t.type, r = t.pendingProps.children, an(t, n), l = Oe(l), r = r(l), t.flags |= 1, me(e, t, r, n), t.child;
    case 14:
      return r = t.type, l = je(r, t.pendingProps), l = je(r.type, l), Iu(e, t, r, l, n);
    case 15:
      return ja(e, t, t.type, t.pendingProps, n);
    case 17:
      return r = t.type, l = t.pendingProps, l = t.elementType === r ? l : je(r, l), Fr(e, t), t.tag = 1, Se(r) ? (e = !0, Zr(t)) : e = !1, an(t, n), Oa(t, r, l), Lo(t, r, l, n), Io(null, t, r, !0, e, n);
    case 19:
      return Ba(e, t, n);
    case 22:
      return $a(e, t, n);
  }
  throw Error(g(156, t.tag));
};
function lc(e, t) {
  return Rs(e, t);
}
function Rd(e, t, n, r) {
  this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
}
function Me(e, t, n, r) {
  return new Rd(e, t, n, r);
}
function Oi(e) {
  return e = e.prototype, !(!e || !e.isReactComponent);
}
function Md(e) {
  if (typeof e == "function")
    return Oi(e) ? 1 : 0;
  if (e != null) {
    if (e = e.$$typeof, e === bo)
      return 11;
    if (e === ei)
      return 14;
  }
  return 2;
}
function St(e, t) {
  var n = e.alternate;
  return n === null ? (n = Me(e.tag, t, e.key, e.mode), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 14680064, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : { lanes: t.lanes, firstContext: t.firstContext }, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n;
}
function Ur(e, t, n, r, l, o) {
  var i = 2;
  if (r = e, typeof e == "function")
    Oi(e) && (i = 1);
  else if (typeof e == "string")
    i = 5;
  else
    e:
      switch (e) {
        case Yt:
          return Dt(n.children, l, o, t);
        case qo:
          i = 8, l |= 8;
          break;
        case bl:
          return e = Me(12, n, t, l | 2), e.elementType = bl, e.lanes = o, e;
        case eo:
          return e = Me(13, n, t, l), e.elementType = eo, e.lanes = o, e;
        case to:
          return e = Me(19, n, t, l), e.elementType = to, e.lanes = o, e;
        case ms:
          return Sl(n, l, o, t);
        default:
          if (typeof e == "object" && e !== null)
            switch (e.$$typeof) {
              case ds:
                i = 10;
                break e;
              case ps:
                i = 9;
                break e;
              case bo:
                i = 11;
                break e;
              case ei:
                i = 14;
                break e;
              case st:
                i = 16, r = null;
                break e;
            }
          throw Error(g(130, e == null ? e : typeof e, ""));
      }
  return t = Me(i, n, t, l), t.elementType = e, t.type = r, t.lanes = o, t;
}
function Dt(e, t, n, r) {
  return e = Me(7, e, r, t), e.lanes = n, e;
}
function Sl(e, t, n, r) {
  return e = Me(22, e, r, t), e.elementType = ms, e.lanes = n, e.stateNode = { isHidden: !1 }, e;
}
function Zl(e, t, n) {
  return e = Me(6, e, null, t), e.lanes = n, e;
}
function Jl(e, t, n) {
  return t = Me(4, e.children !== null ? e.children : [], e.key, t), t.lanes = n, t.stateNode = { containerInfo: e.containerInfo, pendingChildren: null, implementation: e.implementation }, t;
}
function Id(e, t, n, r, l) {
  this.tag = t, this.containerInfo = e, this.finishedWork = this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.pendingContext = this.context = null, this.callbackPriority = 0, this.eventTimes = Rl(0), this.expirationTimes = Rl(-1), this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = Rl(0), this.identifierPrefix = r, this.onRecoverableError = l, this.mutableSourceEagerHydrationData = null;
}
function Di(e, t, n, r, l, o, i, u, s) {
  return e = new Id(e, t, n, u, s), t === 1 ? (t = 1, o === !0 && (t |= 8)) : t = 0, o = Me(3, null, null, t), e.current = o, o.stateNode = e, o.memoizedState = { element: r, isDehydrated: n, cache: null, transitions: null, pendingSuspenseBoundaries: null }, gi(o), e;
}
function Od(e, t, n) {
  var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
  return { $$typeof: Kt, key: r == null ? null : "" + r, children: e, containerInfo: t, implementation: n };
}
function oc(e) {
  if (!e)
    return Ct;
  e = e._reactInternals;
  e: {
    if (Bt(e) !== e || e.tag !== 1)
      throw Error(g(170));
    var t = e;
    do {
      switch (t.tag) {
        case 3:
          t = t.stateNode.context;
          break e;
        case 1:
          if (Se(t.type)) {
            t = t.stateNode.__reactInternalMemoizedMergedChildContext;
            break e;
          }
      }
      t = t.return;
    } while (t !== null);
    throw Error(g(171));
  }
  if (e.tag === 1) {
    var n = e.type;
    if (Se(n))
      return oa(e, n, t);
  }
  return t;
}
function ic(e, t, n, r, l, o, i, u, s) {
  return e = Di(n, r, !0, e, l, o, i, u, s), e.context = oc(null), n = e.current, r = he(), l = kt(n), o = tt(r, l), o.callback = t ?? null, gt(n, o, l), e.current.lanes = l, ur(e, l, r), Ee(e, r), e;
}
function El(e, t, n, r) {
  var l = t.current, o = he(), i = kt(l);
  return n = oc(n), t.context === null ? t.context = n : t.pendingContext = n, t = tt(o, i), t.payload = { element: e }, r = r === void 0 ? null : r, r !== null && (t.callback = r), e = gt(l, t, i), e !== null && (Ve(e, l, i, o), Ir(e, l, i)), i;
}
function al(e) {
  if (e = e.current, !e.child)
    return null;
  switch (e.child.tag) {
    case 5:
      return e.child.stateNode;
    default:
      return e.child.stateNode;
  }
}
function Wu(e, t) {
  if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
    var n = e.retryLane;
    e.retryLane = n !== 0 && n < t ? n : t;
  }
}
function Fi(e, t) {
  Wu(e, t), (e = e.alternate) && Wu(e, t);
}
function Dd() {
  return null;
}
var uc = typeof reportError == "function" ? reportError : function(e) {
  console.error(e);
};
function ji(e) {
  this._internalRoot = e;
}
Cl.prototype.render = ji.prototype.render = function(e) {
  var t = this._internalRoot;
  if (t === null)
    throw Error(g(409));
  El(e, t, null, null);
};
Cl.prototype.unmount = ji.prototype.unmount = function() {
  var e = this._internalRoot;
  if (e !== null) {
    this._internalRoot = null;
    var t = e.containerInfo;
    At(function() {
      El(null, e, null, null);
    }), t[rt] = null;
  }
};
function Cl(e) {
  this._internalRoot = e;
}
Cl.prototype.unstable_scheduleHydration = function(e) {
  if (e) {
    var t = $s();
    e = { blockedOn: null, target: e, priority: t };
    for (var n = 0; n < ct.length && t !== 0 && t < ct[n].priority; n++)
      ;
    ct.splice(n, 0, e), n === 0 && As(e);
  }
};
function $i(e) {
  return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
}
function xl(e) {
  return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11 && (e.nodeType !== 8 || e.nodeValue !== " react-mount-point-unstable "));
}
function Ku() {
}
function Fd(e, t, n, r, l) {
  if (l) {
    if (typeof r == "function") {
      var o = r;
      r = function() {
        var c = al(i);
        o.call(c);
      };
    }
    var i = ic(t, r, e, 0, null, !1, !1, "", Ku);
    return e._reactRootContainer = i, e[rt] = i.current, Jn(e.nodeType === 8 ? e.parentNode : e), At(), i;
  }
  for (; l = e.lastChild; )
    e.removeChild(l);
  if (typeof r == "function") {
    var u = r;
    r = function() {
      var c = al(s);
      u.call(c);
    };
  }
  var s = Di(e, 0, !1, null, null, !1, !1, "", Ku);
  return e._reactRootContainer = s, e[rt] = s.current, Jn(e.nodeType === 8 ? e.parentNode : e), At(function() {
    El(t, s, n, r);
  }), s;
}
function Nl(e, t, n, r, l) {
  var o = n._reactRootContainer;
  if (o) {
    var i = o;
    if (typeof l == "function") {
      var u = l;
      l = function() {
        var s = al(i);
        u.call(s);
      };
    }
    El(t, i, e, l);
  } else
    i = Fd(n, t, e, l, r);
  return al(i);
}
Fs = function(e) {
  switch (e.tag) {
    case 3:
      var t = e.stateNode;
      if (t.current.memoizedState.isDehydrated) {
        var n = Mn(t.pendingLanes);
        n !== 0 && (ri(t, n | 1), Ee(t, q()), !(j & 6) && (yn = q() + 500, _t()));
      }
      break;
    case 13:
      At(function() {
        var r = lt(e, 1);
        if (r !== null) {
          var l = he();
          Ve(r, e, 1, l);
        }
      }), Fi(e, 1);
  }
};
li = function(e) {
  if (e.tag === 13) {
    var t = lt(e, 134217728);
    if (t !== null) {
      var n = he();
      Ve(t, e, 134217728, n);
    }
    Fi(e, 134217728);
  }
};
js = function(e) {
  if (e.tag === 13) {
    var t = kt(e), n = lt(e, t);
    if (n !== null) {
      var r = he();
      Ve(n, e, t, r);
    }
    Fi(e, t);
  }
};
$s = function() {
  return A;
};
Us = function(e, t) {
  var n = A;
  try {
    return A = e, t();
  } finally {
    A = n;
  }
};
fo = function(e, t, n) {
  switch (t) {
    case "input":
      if (lo(e, n), t = n.name, n.type === "radio" && t != null) {
        for (n = e; n.parentNode; )
          n = n.parentNode;
        for (n = n.querySelectorAll("input[name=" + JSON.stringify("" + t) + '][type="radio"]'), t = 0; t < n.length; t++) {
          var r = n[t];
          if (r !== e && r.form === e.form) {
            var l = hl(r);
            if (!l)
              throw Error(g(90));
            vs(r), lo(r, l);
          }
        }
      }
      break;
    case "textarea":
      gs(e, n);
      break;
    case "select":
      t = n.value, t != null && ln(e, !!n.multiple, t, !1);
  }
};
Ns = Ri;
_s = At;
var jd = { usingClientEntryPoint: !1, Events: [ar, Jt, hl, Cs, xs, Ri] }, zn = { findFiberByHostInstance: Rt, bundleType: 0, version: "18.3.1", rendererPackageName: "react-dom" }, $d = { bundleType: zn.bundleType, version: zn.version, rendererPackageName: zn.rendererPackageName, rendererConfig: zn.rendererConfig, overrideHookState: null, overrideHookStateDeletePath: null, overrideHookStateRenamePath: null, overrideProps: null, overridePropsDeletePath: null, overridePropsRenamePath: null, setErrorHandler: null, setSuspenseHandler: null, scheduleUpdate: null, currentDispatcherRef: it.ReactCurrentDispatcher, findHostInstanceByFiber: function(e) {
  return e = Ts(e), e === null ? null : e.stateNode;
}, findFiberByHostInstance: zn.findFiberByHostInstance || Dd, findHostInstancesForRefresh: null, scheduleRefresh: null, scheduleRoot: null, setRefreshHandler: null, getCurrentFiber: null, reconcilerVersion: "18.3.1-next-f1338f8080-20240426" };
if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
  var Pr = __REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!Pr.isDisabled && Pr.supportsFiber)
    try {
      fl = Pr.inject($d), Xe = Pr;
    } catch {
    }
}
Pe.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = jd;
Pe.createPortal = function(e, t) {
  var n = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
  if (!$i(t))
    throw Error(g(200));
  return Od(e, t, null, n);
};
Pe.createRoot = function(e, t) {
  if (!$i(e))
    throw Error(g(299));
  var n = !1, r = "", l = uc;
  return t != null && (t.unstable_strictMode === !0 && (n = !0), t.identifierPrefix !== void 0 && (r = t.identifierPrefix), t.onRecoverableError !== void 0 && (l = t.onRecoverableError)), t = Di(e, 1, !1, null, null, n, !1, r, l), e[rt] = t.current, Jn(e.nodeType === 8 ? e.parentNode : e), new ji(t);
};
Pe.findDOMNode = function(e) {
  if (e == null)
    return null;
  if (e.nodeType === 1)
    return e;
  var t = e._reactInternals;
  if (t === void 0)
    throw typeof e.render == "function" ? Error(g(188)) : (e = Object.keys(e).join(","), Error(g(268, e)));
  return e = Ts(t), e = e === null ? null : e.stateNode, e;
};
Pe.flushSync = function(e) {
  return At(e);
};
Pe.hydrate = function(e, t, n) {
  if (!xl(t))
    throw Error(g(200));
  return Nl(null, e, t, !0, n);
};
Pe.hydrateRoot = function(e, t, n) {
  if (!$i(e))
    throw Error(g(405));
  var r = n != null && n.hydratedSources || null, l = !1, o = "", i = uc;
  if (n != null && (n.unstable_strictMode === !0 && (l = !0), n.identifierPrefix !== void 0 && (o = n.identifierPrefix), n.onRecoverableError !== void 0 && (i = n.onRecoverableError)), t = ic(t, null, e, 1, n ?? null, l, !1, o, i), e[rt] = t.current, Jn(e), r)
    for (e = 0; e < r.length; e++)
      n = r[e], l = n._getVersion, l = l(n._source), t.mutableSourceEagerHydrationData == null ? t.mutableSourceEagerHydrationData = [n, l] : t.mutableSourceEagerHydrationData.push(
        n,
        l
      );
  return new Cl(t);
};
Pe.render = function(e, t, n) {
  if (!xl(t))
    throw Error(g(200));
  return Nl(null, e, t, !1, n);
};
Pe.unmountComponentAtNode = function(e) {
  if (!xl(e))
    throw Error(g(40));
  return e._reactRootContainer ? (At(function() {
    Nl(null, null, e, !1, function() {
      e._reactRootContainer = null, e[rt] = null;
    });
  }), !0) : !1;
};
Pe.unstable_batchedUpdates = Ri;
Pe.unstable_renderSubtreeIntoContainer = function(e, t, n, r) {
  if (!xl(n))
    throw Error(g(200));
  if (e == null || e._reactInternals === void 0)
    throw Error(g(38));
  return Nl(e, t, n, !1, r);
};
Pe.version = "18.3.1-next-f1338f8080-20240426";
function sc() {
  if (!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ > "u" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE != "function"))
    try {
      __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(sc);
    } catch (e) {
      console.error(e);
    }
}
sc(), ss.exports = Pe;
var Ud = ss.exports, ac, Yu = Ud;
ac = Yu.createRoot, Yu.hydrateRoot;
const Tn = (e) => `${e}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, Xu = {
  explain: "Explain the current code selection",
  "create-task": "Create a new Cappy task for: ",
  analyze: "Analyze the project structure and dependencies",
  search: "Search the codebase for: "
}, Ad = [
  {
    type: "currentFile",
    icon: "📄",
    label: "Current File",
    description: "Add the current file to context"
  },
  {
    type: "selection",
    icon: "✂️",
    label: "Selection",
    description: "Add current selection"
  },
  {
    type: "activeTask",
    icon: "📝",
    label: "Active Task",
    description: "Add current Cappy task"
  }
], Vd = {
  file: "📄",
  selection: "✂️",
  task: "📝",
  project: "📁",
  search: "🔍",
  prevention: "🛡️"
}, Bd = "🛠️", Hd = () => {
  var Qe;
  const e = D.useRef(), t = D.useRef(null), n = D.useRef(null), r = D.useRef([]), [l, o] = D.useState([]), [i, u] = D.useState(""), [s, c] = D.useState(0), [m, h] = D.useState([]), [p, w] = D.useState([]), [k, S] = D.useState("copilot-gpt-4"), [U, f] = D.useState(!1), [a, d] = D.useState(!1), [y, E] = D.useState(!1), [N, _] = D.useState([]), [P, V] = D.useState(!1), [T, oe] = D.useState({ active: !1, fullText: "" }), Ze = l.length > 0, Pt = D.useMemo(() => {
    const v = m.length;
    if (v === 0)
      return "";
    const M = v > 1 ? "items" : "item";
    return `${v} context ${M} attached`;
  }, [m]), Te = D.useCallback(() => {
    const v = t.current;
    v && requestAnimationFrame(() => {
      v.scrollTop = v.scrollHeight;
    });
  }, []), Ht = D.useCallback(() => (!e.current && typeof window < "u" && typeof window.acquireVsCodeApi == "function" && (e.current = window.acquireVsCodeApi()), e.current), []), He = D.useCallback((v) => {
    const M = Ht();
    M == null || M.postMessage(v);
  }, [Ht]), zt = D.useCallback((v, M) => {
    o(
      (F) => F.map(($) => {
        if ($.id !== v)
          return $;
        const W = M($.content);
        return {
          ...$,
          content: W,
          streaming: !1
        };
      })
    );
  }, []), C = D.useCallback(() => {
    const v = i.trim();
    if (!v)
      return;
    const M = Date.now(), $ = {
      id: Tn("user"),
      role: "user",
      content: v,
      timestamp: M
    }, W = [...r.current, { role: "user", content: v }];
    r.current = W.slice(-20), o((ae) => [...ae, $]), u(""), c(0), E(!1), d(!1), He({
      type: "agentQuery",
      prompt: v,
      model: k,
      context: m,
      history: r.current.slice(-10),
      tools: N
    }), V(!0), oe({ active: !1, fullText: "" }), Te();
  }, [N, m, i, He, Te, k]), L = D.useCallback((v) => {
    const M = Xu[v] ?? "";
    u(M), c(M.length), setTimeout(() => {
      var F;
      return (F = n.current) == null ? void 0 : F.focus();
    }, 0);
  }, []), R = D.useCallback((v) => {
    S(v), f(!1);
  }, []), Y = D.useCallback((v) => {
    const M = `@${v} `;
    u((F) => F.startsWith(M) ? F : `${M}${F}`), setTimeout(() => {
      var F;
      return (F = n.current) == null ? void 0 : F.focus();
    }, 0), d(!1);
  }, []), b = D.useCallback((v) => {
    He({
      type: "attachContext",
      contextType: v
    }), E(!1);
  }, [He]), Qt = D.useCallback((v) => {
    h((M) => M.filter((F, $) => $ !== v));
  }, []);
  return D.useEffect(() => {
    e.current || Ht(), He({ type: "requestInitialData" });
  }, [Ht, He]), D.useEffect(() => {
    const v = (M) => {
      const F = M.data;
      if (F != null && F.type)
        switch (F.type) {
          case "modelsList": {
            const $ = F.models;
            w($), $.length > 0 && S((W) => $.some((ae) => ae.id === W) ? W : $[0].id);
            break;
          }
          case "contextUpdate": {
            h(F.context);
            break;
          }
          case "toolsUpdate": {
            _(F.tools);
            break;
          }
          case "streamStart": {
            V(!0);
            const $ = Tn("assistant"), W = {
              id: $,
              role: "assistant",
              content: "",
              timestamp: Date.now(),
              streaming: !0
            };
            o((ae) => [...ae, W]), oe({ active: !0, messageId: $, fullText: "" }), Te();
            break;
          }
          case "streamChunk": {
            const $ = F.data;
            oe((W) => {
              if (!W.active || !W.messageId)
                return W;
              const ae = ($ == null ? void 0 : $.fullText) ?? "";
              return zt(W.messageId, () => ae), { ...W, fullText: ae };
            }), Te();
            break;
          }
          case "agentResponse": {
            const $ = F.data;
            if (V(!1), oe({ active: !1, fullText: "" }), $.newContext && $.newContext.length > 0 && h((W) => [...W, ...$.newContext]), T.active && T.messageId)
              zt(T.messageId, () => $.content ?? ""), o(
                (W) => W.map(
                  (ae) => ae.id === T.messageId ? { ...ae, streaming: !1 } : ae
                )
              );
            else {
              const W = {
                id: Tn("assistant"),
                role: "assistant",
                content: $.content ?? "",
                timestamp: Date.now()
              };
              o((ae) => [...ae, W]);
            }
            r.current = [...r.current, { role: "assistant", content: $.content ?? "" }].slice(-20), $.toolResults && $.toolResults.length > 0 && o((W) => [
              ...W,
              ...$.toolResults.map((ae) => ({
                id: Tn("tool"),
                role: "tool",
                content: "",
                timestamp: Date.now(),
                metadata: ae
              }))
            ]), Te();
            break;
          }
          case "error": {
            V(!1), oe({ active: !1, fullText: "" });
            const $ = {
              id: Tn("error"),
              role: "assistant",
              content: `❌ ${F.message}`,
              timestamp: Date.now()
            };
            o((W) => [...W, $]), Te();
            break;
          }
        }
    };
    return window.addEventListener("message", v), () => {
      window.removeEventListener("message", v);
    };
  }, [Te, T.active, T.messageId, zt]), D.useEffect(() => {
    const v = (M) => {
      const F = M.target;
      U && !F.closest(".model-selector") && f(!1), a && !F.closest(".tools-panel") && !F.closest("#toolsButton") && d(!1), y && !F.closest(".attach-panel") && !F.closest("#attachButton") && E(!1);
    };
    return document.addEventListener("click", v), () => document.removeEventListener("click", v);
  }, [y, U, a]), D.useEffect(() => {
    const v = (M) => {
      (M.ctrlKey || M.metaKey) && M.key === "Enter" && (M.preventDefault(), C());
    };
    return document.addEventListener("keydown", v), () => document.removeEventListener("keydown", v);
  }, [C]), D.useEffect(() => {
    if (n.current) {
      const v = n.current;
      v.style.height = "auto", v.style.height = `${Math.min(v.scrollHeight, 160)}px`;
    }
  }, [i]), D.useEffect(() => {
    Ze && Te();
  }, [Ze, Te]), /* @__PURE__ */ I("div", { className: "chat-container", children: [
    /* @__PURE__ */ I("header", { className: "chat-header", children: [
      /* @__PURE__ */ z("div", { className: "model-info", children: /* @__PURE__ */ I("div", { className: `model-selector ${U ? "open" : ""}`, children: [
        /* @__PURE__ */ I(
          "button",
          {
            type: "button",
            className: `model-button${U ? " open" : ""}`,
            id: "modelButton",
            onClick: () => f((v) => !v),
            children: [
              /* @__PURE__ */ z("span", { className: "model-icon", children: "🤖" }),
              /* @__PURE__ */ z("span", { className: "model-name", id: "modelName", children: ((Qe = p.find((v) => v.id === k)) == null ? void 0 : Qe.name) ?? "Select model" }),
              /* @__PURE__ */ z("span", { className: "model-arrow", children: "▼" })
            ]
          }
        ),
        U && /* @__PURE__ */ I("div", { className: "model-dropdown", id: "modelDropdown", children: [
          p.length === 0 && /* @__PURE__ */ z("div", { className: "model-empty", children: "No models detected" }),
          p.map((v) => /* @__PURE__ */ I(
            "div",
            {
              className: `model-option${v.id === k ? " selected" : ""}${v.available ? "" : " disabled"}`,
              "data-model": v.id,
              onClick: () => v.available && R(v.id),
              children: [
                /* @__PURE__ */ z("span", { className: "option-icon", children: Wd(v.provider) }),
                /* @__PURE__ */ I("div", { className: "option-info", children: [
                  /* @__PURE__ */ z("div", { className: "option-name", children: v.name }),
                  /* @__PURE__ */ z("div", { className: "option-desc", children: v.available ? "Available" : "Not configured" })
                ] })
              ]
            },
            v.id
          ))
        ] })
      ] }) }),
      /* @__PURE__ */ I("div", { className: `context-indicator ${m.length > 0 ? "active" : ""}`, children: [
        "📄 ",
        m.length > 0 ? `${m.length} Context Item${m.length > 1 ? "s" : ""}` : "No Context"
      ] })
    ] }),
    /* @__PURE__ */ I("div", { className: "chat-messages", id: "chatMessages", ref: t, children: [
      !Ze && /* @__PURE__ */ I("div", { className: "welcome-container", children: [
        /* @__PURE__ */ z("div", { className: "cappy-avatar", children: /* @__PURE__ */ z("span", { className: "avatar-icon", children: "🦫" }) }),
        /* @__PURE__ */ I("div", { className: "welcome-text", children: [
          /* @__PURE__ */ z("h3", { children: "Hi, I'm Cappy" }),
          /* @__PURE__ */ z("p", { children: "I'm an AI coding assistant that can help you with your development tasks. I have access to your project context and Cappy tools." })
        ] }),
        /* @__PURE__ */ z("div", { className: "quick-actions", children: Object.keys(Xu).map((v) => /* @__PURE__ */ I(
          "button",
          {
            className: "quick-action",
            "data-action": v,
            type: "button",
            onClick: () => L(v),
            children: [
              /* @__PURE__ */ z("span", { className: "action-icon", children: Gd(v) }),
              /* @__PURE__ */ z("span", { className: "action-text", children: Zd(v) })
            ]
          },
          v
        )) })
      ] }),
      l.filter((v) => v.id !== "welcome-message").map((v) => /* @__PURE__ */ z(Qd, { message: v }, v.id)),
      P && !T.active && /* @__PURE__ */ I("div", { className: "typing-indicator", id: "typing-indicator", children: [
        /* @__PURE__ */ I("div", { className: "message-header", children: [
          /* @__PURE__ */ z("div", { className: "message-avatar", children: "🦫" }),
          /* @__PURE__ */ z("div", { className: "message-author", children: "Cappy" })
        ] }),
        /* @__PURE__ */ I("div", { className: "typing-dots", children: [
          /* @__PURE__ */ z("div", { className: "typing-dot" }),
          /* @__PURE__ */ z("div", { className: "typing-dot" }),
          /* @__PURE__ */ z("div", { className: "typing-dot" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ I("footer", { className: "chat-input-container", children: [
      /* @__PURE__ */ z("div", { className: "chat-attachments", id: "chatAttachments", children: m.map((v, M) => /* @__PURE__ */ I("div", { className: "attachment-pill", children: [
        /* @__PURE__ */ I("span", { children: [
          Vd[v.type] ?? "📎",
          " ",
          v.name
        ] }),
        /* @__PURE__ */ z(
          "button",
          {
            type: "button",
            className: "attachment-remove",
            onClick: () => Qt(M),
            "aria-label": `Remove ${v.name}`,
            children: "×"
          }
        )
      ] }, `${v.type}-${M}`)) }),
      /* @__PURE__ */ I("div", { className: "chat-input-wrapper", children: [
        /* @__PURE__ */ I("div", { className: "chat-input-area", children: [
          /* @__PURE__ */ z(
            "button",
            {
              type: "button",
              className: "attach-button",
              id: "attachButton",
              title: "Attach context",
              onClick: () => E((v) => !v),
              children: /* @__PURE__ */ z("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ z("path", { d: "M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z" }) })
            }
          ),
          /* @__PURE__ */ z(
            "textarea",
            {
              id: "chatInput",
              ref: n,
              placeholder: "Ask Cappy...",
              rows: 1,
              maxLength: 8e3,
              value: i,
              onChange: (v) => {
                u(v.target.value), c(v.target.value.length);
              },
              onKeyDown: (v) => {
                v.key === "Enter" && !v.shiftKey && !v.ctrlKey && !v.metaKey && (v.preventDefault(), C());
              }
            }
          ),
          /* @__PURE__ */ z(
            "button",
            {
              type: "button",
              className: "send-button",
              id: "sendButton",
              disabled: i.trim().length === 0,
              onClick: C,
              children: /* @__PURE__ */ z("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ z("path", { d: "M.5 1.163A1 1 0 011.97.28l12.868 6.837a1 1 0 010 1.766L1.969 15.72A1 1 0 01.5 14.837V10.33a1 1 0 01.816-.983L8.5 8 1.316 6.653A1 1 0 01.5 5.67V1.163z" }) })
            }
          )
        ] }),
        /* @__PURE__ */ I("div", { className: "input-footer", children: [
          /* @__PURE__ */ z("div", { className: "context-info", id: "contextInfo", children: Pt }),
          /* @__PURE__ */ I("div", { className: "input-actions", children: [
            /* @__PURE__ */ I(
              "button",
              {
                type: "button",
                className: "tool-button",
                id: "toolsButton",
                title: "Available tools",
                onClick: () => d((v) => !v),
                children: [
                  /* @__PURE__ */ z("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true", children: /* @__PURE__ */ z("path", { d: "M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z" }) }),
                  "Tools"
                ]
              }
            ),
            /* @__PURE__ */ I("span", { className: `char-count${s > 7500 ? " warning" : ""}`, id: "charCount", children: [
              s,
              "/8000"
            ] })
          ] })
        ] })
      ] })
    ] }),
    a && /* @__PURE__ */ I("aside", { className: "tools-panel", id: "toolsPanel", children: [
      /* @__PURE__ */ I("div", { className: "tools-header", children: [
        /* @__PURE__ */ z("h4", { children: "Available Tools" }),
        /* @__PURE__ */ z("button", { type: "button", className: "close-tools", id: "closeTools", onClick: () => d(!1), children: "✕" })
      ] }),
      /* @__PURE__ */ I("div", { className: "tools-list", children: [
        N.length === 0 && /* @__PURE__ */ z("div", { className: "tool-empty", children: "No tools available" }),
        N.map((v) => /* @__PURE__ */ I(
          "div",
          {
            className: "tool-item",
            "data-tool": v.name,
            onClick: () => Y(v.name),
            children: [
              /* @__PURE__ */ z("div", { className: "tool-icon", children: v.icon || Bd }),
              /* @__PURE__ */ I("div", { className: "tool-info", children: [
                /* @__PURE__ */ z("div", { className: "tool-name", children: v.displayName }),
                /* @__PURE__ */ z("div", { className: "tool-desc", children: v.description })
              ] })
            ]
          },
          v.name
        ))
      ] })
    ] }),
    y && /* @__PURE__ */ I("aside", { className: "attach-panel", id: "attachPanel", children: [
      /* @__PURE__ */ I("div", { className: "attach-header", children: [
        /* @__PURE__ */ z("h4", { children: "Add Context" }),
        /* @__PURE__ */ z("button", { type: "button", className: "close-attach", id: "closeAttach", onClick: () => E(!1), children: "✕" })
      ] }),
      /* @__PURE__ */ z("div", { className: "attach-options", children: Ad.map((v) => /* @__PURE__ */ I(
        "div",
        {
          className: "attach-option",
          "data-type": v.type,
          onClick: () => b(v.type),
          children: [
            /* @__PURE__ */ z("div", { className: "attach-icon", children: v.icon }),
            /* @__PURE__ */ I("div", { className: "attach-info", children: [
              /* @__PURE__ */ z("div", { className: "attach-name", children: v.label }),
              /* @__PURE__ */ z("div", { className: "attach-desc", children: v.description })
            ] })
          ]
        },
        v.type
      )) })
    ] })
  ] });
}, Qd = ({ message: e }) => {
  const { role: t, content: n, streaming: r } = e, { avatar: l, author: o } = Kd(t);
  if (t === "system" && !n)
    return null;
  if (t === "tool" && e.metadata && "toolName" in e.metadata) {
    const i = e.metadata.toolName ?? "Tool", u = e.metadata.data ?? n;
    return /* @__PURE__ */ I("div", { className: "message tool", children: [
      /* @__PURE__ */ I("div", { className: "message-header", children: [
        /* @__PURE__ */ z("div", { className: "message-avatar", children: "🛠️" }),
        /* @__PURE__ */ z("div", { className: "message-author", children: i })
      ] }),
      /* @__PURE__ */ z("div", { className: "message-content", children: /* @__PURE__ */ z("pre", { children: Xd(u) }) })
    ] });
  }
  return /* @__PURE__ */ I("div", { className: `message ${t}${r ? " streaming" : ""}`, children: [
    /* @__PURE__ */ I("div", { className: "message-header", children: [
      /* @__PURE__ */ z("div", { className: "message-avatar", children: l }),
      /* @__PURE__ */ z("div", { className: "message-author", children: o })
    ] }),
    /* @__PURE__ */ z("div", { className: "message-content", dangerouslySetInnerHTML: { __html: Yd(n) } })
  ] });
};
function Wd(e) {
  switch (e) {
    case "openai":
      return "🧠";
    case "anthropic":
      return "🎭";
    case "azure":
      return "☁️";
    case "local":
      return "🦙";
    default:
      return "🤖";
  }
}
function Kd(e) {
  switch (e) {
    case "user":
      return { avatar: "👤", author: "You" };
    case "assistant":
      return { avatar: "🦫", author: "Cappy" };
    case "tool":
      return { avatar: "🛠️", author: "Tool" };
    default:
      return { avatar: "ℹ️", author: "System" };
  }
}
function Yd(e) {
  const t = [];
  let n = e.replace(/```(\w+)?\n([\s\S]*?)```/g, (r, l, o) => {
    const i = `@@CODE_BLOCK_${t.length}@@`;
    return t.push(`<pre class="code-block"><code>${Gu(o)}</code></pre>`), i;
  });
  return n = Gu(n), n = n.replace(/`([^`]+)`/g, (r, l) => `<code class="inline-code">${l}</code>`).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>").replace(/\n/g, "<br />"), t.forEach((r, l) => {
    n = n.replace(`@@CODE_BLOCK_${l}@@`, r);
  }), n;
}
function Xd(e) {
  if (typeof e == "string")
    return e;
  try {
    return JSON.stringify(e, null, 2);
  } catch {
    return String(e);
  }
}
function Gu(e) {
  return e.replace(/[&<>"']/g, (t) => {
    switch (t) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#039;";
      default:
        return t;
    }
  });
}
function Gd(e) {
  switch (e) {
    case "explain":
      return "💡";
    case "create-task":
      return "📝";
    case "analyze":
      return "📊";
    case "search":
      return "🔍";
    default:
      return "✨";
  }
}
function Zd(e) {
  switch (e) {
    case "explain":
      return "Explain this code";
    case "create-task":
      return "Create a task";
    case "analyze":
      return "Analyze project";
    case "search":
      return "Search codebase";
    default:
      return "Run action";
  }
}
const cc = document.getElementById("root");
if (!cc)
  throw new Error("Chat root element not found");
const Jd = ac(cc);
Jd.render(
  /* @__PURE__ */ z(Pc.StrictMode, { children: /* @__PURE__ */ z(Hd, {}) })
);
//# sourceMappingURL=chat.js.map
