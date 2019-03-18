/* Copyright 2015 Bloomberg Finance L.P.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var d3 = Object.assign({}, require("d3-selection"));
var _ = require("underscore");
var interaction = require("./Interaction");
var convert_dates = require('./utils').convert_dates;

var BaseSelector = interaction.Interaction.extend({

    initialize: function() {
        this.setElement(document.createElementNS(d3.namespaces.svg, "g"));
        this.d3el = d3.select(this.el);
        interaction.Interaction.__super__.initialize.apply(this, arguments);
    },

    render: function() {
        this.parent = this.options.parent;
        this.width = this.parent.width - this.parent.margin.left - this.parent.margin.right;
        this.height = this.parent.height - this.parent.margin.top - this.parent.margin.bottom;
        this.mark_views_promise = this.populate_mark_views();
    },

    create_listeners: function() {
        this.parent.on("margin_updated", this.relayout, this);
        this.listenTo(this.model, "change:selected", this.selected_changed);
        this.listenTo(this.model, "change:marks", this.marks_changed);
        this.listenTo(this.model, "msg:custom", this.handle_custom_messages);
    },

    relayout: function() {
        this.height = this.parent.height - this.parent.margin.top - this.parent.margin.bottom;
        this.width = this.parent.width - this.parent.margin.left - this.parent.margin.right;
    },

    populate_mark_views: function() {
        var fig = this.parent;
        var that = this;
        var mark_ids = this.model.get("marks").map(function(mark_model) {
            return mark_model.model_id; // Model ids of the marks of the selector
        });
        return Promise.all(fig.mark_views.views).then(function(views) {
            var fig_mark_ids = fig.mark_views._models.map(function(mark_model) {
                return mark_model.model_id;
            });  // Model ids of the marks in the figure
            var mark_indices = mark_ids.map(function(mark_model_id) {
                return fig_mark_ids.indexOf(mark_model_id); // look up based on model ids
            });
            that.mark_views = mark_indices.map(function(elem) {
                return views[elem]; // return the views, based on the assumption that fig.mark_views is an ordered list
            });
        });
    },

    marks_changed: function() {
        var that = this;
        this.populate_mark_views().then(function() {that.selected_changed();});
    },

    handle_custom_messages: function(msg) {
        if (msg.type === "reset") {
            this.reset();
        }
    },

    reset: function() {
        //inherited classes should implement this function
    },

    selected_changed: function() {
        //inherited classes should implement this function
    },

    set_selected: function(name, value) {
        this.model.set(name, convert_dates(value))
    }
});

var BaseXSelector = BaseSelector.extend({

    create_scales: function() {
        if(this.scale) {
            this.scale.remove();
        }
        if(this.model.get("scale")) {
            var that = this;
            return this.create_child_view(this.model.get("scale")).then(function(view) {
                that.scale = view;
                // The argument is to suppress the update to gui
                that.update_scale_domain(true);
                that.set_range([that.scale]);
                that.scale.on("domain_changed", that.update_scale_domain, that);
                return view;
            });
        }
    },

    update_scale_domain: function() {
        // When the domain of the scale is updated, the domain of the scale
        // for the selector must be expanded to account for the padding.
        var xy = (this.model.get("orientation") == "vertical") ? "y" : "x"
        var initial_range = this.parent.padded_range(xy, this.scale.model);
        var target_range = this.parent.range(xy);
        this.scale.expand_domain(initial_range, target_range);
    },

    set_range: function(array) {
        var xy = (this.model.get("orientation") == "vertical") ? "y" : "x"
        for(var iter = 0; iter < array.length; iter++) {
            array[iter].set_range(this.parent.range(xy));
        }
    },
});

var BaseXYSelector = BaseSelector.extend({

    create_scales: function() {
        var that = this;
        if(this.x_scale) {
            this.x_scale.remove();
        }
        if(this.y_scale) {
            this.y_scale.remove();
        }
        var scale_promises = [];
        if(this.model.get("x_scale")) {
            scale_promises.push(this.create_child_view(this.model.get("x_scale")).then(function(view) {
                that.x_scale = view;
                that.update_xscale_domain();
                that.set_x_range([that.x_scale]);
                that.x_scale.on("domain_changed", that.update_xscale_domain, that);
                return view;
            }));
        }
        if(this.model.get("y_scale")) {
            scale_promises.push(this.create_child_view(this.model.get("y_scale")).then(function(view) {
                that.y_scale = view;
                that.update_yscale_domain();
                that.set_y_range([that.y_scale]);
                that.y_scale.on("domain_changed", that.update_yscale_domain, that);
                return view;
            }));
        }

        return Promise.all(scale_promises);
    },

    set_x_range: function(array) {
        for(var iter = 0; iter < array.length; iter++) {
            array[iter].set_range(this.parent.range("x"));
        }
    },

    set_y_range: function(array) {
        for(var iter = 0; iter < array.length; iter++) {
            array[iter].set_range(this.parent.range("y"));
        }
    },

    update_xscale_domain: function() {
        // When the domain of the scale is updated, the domain of the scale
        // for the selector must be expanded to account for the padding.
        var initial_range = this.parent.padded_range("x", this.x_scale.model);
        var target_range = this.parent.range("x");
        this.x_scale.expand_domain(initial_range, target_range);
    },

    update_yscale_domain: function() {
        // When the domain of the scale is updated, the domain of the scale
        // for the selector must be expanded to account for the padding.
        var initial_range = this.parent.padded_range("y", this.y_scale.model);
        var target_range = this.parent.range("y");
        this.y_scale.expand_domain(initial_range, target_range);
    }
});

module.exports = {
    BaseSelector: BaseSelector,
    BaseXSelector: BaseXSelector,
    BaseXYSelector: BaseXYSelector
};
