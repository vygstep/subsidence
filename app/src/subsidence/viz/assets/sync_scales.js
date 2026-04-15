window.dash_clientside = window.dash_clientside || {};
window.dash_clientside.syncScales = {
    applyViewport: function (viewport, syncEnabled, graphIds) {
        if (!syncEnabled || !viewport) {
            return window.dash_clientside.no_update;
        }

        var targets = ["burial-multi", "burial-selected", "well-figure"];
        if (Array.isArray(graphIds)) {
            for (var i = 0; i < graphIds.length; i += 1) {
                var gid = graphIds[i];
                if (targets.indexOf(gid) === -1) {
                    targets.push(gid);
                }
            }
        }

        function resolvePlotElement(graphId) {
            var outer = document.getElementById(graphId);
            if (!outer) return null;
            if (outer._fullLayout) return outer;
            return outer.querySelector(".js-plotly-plot");
        }

        function axisKeys(el) {
            if (!el || !el._fullLayout) {
                return [];
            }
            return Object.keys(el._fullLayout).filter(function (key) {
                return /^yaxis\d*$/.test(key);
            });
        }

        function buildUpdate(el) {
            var update = {};
            var keys = axisKeys(el);
            for (var i = 0; i < keys.length; i += 1) {
                var axisKey = keys[i];
                update[axisKey + ".range[0]"] = viewport.r0;
                update[axisKey + ".range[1]"] = viewport.r1;
                update[axisKey + ".autorange"] = false;
            }
            return update;
        }

        function sameRange(el) {
            var keys = axisKeys(el);
            if (keys.length === 0) {
                return false;
            }
            for (var i = 0; i < keys.length; i += 1) {
                var axis = el._fullLayout[keys[i]];
                var current = axis && axis.range;
                if (!current || current.length !== 2) {
                    return false;
                }
                if (Math.abs(current[0] - viewport.r0) >= 1e-9 || Math.abs(current[1] - viewport.r1) >= 1e-9) {
                    return false;
                }
            }
            return true;
        }

        for (var i = 0; i < targets.length; i += 1) {
            var el = resolvePlotElement(targets[i]);
            if (!el || !el._fullLayout || sameRange(el)) {
                continue;
            }
            Plotly.relayout(el, buildUpdate(el));
        }

        return window.dash_clientside.no_update;
    }
};
