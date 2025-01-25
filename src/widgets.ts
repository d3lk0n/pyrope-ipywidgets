
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


export class PyRopeWidgetModel extends DOMWidgetModel {
    defaults() {
        return {
            ...super.defaults(),

            _model_module: PyRopeWidgetModel.model_module,
            _model_module_version: PyRopeWidgetModel.model_module_version,
            _view_module: PyRopeWidgetModel.view_module,
            _view_module_version: PyRopeWidgetModel.view_module_version,
        }
    }

    static model_module = MODULE_NAME;
    static model_module_version = MODULE_VERSION;
    static view_module = MODULE_NAME;
    static view_module_version = MODULE_VERSION;
}


export class PyRopeWidgetView extends DOMWidgetView {

    static renderMimeRegistry: IRenderMimeRegistry;

    constructor(...args: any[]) {
        super(...args);
        this.init_callbacks();
    }

    init_callbacks() {}

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


export class ExerciseModel extends PyRopeWidgetModel {
    defaults() {
        return {
            ...super.defaults(),

            _model_name: ExerciseModel.model_name,
            _view_name: ExerciseModel.view_name,

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


export class ExerciseView extends PyRopeWidgetView {

    protected _button_area: HTMLDivElement;
    protected _debug_area: HTMLDivElement;
    protected _debug_area_separator: HTMLHRElement;
    protected _feedback: HTMLDivElement;
    protected _feedback_separator: HTMLHRElement;
    protected _hints: HTMLDivElement;
    protected _ofield_models: Map<string, IRenderMime.IMimeModel>;
    protected _preamble: HTMLDivElement;
    protected _preamble_separator: HTMLHRElement;
    protected _problem: HTMLDivElement;
    protected _total_score_container: HTMLDivElement;
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

    render() {
        this.displayed.then(() => this._render());
    }

    async _render() {
        this._preamble = document.createElement('div');
        this._preamble.classList.add('pyrope', 'preamble');
        this._preamble_separator = this.new_separator();
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
        this._total_score_container = this.create_alert_box('info');
        this._feedback_separator = this.new_separator();
        this._feedback_separator.classList.add('hide');
        this._debug_area = document.createElement('div');
        this._debug_area.classList.add('pyrope', 'debug');
        this._debug_area_separator = this.new_separator();
        this._debug_area_separator.classList.add('hide');

        this.el.append(
            this.new_separator(), this._preamble, this._preamble_separator,
            this._problem, this._button_area, this._warning, this._hints,
            this.new_separator(), this._feedback, this._total_score_container,
            this._feedback_separator, this._debug_area,
            this._debug_area_separator
        );

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
        this.render_debug_output();
    }

    change_debug() {
        this.populate_button_area();
        this.render_debug_output();
    }

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

    new_separator() {
        let separator = document.createElement('hr');
        separator.classList.add('pyrope');
        return separator;
    }

    render_preamble() {
        const preamble_template = this.model.get('_preamble');
        this.render_ofields(preamble_template, this._preamble);
        if (preamble_template === '') {
            this._preamble_separator.classList.add('hide');
        } else {
            this._preamble_separator.classList.remove('hide');
        }
    }

    async populate_button_area() {
        this._button_area.replaceChildren();
        const submit_btn_view = await this.create_widget_view(
            this.model.get('submit_btn')
        );
        const hint_btn_view = await this.create_widget_view(
            this.model.get('hint_btn')
        );
        this._button_area.append(submit_btn_view.el, hint_btn_view.el);
        if (this.model.get('debug')) {
            const clear_debug_btn_view = await this.create_widget_view(
                this.model.get('clear_debug_btn')
            );
            this._button_area.append(clear_debug_btn_view.el);
        }
    }

    render_models(
        models: Map<String, IRenderMime.IMimeModel | DOMWidgetModel>,
        render: (model: any, host: HTMLElement) => void, domain: HTMLElement
    ) {
        for(let [field_name, model] of models) {
            const elements = domain.querySelectorAll<HTMLElement>(
                `[data-pyrope-field-name="${field_name}"]`
            );
            for (let i = 0; i < elements.length; i++) {
                render(model, elements[i]);
            }
        }
    }

    async create_widget_view(model: DOMWidgetModel) {
        const view = await model.widget_manager.create_view(model);
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
            if(format_spec === 'latex') {
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

    async render_problem() {
        const problem_template = this.model.get('_problem');
        await this.render_ofields(problem_template, this._problem);
        const widgets = this.model.get('widgets');
        let widgets_map = new Map();
        for(let widget_id in widgets) {
            widgets_map.set(widget_id, widgets[widget_id]);
        }
        this.render_models(widgets_map, async (widget_model, widget_host) => {
            widget_host.classList.add('pyrope', 'field', 'ifield');
            const view = await this.create_widget_view(widget_model);
            widget_host.appendChild(view.el);
        }, this._problem);
    }

    render_alert_box(host: HTMLDivElement, text: string) {
        if (host.lastChild !== null) {
            host.lastChild.textContent = text;
        }
        if (text === '') {
            host.classList.remove('show');
        } else {
            host.classList.add('show');
        }
    }

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

    render_feedback() {
        const feedback_template = this.model.get('_feedback');
        this.render_ofields(feedback_template, this._feedback);
        if (feedback_template === '') {
            this._feedback_separator.classList.add('hide');
        } else {
            this._feedback_separator.classList.remove('hide');
        }
    }

    async render_debug_output() {
        this._debug_area.replaceChildren();
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

            _model_name: InputWidgetModel.model_name,
            _view_name: InputWidgetModel.view_name,

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
        this.model.on('change:_score', this.insert_score, this);
        this.model.on(
            'change:_solution_mime_bundle', this.insert_solution, this
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
        this._result_separator.classList.add('pyrope', 'tooltip');
        this._solution_span = document.createElement('span');
        this._tooltip.append(
            this._solution_span, this._result_separator, this._score_span
        );
        this._result_btn.append(question_icon, this._tooltip);
        tooltip_container.appendChild(this._result_btn);
        this.insert_score();
        this.displayed.then(() => this.insert_solution());
    }

    change_disabled() {}

    change_title() {}

    change_valid() {}

    change_value() {}

    insert_score() {
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
            this._result_separator.style.display = 'block';
        } else {
            this._result_separator.style.display = 'none';
        }
        this._score_span.textContent = score;
    }

    insert_solution() {
        this._solution_span.replaceChildren();
        const solution = this.model.get('_solution_mime_bundle');
        if (solution.length === 0 && this.model.get('_score') === '') {
            this._result_btn.disabled = true;
        } else {
            this._result_btn.disabled = false;
        }
        if (solution.length !== 0 && this.model.get('_score') !== '') {
            this._result_separator.style.display = 'block';
        } else {
            this._result_separator.style.display = 'none';
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

            _model_name: CheckboxModel.model_name,
            _view_name: CheckboxModel.view_name,

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


export class RadioButtonsModel extends InputWidgetModel {
    defaults() {
        return {
            ...super.defaults(),

            _model_name: RadioButtonsModel.model_name,
            _view_name: RadioButtonsModel.view_name,

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

            _model_name: SliderModel.model_name,
            _view_name: SliderModel.view_name,

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

            _model_name: TextModel.model_name,
            _view_name: TextModel.view_name,

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

            _model_name: TextAreaModel.model_name,
            _view_name: TextAreaModel.view_name,

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


//if necessary
//TODO create general Graphical Model/View
//TODO create general File (Background) Model/View  


export class GraphicalHotspotModel extends InputWidgetModel {
    defaults() {
        return {
            ...super.defaults(),
            //TODO NEXT see Slider how value is saved (thats used in solution)
            //same here, change value on toggles

            _model_name: GraphicalHotspotModel.model_name,
            _view_name: GraphicalHotspotModel.view_name,

            //TODO default white bg
            background_src: '',
            
            //TODO default icon
            //TODO resize icon with bg?
            icon_src: '',
            
            all_coords: [] as string[],

            value: [] as string[]
        }
    }

    static model_name = 'GraphicalHotspotModel';
    static view_name = 'GraphicalHotspotView';
}

export class GraphicalHotspotView extends InputWidgetView {

    //TODO dollar sign?
    protected container: HTMLDivElement;
    protected background: HTMLImageElement;
    
    init_callbacks() {
        super.init_callbacks();
        this.model.on('change:background_src', this.change_background_src, this);
        this.model.on('change:icon_src', this.change_icon_src, this);
    }
    render() {

        //TODO response type should be basyType of identifier
        this.container = document.createElement('div');
        
        //TODO move to .css
        this.container.style.display = 'inline-block';
        this.container.style.position = 'relative';
        this.container.style.height = `${this.model.get('background_src').height}px`;
        this.container.style.width = `${this.model.get('background_src').width}px`;
        
        this.container.classList.add('pyrope');
        
        this.change_background_src();
        this.change_icon_src();
        
        //alternative for determining url
        /*this.model.widget_manager.resolveUrl(this.model.get('background_src')).then(resolvedUrl => {
            console.log('Typescript BG URL: \n')
            console.log(resolvedUrl)
            //this.background.src = resolvedUrl;
        });*/

        this.el.append(this.container);

        super.render();
    }

    change_background_src() {
        this.background = document.createElement('img');
        this.background.src = this.model.get('background_src').src;
        this.background.style.height = `100%`;
        this.background.style.width = `100%`;
        
        this.background.style.display = 'inline'
        this.background.style.border='1px solid black';
        this.background.style.position='absolute';
        this.background.style.zIndex='1';
        this.background.classList.add('pyrope');        

        this.container.append(this.background);
    }

    change_icon_src() {
        const all_coords: Array<string> = this.model.get('all_coords');
        console.log('All Icons: ' + all_coords);

        all_coords.forEach(coords => {
            this.create_icon_element(coords);
        });
    }

    create_icon_element(coords:string) {
        const icon = document.createElement('img');
        icon.src = this.model.get('icon_src').src;
        
        icon.style.height = `${this.model.get('icon_src').height}px`;
        icon.style.width =  `${this.model.get('icon_src').width}px`;

        //TODO extra modification for reshaping icons (e.g. circles)
        icon.style.zIndex='2';
        icon.style.display = 'inline';
        icon.style.position='absolute';
        
        //TODO use given coords as center
        //TODO would require not being able to place image near edges (test case in python) 
        const [x ,y] = coords.split(',');
        console.log('Creating Icon for coords: ' + x + ' ' + y);
        icon.style.left = `${x}px`;
        icon.style.top = `${y}px`;
        icon.style.opacity = '40%';

        //TODO if needed
        //coord_element.style.borderRadius = '50%'
        icon.classList.add('pyrope');

        icon.onclick = this.change_on_clicked.bind(this, icon);

        this.container.append(icon);
    }

    change_on_clicked(icon : HTMLImageElement) {

        //TODO use identifier (in dict instead?)
        const x = icon.style.left.replace('px', '')
        const y = icon.style.top.replace('px', '')

        const coords = `${x},${y}`
        const current_coords = this.model.get('value') as string[]
        const index = current_coords.indexOf(coords)
        if (index >= 0) {
            //icon was already clicked, remove from tracked list and reset opacity 
            icon.style.opacity = '40%';
            //TODO only for debugging for now
            console.log(`Before: ${this.model.get('value')}`);
            console.log(`${coords} will be removed from tracked`);
            current_coords.splice(index, 1);
            this.model.set('value', current_coords);
            this.model.save_changes();
            console.log(`After: ${this.model.get('value')}`);
        } else {
            //icon not tracked yet, add to tracked list and set full opacity 
            icon.style.opacity = '100%';
            console.log(`Before: ${this.model.get('value')}`);
            console.log(`${coords} will be added to tracked`);
            current_coords.push(coords);
            this.model.set('value', current_coords);
            this.model.save_changes();
            console.log(`After: ${this.model.get('value')}`);
        }
       
    }

    //TODO test
    change_valid() {
        this.change_class_name(this.background);
    }
    
    //TODO validate method?

    

}

export class GraphicalSelectPointModel extends InputWidgetModel {
    defaults() {
        return {
            ...super.defaults(),
            //TODO NEXT see Slider how value is saved (thats used in solution)
            //same here, change value on toggles

            _model_name: GraphicalSelectPointModel.model_name,
            _view_name: GraphicalSelectPointModel.view_name,

            //TODO default white bg
            background_src: '',
            
            //TODO default icon
            //TODO resize icon with bg?
            icon_src: '',
            
            value: [] as string[]
        }
    }

    static model_name = 'GraphicalSelectPointModel';
    static view_name = 'GraphicalSelectPointView';
}

export class GraphicalSelectPointView extends InputWidgetView {

    //TODO dollar sign?
    protected container: HTMLDivElement;
    protected background: HTMLImageElement;
    protected reset_button: HTMLButtonElement;
    protected reset_container: HTMLDivElement;
    
    init_callbacks() {
        super.init_callbacks();
        this.model.on('change:background_src', this.change_background_src, this);
    }

    //TODO optionally render areas (for debugging/testing)
    render() {
        this.container = document.createElement('div');
        
        //TODO move to .css
        this.container.style.display = 'block';
        this.container.style.position = 'relative';
        this.container.style.border='1px solid black';
        this.container.style.height = `${this.model.get('background_src').height}px`;
        this.container.style.width = `${this.model.get('background_src').width}px`;
        
        this.reset_container = document.createElement('div');
        this.reset_container.style.display = 'inline-flex';
        this.reset_container.style.position = 'relative';
        this.reset_container.style.height = `30px`;
        this.reset_container.style.width = `${this.model.get('background_src').width}px`;
        this.reset_container.style.left = this.container.style.left;
        this.reset_container.style.top = this.container.style.bottom;
        this.reset_container.style.alignItems = 'center';
        this.reset_container.style.justifyContent = 'center';
        
        this.reset_button = document.createElement('button');
        this.reset_button.classList.add('pyrope', 'ifield');
        this.reset_button.onclick = this.reset_value.bind(this);
        this.reset_button.style.border='1px solid black';
        this.reset_button.style.textAlign = 'center';
        this.reset_button.style.height = '25px';
        this.reset_button.textContent = 'Reset';
        
        this.reset_container.append(this.reset_button);
        
        this.change_background_src();
        this.container.onclick = this.create_icon_element.bind(this);

        this.el.append(this.container, this.reset_container);

        super.render();
    }

    change_background_src() {
        this.background = document.createElement('img');
        this.background.src = this.model.get('background_src').src;
        this.background.style.height = `100%`;
        this.background.style.width = `100%`;
        
        //this.background.style.display = 'inline';
        this.background.style.border='1px solid black';
        this.background.style.position='absolute';
        this.background.style.zIndex='1';
        
        this.container.append(this.background)
    }

    create_icon_element(event:MouseEvent) {

        //TODO only render part inside of container
        const icon = document.createElement('img');
        icon.src = this.model.get('icon_src').src;
        icon.style.height = `${this.model.get('icon_src').height}px`;
        icon.style.width =  `${this.model.get('icon_src').width}px`;

        //TODO extra modification for reshaping icons (e.g. circles)
        icon.style.zIndex='2';
        icon.style.display = 'inline';
        icon.style.position='absolute';
        
        //bounding rectangle of container == image for calculating offset to 
        const rect = this.container.getBoundingClientRect();
        const x = Number((event.clientX - rect.left).toFixed(0));
        const y = Number((event.clientY - rect.top).toFixed(0));
        
        //using upper left corner of icon to indicate where clicked
        icon.style.left = `${x}px`;
        icon.style.top = `${y}px`;

        //TODO better classname
        icon.classList.add('pyrope', 'removable');
        
        this.container.append(icon);
        
        const selected_point = `${x},${y}`;
        this.update_value(selected_point);

    }

    update_value(selected_point:string) {
        const current_coords = this.model.get('value') as string[];
        const index = current_coords.indexOf(selected_point);
        if (index >= 0) { 
            console.log(`Selected point was already added to value: ${selected_point}`);
        } else {
            current_coords.push(selected_point);
            console.log("Updated value " + `${current_coords}`);
            this.model.set('value', current_coords);
            this.model.save_changes();
        }
    }

    reset_value() {
        console.log("Resetting value");
        this.model.set('value', []);
        this.model.save_changes();

        const icons = this.container.getElementsByClassName('removable');
        while(icons[0]) {
            this.container.removeChild(icons[0]);
        }
    }
    

}

//TODO lock all graphical interactions on submit
//-> remove all on clicks
//-> gray out all buttons
export class GraphicalOrderModel extends InputWidgetModel {
    defaults() {
        return {
            ...super.defaults(),
            
            _model_name: GraphicalHotspotModel.model_name,
            _view_name: GraphicalHotspotModel.view_name,

            //TODO default white bg
            background_src: '',
            
            //TODO NEXT default icon (circle with num) -> svg in media
            //TODO optionally render num next to/below icon?
            icon_src: '',

            //coords by x,y
            all_coords: [] as string[],

            value: [] as string[]
        }
    }

    static model_name = 'GraphicalOrderModel';
    static view_name = 'GraphicalOrderView';
}

export class GraphicalOrderView extends InputWidgetView {

    protected container: HTMLDivElement;
    protected background: HTMLImageElement;
    
    init_callbacks() {
        super.init_callbacks();
        this.model.on('change:background_src', this.change_background_src, this);
        this.model.on('change:icon_src', this.change_icon_src, this);
    }

    render() {
        //TODO response type should be basyType of identifier
        this.container = document.createElement('div');
        
        //TODO move to .css
        this.container.style.display = 'inline-block';
        this.container.style.position = 'relative';
        this.container.style.height = `${this.model.get('background_src').height}px`;
        this.container.style.width = `${this.model.get('background_src').width}px`;
        
        this.container.classList.add('pyrope');
        
        this.change_background_src();
        this.change_icon_src();
        
        this.el.append(this.container);

        super.render();
    }

    change_background_src() {
        this.background = document.createElement('img');
        this.background.src = this.model.get('background_src').src;
        this.background.style.height = `100%`;
        this.background.style.width = `100%`;
        
        this.background.style.display = 'inline'
        this.background.style.border='1px solid black';
        this.background.style.position='absolute';
        this.background.style.zIndex='1';
        this.background.classList.add('pyrope');        

        this.container.append(this.background);
    }

    change_icon_src() {
        const all_coords: Array<string> = this.model.get('all_coords');
        console.log('All Icons: ' + all_coords);

        all_coords.forEach(coords => {
            this.create_icon_element(coords);
        });
    }

    create_icon_element(coords:string) {
        const icon = document.createElement('div');
        icon.style.height = `${this.model.get('icon_src').height}px`;
        icon.style.width =  `${this.model.get('icon_src').width}px`;

        //TODO extra modification for reshaping icons (e.g. circles)
        icon.style.zIndex='4';
        icon.style.display = 'inline-flex';
        icon.style.position = 'absolute';
        icon.style.alignItems = 'center';
        icon.style.justifyContent = 'center';
        
        const [x ,y] = coords.split(',');
        icon.style.left = `${x}px`;
        icon.style.top = `${y}px`;

        let icon_img = document.createElement('img');
        icon_img.src = this.model.get('icon_src').src;
        icon_img.style.height = `100%`;
        icon_img.style.width = `100%`;
        icon_img.style.display = 'inline';
        icon_img.style.position='absolute';
        icon_img.style.zIndex='2';

        let icon_span = document.createElement('span');
        icon_span.textContent = '';
        icon_span.style.zIndex = '3';
        icon_span.style.position = 'absolute';
        icon_span.style.display = 'inline';
        //TODO at least ~10
        icon_span.style.fontSize = `${this.model.get('icon_src').height as number /2}px`;
        icon_span.classList.add('filterable')
    
        icon.append(icon_img, icon_span);
        
        icon.classList.add('pyrope');

        icon.onclick = this.change_on_clicked.bind(this, icon);

        this.container.append(icon);
    }

    change_on_clicked(icon : HTMLDivElement) {

        const x = icon.style.left.replace('px', '')
        const y = icon.style.top.replace('px', '')

        const coords = `${x},${y}`
        const current_coords = this.model.get('value') as string[]
        const index = current_coords.indexOf(coords)
        if (index >= 0) {
            //icon was already clicked, remove from tracked list 
            //TODO only for debugging for now
            console.log(`Before: ${this.model.get('value')}`);
            console.log(`${coords} will be removed from tracked`);
            current_coords.splice(index, 1);
            this.model.set('value', current_coords);
            this.model.save_changes();
            console.log(`After: ${this.model.get('value')}`);
        } else {
            //icon not tracked yet, add to tracked list 
            console.log(`Before: ${this.model.get('value')}`);
            console.log(`${coords} will be added to tracked`);
            current_coords.push(coords);
            this.model.set('value', current_coords);
            this.model.save_changes();
            console.log(`After: ${this.model.get('value')}`);
        }

        //reset indeces according to order in tracked values
        this.update_all_indeces();
    }

    update_all_indeces() {
        const icons = this.container.getElementsByClassName('filterable');
        for (let i = 0; i < icons.length; i++) {
            let icon = icons[i] as HTMLSpanElement;
            const x = icon.parentElement!.style.left.replace('px', '')
            const y = icon.parentElement!.style.top.replace('px', '')
            console.log(`Updating Index for ${x},${y}`)

            const coords = `${x},${y}`
            const current_coords = this.model.get('value') as string[]

            const index = current_coords.indexOf(coords)
            if (index >= 0) {
                console.log(`setting index ${index+1}`)
                icon.textContent = `${index+1}`
            } else {
                console.log(`setting empty`)
                icon.textContent = ''
            }
        }
    }
}
