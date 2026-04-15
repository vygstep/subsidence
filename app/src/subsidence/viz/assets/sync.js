window.dash_clientside = window.dash_clientside || {};
window.dash_clientside.sync = {
    // Called when depth-viewport changes; syncs separate track graphs (Phase 3+).
    // r0 = yaxis.range[0] (bottom/deeper), r1 = yaxis.range[1] (top/shallower).
    syncDepthViewport: function (viewport, graphIds) {
        if (!viewport || !graphIds || graphIds.length === 0) {
            return window.dash_clientside.no_update;
        }
        var update = {
            "yaxis.range[0]": viewport.r0,
            "yaxis.range[1]": viewport.r1,
            "yaxis.autorange": false
        };
        graphIds.forEach(function (gid) {
            var outer = document.getElementById(gid);
            if (!outer) return;
            var el = outer._fullLayout
                ? outer
                : (outer.querySelector(".js-plotly-plot") || null);
            if (el && el._fullLayout) {
                Plotly.relayout(el, update);
            }
        });
        return window.dash_clientside.no_update;
    }
};
