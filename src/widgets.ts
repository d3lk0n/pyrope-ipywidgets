
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
    // that they do not have to be initialized in the render methode.
    init_callbacks() {}

    // Render a mime model with the render mime registry inside a host element.
    // The host element needs to be attached to the DOM tree, otherwise the
    // model cannot be attached to the host.
    async render_model(model: IRenderMime.IMimeModel, host: HTMLElement) {
        const registry = PyRopeWidgetView.renderMimeRegistry;
        const mime_type = registry.preferredMimeType(model.data);
        if(mime_type !== undefined) {
            const renderer = registry.createRenderer(mime_type);
            await renderer.renderModel(model);
            Widget.attach(renderer, host);
        }
    }
}


// Model class for PyRope's exercises.
export class ExerciseModel extends PyRopeWidgetModel {
    defaults() {
        return {
            ...super.defaults(),

            _displayed_hints: [],
            _feedback: '',
            _ofield_mime_bundles: {},
            _preamble: '',
            _problem: '',
            _total_score: '',

            clear_debug_btn: ButtonModel,
            debug: false,
            debug_output: OutputModel,
            hint_btn: ButtonModel,
            submit_btn: ButtonModel,
            warning: '',
            widgets: {},
        };
    }

    static serializers: ISerializers = {
        ...DOMWidgetModel.serializers,
        clear_debug_btn: { deserialize: unpack_models },
        debug_output: { deserialize: unpack_models },
        hint_btn: { deserialize: unpack_models },
        submit_btn: { deserialize: unpack_models },
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

    // Horizontal line to separator the debug area.
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
    // the DOM tree (see PyRopeWidgetView.render_model), the _render method is
    // executed after the container element of an exercise (this.el) was
    // attached.
    render() {
        this.displayed.then(() => this._render());
    }

    async _render() {
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
            this.new_separator(), this._preamble, this._preamble_separator,
            this._problem, this._button_area, this._warning, this._hints,
            this.new_separator(), this._feedback, this._total_score_container,
            this._feedback_separator, this._debug_area,
            this._debug_area_separator
        );

        // Call the rendering methods.
        this.create_ofield_models();
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

    // If the debug mode changes, the buttons and the debug area need to be
    // rerendered.
    change_debug() {
        this.populate_button_area();
        this.render_debug_area();
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

    // Create and return a view for a given widget model.
    async create_widget_view(model: DOMWidgetModel) {
        const view = await model.widget_manager.create_view(model);
        // The "displayed" event needs to be triggered manually to actually
        // render a widget.
        view.trigger('displayed');
        return view;
    }

    // Render all output fields and then render the whole template with a
    // Markdown renderer does not work for some reason.
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

        // Clear the host div and render the template with a markdown
        // renderer.
        const template_model = PyRopeWidgetView.renderMimeRegistry.createModel(
            {'data': {'text/markdown': host.innerHTML}}
        );
        host.replaceChildren();
        await this.render_model(template_model, host);

        // Render all output fields outside of an LaTeX environment inside
        // their placeholder span.
        this.render_models(this._ofield_models, this.render_model, host);
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
            const view = await this.create_widget_view(widget_model);
            widget_host.appendChild(view.el);
        }, this._problem);
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


export class InputWidgetModel extends PyRopeWidgetModel {
    defaults() {
        return {
            ...super.defaults(),

            _score: '',
            _solution_mime_bundle: [],

            correct: null,
            disabled: false,
            title: '',
            valid: null,
        }
    }

    static serializers: ISerializers = {
        ...DOMWidgetModel.serializers,
    };

    static model_name = 'InputWidgetModel';
    static view_name = 'InputWidgetView';
}


export class InputWidgetView extends PyRopeWidgetView {

    protected _result_btn: HTMLButtonElement;
    protected _result_separator: HTMLHRElement;
    protected _score_span: HTMLSpanElement;
    protected _solution_span: HTMLSpanElement;
    protected _tooltip: HTMLSpanElement;

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

    render() {
        this.change_disabled();
        this.change_title();
        this.change_valid();
        this.change_value();

        const tooltip_container = document.createElement('div');
        tooltip_container.classList.add('pyrope', 'tooltip');
        this.el.appendChild(tooltip_container);
        this._result_btn = document.createElement('button');
        this._result_btn.classList.add('pyrope', 'ifield');
        this._result_btn.onclick = this.toggle_tooltip.bind(this);
        const question_icon = document.createElement('i');
        question_icon.classList.add('bi', 'bi-question-circle', 'pyrope');
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
        this.displayed.then(() => {
            this.render_score();
            this.render_solution();
        });
    }

    change_disabled() {}

    change_title() {}

    change_valid() {}

    change_value() {}

    render_score() {
        const score = this.model.get('_score');
        if (
            score === '' &&
            this.model.get('_solution_mime_bundle').length === 0
        ) {
            this._result_btn.disabled = true;
        } else {
            this._result_btn.disabled = false;
        }
        if (
            score !== '' &&
            this.model.get('_solution_mime_bundle').length !== 0
        ) {
            this._result_separator.classList.remove('hide');
        } else {
            this._result_separator.classList.add('hide');
        }
        this._score_span.textContent = score;
    }

    render_solution() {
        this._solution_span.replaceChildren();
        const solution = this.model.get('_solution_mime_bundle');
        if (solution.length === 0 && this.model.get('_score') === '') {
            this._result_btn.disabled = true;
        } else {
            this._result_btn.disabled = false;
        }
        if (solution.length !== 0 && this.model.get('_score') !== '') {
            this._result_separator.classList.remove('hide');
        } else {
            this._result_separator.classList.add('hide');
        }
        if (solution.length === 0) { return }
        const model = PyRopeWidgetView.renderMimeRegistry.createModel(
            {'data': solution[0], 'metadata': solution[1]}
        );
        this.render_model(model, this._solution_span);
    }

    toggle_tooltip() {
        this._tooltip.classList.toggle('show');
    }

    get_class_name(value: Boolean) {
        let class_name = 'pyrope';
        if (value === true) {
            class_name = 'pyrope valid';
        } else if (value === false) {
            class_name = 'pyrope invalid';
        }
        return class_name;
    }

    change_class_name(element: any) {
        const disabled = this.model.get('disabled');
        element.disabled = disabled;
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

            value: false,
        }
    }

    static model_name = 'CheckboxModel';
    static view_name = 'CheckboxView';
}


export class CheckboxView extends InputWidgetView {

    protected _checkbox: HTMLInputElement;

    render() {
        this._checkbox = document.createElement('input');
        this._checkbox.type = 'checkbox';
        this._checkbox.onclick = this.change_on_click.bind(this);

        this.el.append(this._checkbox);
        super.render();
    }

    change_disabled() {
        this.change_class_name(this._checkbox);
    }

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

            _index: null,

            labels: [],
        }
    }

    static model_name = 'DropdownModel';
    static view_name = 'DropdownView';
}


export class DropdownView extends InputWidgetView {

    protected _select: HTMLSelectElement;

    init_callbacks() {
        super.init_callbacks();
        this.model.on('change:_index', this.change_index, this);
        this.model.on('change:labels', this.change_labels, this);
    }

    render() {
        this._select = document.createElement('select');
        this._select.onchange = this.change_on_change.bind(this);
        this.el.append(this._select);

        this.change_labels();
        this.change_index();

        super.render();
    }

    change_disabled() {
        this.change_class_name(this._select);
    }

    change_index() {
        const i = this.model.get('_index');
        if (i !== null) {
            this._select.options[i + 1].selected = true;
        }
    }

    change_labels() {
        this._select.replaceChildren();
        const default_option = document.createElement('option');
        default_option.disabled = true;
        default_option.hidden = true;
        default_option.selected = true;
        this._select.append(default_option);
        const labels = this.model.get('labels');
        labels.forEach((element: string) => {
            const option = document.createElement('option');
            option.textContent = element;
            this._select.append(option);
        });
    }

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

            _index: null,

            labels: [],
            vertical: true,
        }
    }

    static model_name = 'RadioButtonsModel';
    static view_name = 'RadioButtonsView';
}


export class RadioButtonsView extends InputWidgetView {

    protected _container: HTMLDivElement;
    protected _radio_buttons: Array<HTMLInputElement>;

    init_callbacks() {
        super.init_callbacks();
        this.model.on('change:_index', this.change_index, this);
        this.model.on('change:labels', this.change_labels, this);
        this.model.on('change:vertical', this.change_labels, this);
    }

    render() {
        this.displayed.then(() => this._render());
    }

    _render() {
        this._container = document.createElement('div');
        this._container.classList.add('pyrope');
        this.el.append(this._container);

        this.change_index();
        this.change_labels();

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

    change_labels() {
        this._radio_buttons = new Array();
        this._container.replaceChildren();
        const vertical = this.model.get('vertical');
        if (vertical) {
            this.el.classList.add('pyrope-vertical-radio-buttons');
        } else {
            this.el.classList.remove('pyrope-vertical-radio-buttons');
        }
        const labels = this.model.get('labels');
        labels.forEach(async (element: string) => {
            const radio_button = document.createElement('input');
            radio_button.type = 'radio';
            radio_button.classList.add('pyrope');
            radio_button.name = this.cid;
            radio_button.addEventListener('change', () => {
                this.change_on_change(this, radio_button)
            });
            this._radio_buttons.push(radio_button);
            const label = document.createElement('label');
            label.classList.add('pyrope');
            this._container.append(radio_button, label);
            if (vertical) {
                this._container.append(document.createElement('br'));
            }
            const label_model = PyRopeWidgetView.renderMimeRegistry.createModel(
                {'data': {'text/markdown': element}}
            );
            await this.render_model(label_model, label);
        });
    }

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

            maximum: 100.0,
            minimum: 0.0,
            step: 1.0,
            value: 0.0,
            width: 25,
        }
    }

    static model_name = 'SliderModel';
    static view_name = 'SliderView';
}


export class SliderView extends InputWidgetView {

    protected _slider: HTMLInputElement;
    protected _slider_info: HTMLDivElement;

    init_callbacks() {
        super.init_callbacks();
        this.model.on('change:maximum', this.change_maximum, this);
        this.model.on('change:minimum', this.change_minimum, this);
        this.model.on('change:step', this.change_step, this);
        this.model.on('change:width', this.change_width, this);
    }

    render() {
        this._slider = document.createElement('input');
        this._slider.type = 'range';
        this._slider.addEventListener('mousedown', () => {
            this.update_slider_info();
            this._slider_info.classList.toggle('show');
        });
        this._slider.addEventListener('touchstart', () => {
            this.update_slider_info();
            this._slider_info.classList.toggle('show');
        });
        this._slider.addEventListener('input', () => {
            this.update_slider_info();
        });
        this._slider.addEventListener('mouseup', () => {
            this.change_on_interaction_end();
            this._slider_info.classList.toggle('show');
        });
        this._slider.addEventListener('touchend', () => {
            this.change_on_interaction_end();
            this._slider_info.classList.toggle('show');
        });

        this.change_maximum();
        this.change_minimum();
        this.change_step();
        this.change_width();

        const container = document.createElement('div');
        container.classList.add('pyrope', 'slider-container');
        this._slider_info = document.createElement('div');
        this._slider_info.classList.add('pyrope', 'slider-info');
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

            placeholder: '',
            value: '',
            width: 20,
        };
    }

    static model_name = 'TextModel';
    static view_name = 'TextView';
}


export class TextView extends InputWidgetView {

    protected _text: HTMLInputElement | HTMLTextAreaElement;

    init_callbacks() {
        super.init_callbacks();
        this.model.on('change:placeholder', this.change_placeholder, this);
        this.model.on('change:width', this.change_width, this);
    }

    create_input_element() {
        this._text = document.createElement('input');
        this._text.type = 'text';
    }

    render() {
        this.create_input_element();
        this._text.oninput = this.change_on_input.bind(this);

        this.change_placeholder();
        this.change_width();

        this.el.append(this._text)
        super.render();
    }

    change_disabled() {
        this.change_class_name(this._text);
    }

    change_on_input() {
        this.model.set('value', this._text.value);
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

    change_value() {
         this._text.value = this.model.get('value');
    }

    change_width() {
        this._text.style.width = `${this.model.get('width')}ch`;
    }
}


export class TextAreaModel extends TextModel {
    defaults() {
        return {
            ...super.defaults(),

            height: 4,
            width: 50,
        }
    }

    static model_name = 'TextAreaModel';
    static view_name = 'TextAreaView';
}


export class TextAreaView extends TextView {

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
