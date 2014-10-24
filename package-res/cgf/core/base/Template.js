
var cgf_Template = cgf.Template = cgf_TemplateMetaType.Ctor.configure({
    /**
     * Creates a template instance,
     * optionally given its parent template and configuration.
     *
     * @constructor
     * @param {cgf.Template} [parent=null] The parent template.
     * @param {object} [config] A configuration object.
     * @alias Template
     * @memberOf cgf
     */
    init: function(parent/*, config*/) {
        this._proto = null;

        /**
         * Gets the parent template, or `null`, if none.
         *
         * This property is immutable.
         *
         * @type cgf.Template
         */
        this.parent = parent || null;

        /**
         * Gets the child index of this template in its parent template, if any, or `-1`, if none.
         *
         * This property is immutable.
         *
         * @type number
         */
        this.childIndex = -1;

        /**
         * Gets the array of child templates.
         *
         * May be empty, but not `null`.
         *
         * Do **not** modify the contents of this array.
         *
         * @type Array.<cgf.Template>
         */
        this.children = [];

        /**
         * Gets the element class of this template instance,
         * or `null`, if not yet initialized.
         *
         * The element class of this template instance,
         * derives from its template class' own
         * element class, stored at {@link cgf.Template.Element}.
         *
         * This class is created lazily when the first element
         * of this template instance is created,
         * through {@link cgf.Template#createElement}.
         *
         * @type Function
         */
        this.Element = null;

        this.render = this.render.bind(this);
    },

    methods: /** @lends cgf.Template# */{

        /**
         * Gets the value of the specified property.
         *
         * @param {cgf.property} prop The property.
         * @return {any} The value of the property in this template, or `undefined`,
         * if not present.
         */
        get: function(prop) {
            var valueInfo = cgf_propsPrivProp(this)[prop.fullName];
            if(valueInfo) return valueInfo.value;
        },

        /**
         * Sets the value of the specified property to the specified value.
         *
         * @param {cgf.property} prop The property.
         * @param {any} value The new value.
         *
         * @return {cgf.Template} This instance.
         */
        set: function(prop, value) {
            if(value !== undefined) {
                var props = cgf_propsPrivProp(this),
                    fullName = prop.fullName,
                    isFun, callsBase, propBase;

                if(value === null) {
                    // Reset local value; Inherit.
                    // How to set local to non-inherit and to its default? auto?
                    // Need explicit values on the property domain to do that.
                    props[fullName] = null;
                } else {
                    if((isFun = def.fun.is(value))) {
                        if((callsBase = cgf_delegates(value))) propBase = props[fullName];
                    } else if(prop.cast) {
                        value = cgf_castValue(value, prop.cast);
                        // Failed cast. Do nothing.
                        if(value === null) return this;
                        // NOTE: it can be a function now, but it's taken as a constant value.
                    }
                    // value != null
                    props[fullName] = {
                        value:     value, // after cast, when constant
                        isFun:     isFun,
                        callsBase: callsBase || false,
                        base:      propBase  || null
                    };
                }
            }
            return this;
        },

        /**
         * Gets or sets a template's _prototype_ template.
         *
         * @param {cgf.Template} [proto] The new prototype template.
         * If `null`, the prototype template is cleared.
         * If the special {@link cgf.proto.parent} value is provided,
         * the prototype is set to this template's parent template.
         *
         * @return {cgf.Template} When set, this instance, when get, the current prototype template.
         */
        proto: function(proto) {
            if(arguments.length) return (this._proto = cgf_protoResolve(proto, this.parent)), this;
            return this._proto;
        },

        /**
         * Gets or sets a template's <i>prototype</i> template.
         *
         * This method exists for compatibility with
         * the {@link http://mbostock.github.com/protovis/ protovis} library.
         *
         * @deprecated Use {@link cgf.Template#proto} instead.
         * @method
         * @param {cgf.Template} [proto] The new prototype template.
         *
         * @return {cgf.Template} When set, this instance, when get, the current prototype template.
         */
        extend: def.configurable(false, function(proto) {
            return this.proto.apply(this, arguments);
        }),

        /**
         * Gets the child templates array or
         * adds child templates.
         *
         * When getting, do **not** modify the returned array.
         *
         * @see cgf.Template#add
         *
         * @param {Array} [content] An array of child templates to add
         * or a single child template.
         *
         * @return {Array.<cgf.Template>|cgf.Template}
         * When setting, this instance,
         * when getting, the current child templates array.
         */
        content: function(content) {
            return arguments.length
                ? (def.array.each(content, function(child) { this.add(child); }, this), this)
                : this.children;
        },

        /**
         * Adds a child template of a specified type,
         * and, optionally, configures it with a configuration object.
         *
         * @method
         *
         * @param {function} ChildTempl The child template _constructor_ function.
         * @param {object} [config] A configuration object to configure the
         * created child template.
         *
         * @return {cgf.Template} The new child template.
         *
         *
         * @example <caption>Adding a child template.</caption>
         * // A custom template class.
         * var Circle = cgf.Template.extend({
         *    properties: [
         *       cgf.property('radius', Number)
         *    ]
         * });
         *
         * var root = new cgf.Template();
         *
         * // Add a child of type Circle
         * // and fluently continue configuring it.
         * root.add(Circle)
         *     .radius(function(s, i) {
         *         return 5 + i;
         *     });
         */
        add: def.configurable(false, function(ChildTempl, config) {

            var child = cgf_template_create(ChildTempl, this, config);

            child.childIndex = this.children.push(child) - 1;

            this._onChildAdded(child);

            return child;
        }),

        /**
         * Called for each added child template.
         *
         * @param {cgf.Template} child The just added child template.
         *
         * @protected
         * @virtual
         */
        _onChildAdded: function(child) {},

        /** @private */
        _initElemClass: function() {
            return (this.Element = this.constructor.meta._buildElemClass(this));
        },

        /**
         * Creates an element of this template's element class,
         * optionally given a parent element, a scene and a scene index.
         *
         * @method
         * @param {cgf.Element} [parentElem=null] The parent element of the new element.
         * @param {object} [scene=null] The scene of the new element.
         * @param {number} [index=-1] The index of the scene specified in argument `scene`.
         *
         * @return {cgf.TemplatedElement} The new element of
         * the class of element of this template: {@link cgf.Template#Element}.
         */
        createElement: def.configurable(false, function(parentElem, scene, index) {
            var Element = this.Element || this._initElemClass();
            return new Element(parentElem, scene, index);
        }),


        // This method is generated in #_buildElemClass.
        // _evalScenes: function() {},

        evalScenes: def.configurable(false, function(parentScene) {
            // Also creates _evalScenes
            if(!this.Element) this._initElemClass();

            // Evaluate `scenes` having as JS context an object with scene and index properties.
            // This allows us to reuse the way properties are compiled - assuming an Element as JS context.
            return this._evalScenes.call({scene: parentScene || null, index: -1});
        }),

        /**
         * Generates a list of elements of this template,
         * given the specified parent scene.
         *
         * @method
         * @param {object} [parentScene] The parent scene,
         * in which this template's `scenes` property is evaluated to
         * obtain the scenes to spawn this template with.
         *
         * @return {Array.<cgf.TemplatedElement>} An array of elements of
         * the class of element of this template: {@link cgf.Template#Element}.
         *
         * @see cgf.Template#createElement
         */
        spawn: def.configurable(false, function(parentScene) {
            return this.spawnScenes(/*parentElem*/null, this.evalScenes(parentScene));
        }),

        spawnScenes: def.configurable(false, function(parentElem, scenes) {
            if(!scenes) throw def.error.argumentRequired("scenes");

            return scenes.map(function(scene, index) {
                return this.createElement(parentElem, scene, index);
            }, this);
        }),

        /**
         * Renders the template in the provided d3 update selection.
         *
         * This method can be called without care for the JavaScript instance.
         * This makes it ideal for passing it to d3.Selection#call.
         *
         * @example <caption>Calling <i>render</i> using a d3 selection's <i>call</i> method.</caption>
         * var root = new cgf.Template();
         *
         * d3.select('#example')
         *   .data([1, 2])
         *   .call(root.render);
         *
         * @see cgf.render
         *
         * @method
         *
         * @param {d3.Selection} d3Sel The d3 selection object.
         * @return {cgf.Template} `this` template.
         */
        render: def.configurable(false, function(d3Sel) {
            this._render(d3Sel);
            return this;
        }),

        /**
         * Actually renders a template in a _d3_ selection.
         *
         * The default implementation does nothing.
         *
         * @param {d3.Selection} d3Sel The d3 selection object.
         * @protected
         * @virtual
         */
        _render: function(d3Sel) {
            // Do something
        }
    },

    properties: [
        /**
         * Gets or sets the scene values that
         * spawn the elements of a template instance.
         *
         * This is the template accessor
         * of property {@link cgf.props.scenes}.
         *
         * @name cgf.Template#scenes
         * @method
         * @param {function|Array} [scenes] An array of scenes or,
         * a function that given a parent scene returns one.
         *
         * @return {function|Array|cgf.Template}
         * When getting, the value of the property,
         * when setting, the `this` value.
         *
         * @template-property scenes
         */
        cgf_props.scenes,

        /**
         * Gets or sets the "applicable" value or
         * element evaluator function.
         *
         * This is the template accessor
         * of property {@link cgf.props.applicable}.
         *
         * @name cgf.Template#applicable
         * @method
         * @param {function|boolean} [applicable] A boolean value or function.
         * @return {function|boolean|cgf.Template}
         * When getting, the value of the property,
         * when setting, the `this` value.
         *
         * @template-property applicable
         */
        cgf_props.applicable
    ]
});

// Set a global defaults instance.

cgf_Template.type().add({
    defaults: new cgf_Template()
        // Default behavior is to propagate the parent scene,
        // spawning a single child of this (child) template meta-type.
        .scenes(function(parentScene) { return [parentScene]; })
        .applicable(true)
});

// ------------------

function cgf_protoResolve(proto, parent) {
    return (proto === cgf_protoParent ? parent : proto) || null;
}

// TODO: shouldn't this be a tryConfigure for the template class?
// ChildTemplCtor is a Template instance,
// a Template Ctor, or
// an object with a {$type: property}
// The type property either is a string with the name of the type or a Template Ctor.
// For now, only the Template Ctor is supported.

// TODO: template type registry? or some way directly handled by def.configure?

function cgf_template_create(ChildTemplCtor, parent, config) {
    var child;
    if(ChildTemplCtor instanceof cgf_Template) {
        child = ChildTemplCtor;
        if(child.parent !== parent)
            throw def.error.argumentInvalid("child", "Does not have this as parent.");
        // proto and config ignored
    } else if(def.fun.is(ChildTemplCtor)){
        child = new ChildTemplCtor(parent, config);
    } else {
        // Assume a configuration object. Ignore config.
        config = ChildTemplCtor;
        var $type = config.$type;
        if(def.fun.is($type)) {
            ChildTemplCtor = $type;
            child = new ChildTemplCtor(parent, config);
        } else {
            throw def.error.argumentInvalid('ChildTemplCtor', "$type is not a template class.");
        }
    }
    return child;
}
