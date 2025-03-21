
import 'bootstrap-icons/font/bootstrap-icons.css';
import {
    DOMWidgetModel,
    DOMWidgetView,
    ISerializers,
    unpack_models,
} from '@jupyter-widgets/base';
import { ButtonModel } from '@jupyter-widgets/controls';
import { OutputModel } from '@jupyter-widgets/output';
import {
    IRenderMime,
    IRenderMimeRegistry,
} from '@jupyterlab/rendermime';
import { Widget } from '@lumino/widgets';

import '../css/widgets.css';
import { MODULE_NAME, MODULE_VERSION } from './version';


// Base model class for all PyRope widget models.
export class PyRopeWidgetModel extends DOMWidgetModel {
    defaults() {
        return {
            ...super.defaults(),

            _model_module: PyRopeWidgetModel.model_module,
            _model_module_version: PyRopeWidgetModel.model_module_version,
            _model_name: PyRopeWidgetModel.model_name,
            _view_module: PyRopeWidgetModel.view_module,
            _view_module_version: PyRopeWidgetModel.view_module_version,
            _view_name: PyRopeWidgetModel.view_name,
        }
    }

    static model_module = MODULE_NAME;
    static model_module_version = MODULE_VERSION;
    static model_name = 'PyRopeWidgetModel';
    static view_module = MODULE_NAME;
    static view_module_version = MODULE_VERSION;
    static view_name = 'PyRopeWidgetView';
}


// Base view class for all PyRope widget views.
export class PyRopeWidgetView extends DOMWidgetView {

    // This render mime registry is set when the extension gets loaded. The
    // registry is based on Jupyter's default registry and is used to render
    // Markdown, LaTeX and Python objects.
    static renderMimeRegistry: IRenderMimeRegistry;

    constructor(...args: any[]) {
        super(...args);
        this.init_callbacks();
    }

    // Callbacks can be initialized in this method for readability purposes, so
    // that they do not have to be initialized in the render method.
    init_callbacks() {}

    // Render a mime model with the render mime registry inside a host element.
    // The host element needs to be attached to the DOM tree, otherwise the
    // model cannot be attached to the host.
    async render_mime_model(model: IRenderMime.IMimeModel, host: HTMLElement) {
        const registry = PyRopeWidgetView.renderMimeRegistry;
        const mime_type = registry.preferredMimeType(model.data);
        if(mime_type !== undefined) {
            const renderer = registry.createRenderer(mime_type);
            await renderer.renderModel(model);
            Widget.attach(renderer, host);
        }
    }

    // Create and return a view for a given widget model.
    async create_widget_view(model: DOMWidgetModel) {
        const view = await model.widget_manager.create_view(model);
        // The "displayed" event needs to be triggered manually to actually
        // render a widget.
        view.trigger('displayed');
        return view;
    }

    // Render a widget model by creating its view and appending it to the
    // host element.
    async render_widget_model(model: DOMWidgetModel, host: HTMLElement) {
        const view = await this.create_widget_view(model);
        host.appendChild(view.el);
    }

    // Render a map of mime or widget models with a given render function
    // inside a given domain.
    render_models(
        models: Map<String, IRenderMime.IMimeModel | DOMWidgetModel>,
        render: (model: any, host: HTMLElement) => void, domain: HTMLElement
    ) {
        for(let [field_name, model] of models) {
            // A model which key is called field_name is rendered inside all
            // elements that have its field_name as value for the data
            // attribute "data-pyrope-field-name". Notice that models are only
            // rendered inside elements that are part of a given domain
            // element.
            const elements = domain.querySelectorAll<HTMLElement>(
                `[data-pyrope-field-name="${field_name}"]`
            );
            for (let i = 0; i < elements.length; i++) {
                render(model, elements[i]);
            }
        }
    }

    // Return a styled div element depending on the given type. Valid types
    // are info and warning. Raises an error for invalid types. The returned
    // container contains an icon which depends on the type and a span element
    // to show text.
    create_alert_box(type: string) {
        const container = document.createElement('div');
        container.classList.add('pyrope', 'alert');
        const icon = document.createElement('i');
        icon.classList.add('bi', 'pyrope');
        if (type === 'info') {
            container.classList.add('info');
            icon.classList.add('bi-info-circle');
        } else if (type === 'warning') {
            container.classList.add('warning');
            icon.classList.add('bi-exclamation-triangle');
        } else {
            throw new Error(
                "Alert box type has to be either 'info' or 'warning'."
            );
        }
        const content = document.createElement('span');
        content.classList.add('pyrope', 'alert-content')
        container.append(icon, content);
        return container;
    }

    // Render an alert box with a specific text. The host to be a container
    // which is structured like containers returned by "create_alert_box"
    // method. Furthermore the host needs to have the "alert" css class.
    render_alert_box(host: HTMLDivElement, text: string) {
        // The last child refers to the span element of an alert box.
        if (host.lastChild !== null) {
            host.lastChild.textContent = text;
        }

        // Hide the host container if the text string is empty and show it
        // otherwise.
        if (text === '') {
            host.classList.remove('show');
        } else {
            host.classList.add('show');
        }
    }
}


// Model class for PyRope's exercises.
export class ExerciseModel extends PyRopeWidgetModel {
    defaults() {
        return {
            ...super.defaults(),

            // List of markdown templates which are rendered as hints in the
            // _hints container.
            _displayed_hints: [],
            // A markdown template which is rendered as feedback in the
            // _feedback container.
            _feedback: '',
            // A dictionary where keys are output field names and values are
            // mime bundles. A mime bundle is a list of two dictionaries. One
            // dictionary contains representations of a Python object for
            // different mime types and the second one contains optional
            // metadata.
            _ofield_mime_bundles: {},
            // A markdown template which is rendered as the preamble in the
            // _preamble container.
            _preamble: '',
            // A markdown template which is rendered as the exercise's problem
            // in the _problem container. This is the only template where one
            // can use placeholders to render widgets.
            _problem: '',
            // A string which is rendered inside the _total_score_container
            // div element.
            _total_score: '',

            // Ipywidgets button model which clears all debug messages.
            clear_debug_btn: ButtonModel,
            // Boolean flag indicating the debug mode of an exercise.
            debug: false,
            // Ipywidgets output model for showing debug messages.
            debug_output: OutputModel,
            // Ipywidgets button model which renders the next hint if there is
            // one.
            hint_btn: ButtonModel,
            // Ipywidgets button model for submitting an exercise.
            submit_btn: ButtonModel,
            // Ipywidgets output model for showing standard output and errors
            // of an exercise's template methods.
            user_output: OutputModel,
            // A string which is rendered inside _warning container. If the
            // string is empty, _warning will not be displayed.
            warning: '',
            // A dictionary where keys are widget ids and values are widget
            // models.
            widgets: {},
        };
    }

    static serializers: ISerializers = {
        ...DOMWidgetModel.serializers,
        clear_debug_btn: { deserialize: unpack_models },
        debug_output: { deserialize: unpack_models },
        hint_btn: { deserialize: unpack_models },
        submit_btn: { deserialize: unpack_models },
        user_output: { deserialize: unpack_models },
        widgets: { deserialize: unpack_models },
    };

    static model_name = 'ExerciseModel';
    static view_name = 'ExerciseView';
}


// View class for PyRope's exercises.
export class ExerciseView extends PyRopeWidgetView {

    // Container for all buttons of an exercise.
    protected _button_area: HTMLDivElement;
    // Container for the output widget to show debug messages.
    protected _debug_area: HTMLDivElement;
    // Horizontal line to separate the debug area.
    protected _debug_area_separator: HTMLHRElement;
    // Container for rendering the feedback.
    protected _feedback: HTMLDivElement;
    // Horizontal line to separate the feedback.
    protected _feedback_separator: HTMLHRElement;
    // Container for rendering hints.
    protected _hints: HTMLDivElement;
    // A map which keys are ofield names and values are the corresponding
    // mime model to render them.
    protected _ofield_models: Map<string, IRenderMime.IMimeModel>;
    // Container for rendering the preamble.
    protected _preamble: HTMLDivElement;
    // Horizontal line to separate the preamble.
    protected _preamble_separator: HTMLHRElement;
    // Container for rendering the problem.
    protected _problem: HTMLDivElement;
    // Container for rendering the total score.
    protected _total_score_container: HTMLDivElement;
    // Container for rendering the output model which shows the standard output
    // and errors of an exercise's template methods.
    protected _user_output_area: HTMLDivElement;
    // Container for rendering warning messages, i.e. if there are empty and/or
    // invalid input fields).
    protected _warning: HTMLDivElement;

    init_callbacks() {
        this.model.on(
            'change:_ofield_mime_bundles', this.create_ofield_models, this
        );
        this.model.on('change:_feedback', this.render_feedback, this);
        this.model.on('change:_displayed_hints', this.render_hints, this);
        this.model.on('change:_preamble', this.render_preamble, this);
        this.model.on('change:_problem', this.render_problem, this);
        this.model.on('change:_total_score', () => {
            this.render_alert_box(
                this._total_score_container, this.model.get('_total_score')
            )
        }, this);
        this.model.on('change:debug', this.change_debug, this);
        this.model.on('change:warning', () => {
            this.render_alert_box(this._warning, this.model.get('warning'))
        }, this);
    }

    // Since models can only be rendered if the host element is attached to
    // the DOM tree (see PyRopeWidgetView.render_mime_model), the _render
    // method is executed after the container element of an exercise (this.el)
    // was attached.
    render() {
        this.displayed.then(() => this._render());
    }

    async _render() {
        this._user_output_area = document.createElement('div');
        this._user_output_area.classList.add('pyrope', 'user-output');

        this._preamble = document.createElement('div');
        this._preamble.classList.add('pyrope', 'preamble');
        this._preamble_separator = this.new_separator();
        // Only show a separator after the preamble if there actually is a
        // preamble.
        this._preamble_separator.classList.add('hide');

        this._problem = document.createElement('div');
        this._problem.classList.add('pyrope', 'problem');

        this._button_area = document.createElement('div');
        this._button_area.classList.add('pyrope', 'button-area');

        this._warning = this.create_alert_box('warning');

        this._hints = document.createElement('div');
        this._hints.classList.add('pyrope', 'hints');

        this._feedback = document.createElement('div');
        this._feedback.classList.add('pyrope', 'feedback');
        this._feedback_separator = this.new_separator();
        // Only show a separator after the feedback if there actually is
        // feedback.
        this._feedback_separator.classList.add('hide');

        this._total_score_container = this.create_alert_box('info');

        this._debug_area = document.createElement('div');
        this._debug_area.classList.add('pyrope', 'debug');
        this._debug_area_separator = this.new_separator();
        // Only show a separator after the debug area if the debug mode is on.
        this._debug_area_separator.classList.add('hide');

        // Append all elements to the host element of this view.
        this.el.append(
            this._user_output_area, this.new_separator(), this._preamble,
            this._preamble_separator, this._problem, this._button_area,
            this._warning, this._hints, this.new_separator(), this._feedback,
            this._total_score_container, this._feedback_separator,
            this._debug_area, this._debug_area_separator
        );

        // Call the rendering methods.
        this.create_ofield_models();
        this.render_user_output_area();
        this.render_preamble();
        this.render_problem();
        this.populate_button_area();
        this.render_alert_box(this._warning, this.model.get('warning'));
        this.render_hints();
        this.render_feedback();
        this.render_alert_box(
            this._total_score_container, this.model.get('_total_score')
        );
        this.render_debug_area();
    }

    // If the debug mode changes, the buttons, the debug and the user output
    // area need to be rerendered.
    change_debug() {
        this.render_user_output_area();
        this.populate_button_area();
        this.render_debug_area();
    }

    // Everytime the model's _ofield_mime_bundles attribute gets updated, this
    // method converts all mime bundles to mime models with the help of the
    // render mime registry.
    create_ofield_models() {
        this._ofield_models = new Map();
        let mime_types = this.model.get('_ofield_mime_bundles');
        for(let name in mime_types) {
            let format_dict = mime_types[name][0]
            let metadata = mime_types[name][1]
            let model = PyRopeWidgetView.renderMimeRegistry.createModel(
                {'data': format_dict, 'metadata': metadata}
            );
            this._ofield_models.set(name, model);
        }
    }

    // Return a styled hr element for separating specific sections of an
    // exercise.
    new_separator() {
        let separator = document.createElement('hr');
        separator.classList.add('pyrope');
        return separator;
    }

    // Render the user output area depending on the current debug mode.
    async render_user_output_area() {
        // Clear the user output area in case it was already rendered.
        this._user_output_area.replaceChildren();

        // Only show the user output area if the debug mode is enabled.
        if (this.model.get('debug')) {
            const user_output_view = await this.create_widget_view(
                this.model.get('user_output')
            );
            this._user_output_area.append(user_output_view.el);
        }
    }

    // Render the preamble and only show a separator after the preamble if
    // there actually is one.
    render_preamble() {
        const preamble_template = this.model.get('_preamble');
        this.render_ofields(preamble_template, this._preamble);
        if (preamble_template === '') {
            this._preamble_separator.classList.add('hide');
        } else {
            this._preamble_separator.classList.remove('hide');
        }
    }

    // Render the buttons of an exercise inside the button area. Which buttons
    // are shown, depends on the debug mode.
    async populate_button_area() {
        // Clear the button area in case it was already rendered.
        this._button_area.replaceChildren();

        // Create the submit and hint button and append them to the button
        // container. These buttons are always rendered.
        const submit_btn_view = await this.create_widget_view(
            this.model.get('submit_btn')
        );
        const hint_btn_view = await this.create_widget_view(
            this.model.get('hint_btn')
        );
        this._button_area.append(submit_btn_view.el, hint_btn_view.el);

        // The button for clearing the debug messages is only shown if the
        // debug mode is on.
        if (this.model.get('debug')) {
            const clear_debug_btn_view = await this.create_widget_view(
                this.model.get('clear_debug_btn')
            );
            this._button_area.append(clear_debug_btn_view.el);
        }
    }

    // Render the whole template with a Markdown renderer and then render all
    // output fields. Render the output fields first and then render the
    // template does not work for some reason.
    async render_ofields(
        template: string, host: HTMLDivElement | HTMLSpanElement
    ) {
        // Set the sanitized template so that all placeholder spans are
        // inserted into the DOM.
        template = PyRopeWidgetView.renderMimeRegistry.sanitizer.sanitize(
            template
        );
        host.innerHTML = template;
        if (template === '') { return }

        // All placeholder spans inside of a LaTeX environment need to be
        // replaced with the plain representation of the corresponding output
        // field. Otherwise these output fields could not be considered by the
        // Markdown renderer.
        this.render_models(this._ofield_models, (model, model_host) => {
            model_host.classList.add('pyrope', 'field', 'ofield');
            const format_spec = model_host.getAttribute(
                'data-pyrope-format-spec'
            );
            if (format_spec === 'latex') {
                model_host.replaceWith(String(model.data['text/plain']));
            }
        }, host);

        // When the template was set as the hosts inner HTML it got parsed. All
        // HTML special characters that would cause an invalid HTML subtree are
        // replace by their entity names (e.g. <: &lt;, >: &gt;, &: &amp;). To
        // decode these entity names a textarea element is used.
        // See: https://stackoverflow.com/questions/7394748/whats-the-right-way-to-decode-a-string-that-has-special-html-entities-in-it#7394787
        const decoder = document.createElement('textarea');
        decoder.innerHTML = host.innerHTML;
        // Clear the host div and render the template with a markdown
        // renderer.
        const template_model = PyRopeWidgetView.renderMimeRegistry.createModel(
            {'data': {'text/markdown': decoder.value}}
        );
        host.replaceChildren();
        await this.render_mime_model(template_model, host);

        // Render all output fields outside of an LaTeX environment inside
        // their placeholder span.
        this.render_models(this._ofield_models, this.render_mime_model, host);
    }

    // Render the problem.
    async render_problem() {
        // Get the problem template and render all output fields.
        const problem_template = this.model.get('_problem');
        await this.render_ofields(problem_template, this._problem);

        // Create a widget map with widget ids as keys and widget models as
        // values.
        const widgets = this.model.get('widgets');
        let widgets_map = new Map();
        for(let widget_id in widgets) {
            widgets_map.set(widget_id, widgets[widget_id]);
        }

        // Render the widget models.
        this.render_models(widgets_map, async (widget_model, widget_host) => {
            widget_host.classList.add('pyrope', 'field', 'ifield');
            this.render_widget_model(widget_model, widget_host);
        }, this._problem);
    }

    // Render all hints which are stored inside the attribute _displayed_hints.
    // Each hint is rendered inside an info alert box.
    render_hints() {
        const hints = this.model.get('_displayed_hints');
        this._hints.replaceChildren();
        for (let hint of hints) {
            const hint_container = this.create_alert_box('info');
            hint_container.classList.add('show');
            this._hints.append(hint_container);
            if (hint_container.lastChild !== null) {
                this.render_ofields(
                    hint, hint_container.lastChild as HTMLSpanElement
                );
            }
        }
    }

    // Render feedback and only show a separator after the feedback section if
    // there actually is feedback.
    render_feedback() {
        const feedback_template = this.model.get('_feedback');
        this.render_ofields(feedback_template, this._feedback);
        if (feedback_template === '') {
            this._feedback_separator.classList.add('hide');
        } else {
            this._feedback_separator.classList.remove('hide');
        }
    }

    // Render the debug area depending on the current debug mode.
    async render_debug_area() {
        // Clear the debug area in case it was already rendered.
        this._debug_area.replaceChildren();

        // Render the debug output and show the separator if the debug mode is
        // on and hide the separator otherwise.
        if (this.model.get('debug')) {
            const debug_output_view = await this.create_widget_view(
                this.model.get('debug_output')
            );
            const container = document.createElement('div');
            this._debug_area.appendChild(container);
            container.appendChild(debug_output_view.el);
            this._debug_area_separator.classList.remove('hide');
        } else {
            this._debug_area_separator.classList.add('hide');
        }
    }
}


// Base model class for PyRope's input widgets.
export class InputWidgetModel extends PyRopeWidgetModel {
    defaults() {
        return {
            ...super.defaults(),

            // A string which is rendered inside the _score_span container.
            _score: '',
            // A mime bundle which is a list of two dictionaries. One contains
            // representations of the solution Python object for different
            // mime types and the second one contains optional metadata.
            _solution_mime_bundle: [],

            // A boolean flag indicating whether the widget's input is correct
            // or not.
            correct: null,
            // A boolean flag indicating if the widgets is disabled or not.
            disabled: false,
            // A string which is shown when hovering over the widget.
            title: '',
            // A boolean flag indicating whether the widget's input is valid
            // or not.
            valid: null,
        }
    }

    static serializers: ISerializers = {
        ...DOMWidgetModel.serializers,
    };

    static model_name = 'InputWidgetModel';
    static view_name = 'InputWidgetView';
}


// Base view class for PyRope's input widgets. After every input widget a
// button for toggling a tooltip showing the score and the solution of a widget
// is rendered.
export class InputWidgetView extends PyRopeWidgetView {

    // Button to toggle a tooltip which contains the score and the solution of
    // an input widget.
    protected _result_btn: HTMLButtonElement;
    // Horizonzal line to separate the solution and the score inside the
    // tooltip.
    protected _result_separator: HTMLHRElement;
    // Container for the score.
    protected _score_span: HTMLSpanElement;
    // Container for the solution.
    protected _solution_span: HTMLSpanElement;
    // Container for the solution container, separator and score container.
    protected _tooltip: HTMLSpanElement;

    // Since every widget has the following attributes their callbacks are
    // initialized in the parent class.
    init_callbacks() {
        this.model.on('change:_score', this.render_score, this);
        this.model.on(
            'change:_solution_mime_bundle', this.render_solution, this
        );
        this.model.on('change:disabled', this.change_disabled, this);
        this.model.on('change:title', this.change_title, this);
        this.model.on('change:valid', this.change_valid, this);
        this.model.on('change:value', this.change_value, this);
    }

    // General render method for PyRope's input widgets. This method should be
    // invoked inside the render method of child classes so that every widget
    // has a button to show the solution and score. It should be called at the
    // end of the child class' render method so that the button will be
    // rendered behind an input widget.
    render() {
        // Take attribute's current values into account to render the view.
        // With that it is not necessary to call these methods in child
        // classes.
        this.change_disabled();
        this.change_title();
        this.change_valid();
        this.change_value();

        // Create a container which contains the result button.
        const tooltip_container = document.createElement('div');
        tooltip_container.classList.add('pyrope', 'tooltip');
        this.el.appendChild(tooltip_container);

        // Create a button for showing the results.
        this._result_btn = document.createElement('button');
        this._result_btn.classList.add('pyrope', 'ifield');
        this._result_btn.onclick = this.toggle_tooltip.bind(this);

        // Create a question mark icon.
        const question_icon = document.createElement('i');
        question_icon.classList.add('bi', 'bi-question-circle', 'pyrope');

        // Create _tooltip, _score_span, _result_separator and _solution_span
        // and append them to the tooltip container.
        this._tooltip = document.createElement('span');
        this._tooltip.classList.add('pyrope');
        this._score_span = document.createElement('span');
        this._result_separator = document.createElement('hr');
        this._result_separator.classList.add('pyrope', 'tooltip', 'hide');
        this._solution_span = document.createElement('span');
        this._tooltip.append(
            this._solution_span, this._result_separator, this._score_span
        );
        this._result_btn.append(question_icon, this._tooltip);
        tooltip_container.appendChild(this._result_btn);

        // Render the current score and solution inside the tooltip. The
        // rendering methods need to be called after this.el is displayed and
        // therefore part of the DOM tree because otherwise mime models cannot
        // be rendered. This is specifically needed to render solutions.
        this.displayed.then(() => {
            this.render_score();
            this.render_solution();
        });
    }

    // Abstract callback methods if an attribute gets updated. These methods
    // should be implemented in child classes.
    change_disabled() {}
    change_title() {}
    change_valid() {}
    change_value() {}

    // Render the score inside _score_span.
    render_score() {
        const score = this.model.get('_score');

        // If there is no score and no solution to show, the result button
        // is disabled.
        if (
            score === '' &&
            this.model.get('_solution_mime_bundle').length === 0
        ) {
            this._result_btn.disabled = true;
        } else {
            this._result_btn.disabled = false;
        }

        // If there is a score and a solution to show, score and solution are
        // separated by a horizonzal line. Otherwise the separator is hidden.
        if (
            score !== '' &&
            this.model.get('_solution_mime_bundle').length !== 0
        ) {
            this._result_separator.classList.remove('hide');
        } else {
            this._result_separator.classList.add('hide');
        }

        // Set the score string.
        this._score_span.textContent = score;
    }

    // Render the solution inside _solution_span.
    render_solution() {
        // Clear the solution span in case a solution was already rendered.
        this._solution_span.replaceChildren();
        const solution = this.model.get('_solution_mime_bundle');

        // If there is no score and no solution to show, the result button
        // is disabled.
        if (solution.length === 0 && this.model.get('_score') === '') {
            this._result_btn.disabled = true;
        } else {
            this._result_btn.disabled = false;
        }

        // If there is a score and a solution to show, score and solution are
        // separated by a horizonzal line. Otherwise the separator is hidden.
        if (solution.length !== 0 && this.model.get('_score') !== '') {
            this._result_separator.classList.remove('hide');
        } else {
            this._result_separator.classList.add('hide');
        }

        // Return if there is no mime bundle to render.
        if (solution.length === 0) { return }

        // Create and render the solution mime model.
        const model = PyRopeWidgetView.renderMimeRegistry.createModel(
            {'data': solution[0], 'metadata': solution[1]}
        );
        this.render_mime_model(model, this._solution_span);
    }

    // Show or hide the tooltip.
    toggle_tooltip() {
        this._tooltip.classList.toggle('show');
    }

    // Return a valid css widget class name depending on a boolean value.
    get_class_name(value: Boolean) {
        let class_name = 'pyrope';
        if (value === true) {
            class_name = 'pyrope valid';
        } else if (value === false) {
            class_name = 'pyrope invalid';
        }
        return class_name;
    }

    // Change the css class name of any DOM element. The class name is
    // determined by the model's attributes "disabled", "correct" and
    // "valid".
    change_class_name(element: any) {
        // Disable or enable the given element. This is important because the
        // style of an element can change based on if it is enabled or
        // disabled.
        const disabled = this.model.get('disabled');
        element.disabled = disabled;

        // If an input widget is disabled, it changes its style depending
        // on if the input is correct or not. If it is enabled, the style
        // changes based on if the input is valid or not.
        if (disabled === true) {
            element.className = this.get_class_name(
                this.model.get('correct')
            );
        } else {
            element.className = this.get_class_name(
                this.model.get('valid')
            );
        }
    }
}


export class CheckboxModel extends InputWidgetModel {
    defaults() {
        return {
            ...super.defaults(),

            // Checkboxes can only have true or false as a value. Defaults to
            // false which means that the Checkbox is unchecked.
            value: false,
        }
    }

    static model_name = 'CheckboxModel';
    static view_name = 'CheckboxView';
}


export class CheckboxView extends InputWidgetView {

    // Input element which holds the DOM checkbox element.
    protected _checkbox: HTMLInputElement;

    render() {
        // Create the checkbox element and bind a callback which is triggered
        // when the checkbox is clicked.
        this._checkbox = document.createElement('input');
        this._checkbox.type = 'checkbox';
        this._checkbox.onclick = this.change_on_click.bind(this);

        // Render the checkbox.
        this.el.append(this._checkbox);
        super.render();
    }

    change_disabled() {
        this.change_class_name(this._checkbox);
    }

    // Update the model when the state of the checkbox changes. This method is
    // bound to the click event of a checkbox.
    change_on_click() {
        this.model.set('value', this._checkbox.checked);
        this.model.save_changes();
    }

    change_title() {
        this._checkbox.title = this.model.get('title');
    }

    change_valid() {
        this.change_class_name(this._checkbox);
    }

    change_value() {
        this._checkbox.checked = this.model.get('value');
    }
}


export class DropdownModel extends InputWidgetModel {
    defaults() {
        return {
            ...super.defaults(),

            // The index of the currently selected option.
            _index: null,

            // A list of strings which are rendered to represent the options.
            labels: [],
        }
    }

    static model_name = 'DropdownModel';
    static view_name = 'DropdownView';
}


export class DropdownView extends InputWidgetView {

    // Select element which holds the DOM select element.
    protected _select: HTMLSelectElement;

    init_callbacks() {
        super.init_callbacks();
        this.model.on('change:_index', this.change_index, this);
        this.model.on('change:labels', this.change_labels, this);
    }

    render() {
        // Create the dropdown and and bind a callback which is triggered when
        // the selected label changes.
        this._select = document.createElement('select');
        this._select.onchange = this.change_on_change.bind(this);

        // Render the labels and select the label which is currently selected
        // according to the model.
        this.change_labels();
        this.change_index();

        // Render the dropdown.
        this.el.append(this._select);
        super.render();
    }

    change_disabled() {
        this.change_class_name(this._select);
    }

    // If the model's _index gets updated, a new label needs to be selected.
    // Notice that the (i + 1)th label is selected because of the additional
    // default option.
    change_index() {
        const i = this.model.get('_index');
        if (i !== null) {
            this._select.options[i + 1].selected = true;
        }
    }

    // Render the labels inside the select element.
    change_labels() {
        // Clear the select element in case that labels were already rendered.
        this._select.replaceChildren();

        // Create a hidden and empty default option which is selected by
        // default. Otherwise the first label would be selected by default.
        // Notice that this default option has to be considered when using
        // the selectedIndex attribute of the select element.
        const default_option = document.createElement('option');
        default_option.disabled = true;
        default_option.hidden = true;
        default_option.selected = true;
        this._select.append(default_option);

        // Create an option element for every label and append it to the
        // select element.
        const labels = this.model.get('labels');
        labels.forEach((element: string) => {
            const option = document.createElement('option');
            option.textContent = element;
            this._select.append(option);
        });
    }

    // Update the model when the selected label changes. _index has to be
    // updated to selectedIndex - 1 because of the additional default option.
    change_on_change() {
        this.model.set('_index', this._select.selectedIndex - 1);
        this.model.save_changes();
    }

    change_title() {
        this._select.title = this.model.get('title');
    }

    change_valid() {
        this.change_class_name(this._select);
    }
}


export class RadioButtonsModel extends InputWidgetModel {
    defaults() {
        return {
            ...super.defaults(),

            // The index of the currently selected option.
            _index: null,

            // A list of markdown templates which are rendered to represent the
            // options.
            labels: [],
            // Whether to render the radio buttons vertically or not.
            vertical: true,
        }
    }

    static model_name = 'RadioButtonsModel';
    static view_name = 'RadioButtonsView';
}


export class RadioButtonsView extends InputWidgetView {

    // Div Element which contains all radio button elements.
    protected _container: HTMLDivElement;
    // Array containing all radio button elements.
    protected _radio_buttons: Array<HTMLInputElement>;

    init_callbacks() {
        super.init_callbacks();
        this.model.on('change:_index', this.change_index, this);
        this.model.on('change:labels', this.change_labels, this);
        this.model.on('change:vertical', this.change_labels, this);
    }

    // Since labels can be markdown templates they have to be rendered with the
    // help of the render mime registry. This only works after the view is
    // displayed which means that this.el is part of the DOM tree.
    render() {
        this.displayed.then(() => this._render());
    }

    _render() {
        // Create the container.
        this._container = document.createElement('div');
        this._container.classList.add('pyrope');

        // Render the radio buttons and select the radio button which is
        // currently selected according to the model.
        this.change_labels();
        this.change_index();

        // Render the container.
        this.el.append(this._container);
        super.render();
    }

    change_disabled() {
        this._radio_buttons.forEach((btn: HTMLInputElement) => {
            this.change_class_name(btn);
        });
    }

    change_index() {
        const i = this.model.get('_index');
        if (i !== null) {
            this._radio_buttons[i].checked = true;
        }
    }

    // Render the radio buttons with the corresponding labels.
    change_labels() {
        // Clear the array and container in case that radio buttons were
        // already rendered.
        this._radio_buttons = new Array();
        this._container.replaceChildren();

        // Add a css class to the base container to render radio buttons
        // vertically.
        const vertical = this.model.get('vertical');
        if (vertical) {
            this.el.classList.add('pyrope-vertical-radio-buttons');
        } else {
            this.el.classList.remove('pyrope-vertical-radio-buttons');
        }

        const labels = this.model.get('labels');
        labels.forEach(async (element: string) => {
            // Create a radio button for every label. Use the view id (cid)
            // to connect multiple radio buttons to one radio button group.
            // Every view has a different cid therefore only radio buttons
            // of one specific view are considered as one group. Furthermore
            // add a callback to every radio button which gets triggered every
            // time the selected radio button changes.
            const radio_button = document.createElement('input');
            radio_button.type = 'radio';
            radio_button.classList.add('pyrope');
            radio_button.name = this.cid;
            radio_button.addEventListener('change', () => {
                this.change_on_change(this, radio_button)
            });
            this._radio_buttons.push(radio_button);

            // Create a label element and append it right behind the
            // corresponding radio button inside the DOM tree. Since labels
            // are markdown templates they have to be rendered via the render
            // mime registry.
            const label = document.createElement('label');
            label.classList.add('pyrope');
            this._container.append(radio_button, label);
            if (vertical) {
                this._container.append(document.createElement('br'));
            }
            const label_model = PyRopeWidgetView.renderMimeRegistry
            .createModel({'data': {'text/markdown': element}});
            await this.render_mime_model(label_model, label);
        });
    }

    // Update the model when the selected radio button changes.
    change_on_change(view: RadioButtonsView, radio_button: HTMLInputElement) {
        view.model.set('_index', this._radio_buttons.indexOf(radio_button));
        view.model.save_changes();
    }

    change_title() {
        this._container.title = this.model.get('title');
    }

    change_valid() {
        this._radio_buttons.forEach((btn: HTMLInputElement) => {
            this.change_class_name(btn);
        });
    }
}


export class SliderModel extends InputWidgetModel {
    defaults() {
        return {
            ...super.defaults(),

            // The slider's maximal value.
            maximum: 100.0,
            // The slider's minimal value.
            minimum: 0.0,
            // The step size while sliding.
            step: 1.0,
            // The slider's current value.
            value: 0.0,
            // The slider's width in percent. The percentage refers to the
            // width of the container the slider is contained by.
            width: 25,
        }
    }

    static model_name = 'SliderModel';
    static view_name = 'SliderView';
}


export class SliderView extends InputWidgetView {

    // Slider element which holds the DOM slider element.
    protected _slider: HTMLInputElement;
    // Container element for showing the current slider value.
    protected _slider_info: HTMLDivElement;

    init_callbacks() {
        super.init_callbacks();
        this.model.on('change:maximum', this.change_maximum, this);
        this.model.on('change:minimum', this.change_minimum, this);
        this.model.on('change:step', this.change_step, this);
        this.model.on('change:width', this.change_width, this);
    }

    render() {
        // Create the slider element.
        this._slider = document.createElement('input');
        this._slider.type = 'range';

        // Show and update the slider info container when an interaction
        // begins. Notice that mouse and touch events have to treated
        // separatly.
        this._slider.addEventListener('mousedown', () => {
            this.update_slider_info();
            this._slider_info.classList.toggle('show');
        });
        this._slider.addEventListener('touchstart', () => {
            this.update_slider_info();
            this._slider_info.classList.toggle('show');
        });

        // Update the slider info container when the slider's value changes.
        this._slider.addEventListener('input', () => {
            this.update_slider_info();
        });

        // Update the model and hide the info container when an interaction
        // ends.
        this._slider.addEventListener('mouseup', () => {
            this.change_on_interaction_end();
            this._slider_info.classList.toggle('show');
        });
        this._slider.addEventListener('touchend', () => {
            this.change_on_interaction_end();
            this._slider_info.classList.toggle('show');
        });

        // Consider the current values of the model's attributes to build the
        // view.
        this.change_maximum();
        this.change_minimum();
        this.change_step();
        this.change_width();

        // Create the slider info container and a div element which contains
        // the slider element and the info container.
        const container = document.createElement('div');
        container.classList.add('pyrope', 'slider-container');
        this._slider_info = document.createElement('div');
        this._slider_info.classList.add('pyrope', 'slider-info');

        // Render the slider.
        container.append(this._slider, this._slider_info);
        this.el.append(container);
        super.render();
    }

    change_disabled() {
        this.change_class_name(this._slider);
    }

    change_maximum() {
        this._slider.max = this.model.get('maximum');
    }

    change_minimum() {
        this._slider.min = this.model.get('minimum');
    }

    // Update the model when the slider's value changes.
    change_on_interaction_end() {
        this.model.set('value', parseFloat(this._slider.value));
        this.model.save_changes();
    }

    change_step() {
        this._slider.step = this.model.get('step');
    }

    change_title() {
        this._slider.title = this.model.get('title');
    }

    change_valid() {
        this.change_class_name(this._slider);
    }

    change_value() {
        this._slider.value = this.model.get('value');
        this.update_slider_info();
    }

    change_width() {
        this._slider.style.width = `${this.model.get('width')}%`;
    }

    // Set the content of _slider_info to the current value and calculate the
    // position of the info container so that it is always shown right above
    // the slider thumb.
    update_slider_info() {
        const thumb_width = parseInt(getComputedStyle(document.documentElement)
            .getPropertyValue('--slider-thumb-size'));
        const max = parseFloat(this._slider.max);
        const min = parseFloat(this._slider.min);
        const value = parseFloat(this._slider.value);
        this._slider_info.textContent = this._slider.value;
        const slider_width = this._slider.getBoundingClientRect().width;
        const info_width = this._slider_info.getBoundingClientRect().width;
        const ratio = (value - min) / (max - min);
        const offset = (ratio * (slider_width - thumb_width)) +
            (thumb_width / 2) - (info_width / 2);
        this._slider_info.style.left = `${offset}px`;
    }
}


export class TextModel extends InputWidgetModel {
    defaults() {
        return {
            ...super.defaults(),

            // A string which is shown inside the text input when the input is
            // empty.
            placeholder: '',
            // The current value of the text input.
            value_string: '',
            // The width of the text input. The value refers to the amount of
            // characters that fit into the text input.
            width: 20,
        };
    }

    static model_name = 'TextModel';
    static view_name = 'TextView';
}


export class TextView extends InputWidgetView {

    // Input element which holds the DOM text input element. _text needs to
    // be typed with HTMLTextAreaElement so that TextAreaView can inherit from
    // TextView.
    protected _text: HTMLInputElement | HTMLTextAreaElement;

    init_callbacks() {
        super.init_callbacks();
        this.model.on('change:placeholder', this.change_placeholder, this);
        this.model.on('change:value_string', this.change_value_string, this);
        this.model.on('change:width', this.change_width, this);
    }

    // Create the text input element.
    create_input_element() {
        this._text = document.createElement('input');
        this._text.type = 'text';
    }

    render() {
        // Create the text input element and bind a callback which is triggered
        // when the input value changes.
        this.create_input_element();
        this._text.oninput = this.change_on_input.bind(this);

        // Consider the current values of the model's attributes to build the
        // view.
        this.change_placeholder();
        this.change_width();

        // Render the text input.
        this.el.append(this._text)
        super.render();
    }

    change_disabled() {
        this.change_class_name(this._text);
    }

    // Update the model when the value of the text input element changes.
    change_on_input() {
        this.model.set('value_string', this._text.value);
        this.model.save_changes();
    }

    change_placeholder() {
        this._text.placeholder = this.model.get('placeholder');
    }

    change_title() {
        this._text.title = this.model.get('title');
    }

    change_valid() {
        this.change_class_name(this._text);
    }

    change_value_string() {
         this._text.value = this.model.get('value_string');
    }

    change_width() {
        this._text.style.width = `${this.model.get('width')}ch`;
    }
}


export class TextAreaModel extends TextModel {
    defaults() {
        return {
            ...super.defaults(),

            // The height of the text area. The value refers to the amount of
            // rows that fit into the text area element.
            height: 4,
            // The width of the text area. The value refers to the amount of
            // characters that fit into the text area element.
            width: 50,
        }
    }

    static model_name = 'TextAreaModel';
    static view_name = 'TextAreaView';
}


export class TextAreaView extends TextView {

    // Input element which holds the DOM textarea element.
    protected _text: HTMLTextAreaElement;

    init_callbacks() {
        super.init_callbacks();
        this.model.on('change:height', this.change_height, this);
    }

    render() {
        super.render();
        this.change_height();
    }

    create_input_element() {
        this._text = document.createElement('textarea');
    }

    change_height() {
        this._text.rows = this.model.get('height');
    }
}
