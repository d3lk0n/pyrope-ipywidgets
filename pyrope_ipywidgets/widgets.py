
from IPython import get_ipython
from ipywidgets import Button, DOMWidget, Output, widget_serialization
from pyrope.messages import ChangeWidgetAttribute, Submit
from traitlets import (
    Any, Bool, default, Dict, Enum, Float, Instance, Int, List, observe, Tuple,
    TraitError, Unicode, validate
)

from ._frontend import module_name, module_version
from .formatter import HTMLTemplateFormatter


class DebugOutput(Output):

    def __init__(self):
        super().__init__()
        self.init_output()

    def clear_output(self, *pargs, **kwargs):
        super().clear_output(*pargs, **kwargs)
        self.init_output()

    def init_output(self):
        self.append_stdout('Debug Messages:\n')


class SubmitButton(Button):

    state = Enum(('initial', 'unfinished'), default_value='initial').tag(
        sync=False
    )

    def __init__(self, submit_callback, submit_anyway_callback):
        super().__init__(description='Submit')
        self.submit = submit_callback
        self.submit_anyway = submit_anyway_callback
        self.on_click(self.submit)

    @observe('state')
    def observe_state(self, change):
        state = change['new']
        if state == 'initial':
            self.description = 'Submit'
            self.on_click(self.submit_anyway, remove=True)
            self.on_click(self.submit)
        elif state == 'unfinished':
            self.description = 'Submit anyway?'
            self.on_click(self.submit, remove=True)
            self.on_click(self.submit_anyway)


class HintButton(Button):

    _index = Int(0).tag(sync=False)

    hints = List(default_value=[], trait=Unicode()).tag(sync=False)

    def __init__(self, **kwargs):
        super().__init__(description='No Hints', disabled=True, **kwargs)

    @observe('hints')
    def observe_hints(self, change):
        self._index = 0
        if len(change['new']) == 0:
            self.description = 'No Hints'
            self.disabled = True
        else:
            self.description = 'Next Hint'
            self.disabled = False

    def get_next_hint(self):
        hint = self.hints[self._index]
        self._index += 1
        if self._index >= len(self.hints):
            self.description = 'No Further Hints'
            self.disabled = True
        return hint


class PyRopeWidget(DOMWidget):

    _model_module = Unicode(module_name).tag(sync=True)
    _model_module_version = Unicode(module_version).tag(sync=True)
    _model_name = Unicode('PyRopeWidgetModel').tag(sync=True)
    _view_module = Unicode(module_name).tag(sync=True)
    _view_module_version = Unicode(module_version).tag(sync=True)
    _view_name = Unicode('PyRopeWidgetView').tag(sync=True)

    def __init__(self, notification_callback, **kwargs):
        super().__init__(**kwargs)
        self.notify = notification_callback

    @staticmethod
    def create_mime_bundle(obj):
        format = get_ipython().display_formatter.format
        bundle = format(obj)
        if isinstance(obj, str):
            # Otherwise strings are rendered with '' or "".
            bundle = {'text/plain': obj}, {}
        elif 'text/latex' in bundle[0].keys():
            # So that objects with 'latex' format specifier can
            # be rendered correctly inside a LaTeX environment.
            plain_repr = bundle[0]['text/latex'].strip(' $')
            bundle[0]['text/plain'] = plain_repr
        return bundle


class Exercise(PyRopeWidget):

    _model_name = Unicode('ExerciseModel').tag(sync=True)
    _view_name = Unicode('ExerciseView').tag(sync=True)

    _displayed_hints = List(default_value=[], trait=Unicode()).tag(sync=True)
    _feedback = Unicode('').tag(sync=True)
    _ofield_mime_bundles = Dict(
        default_value={}, key_trait=Unicode(),
        value_trait=Tuple(Dict(key_trait=Unicode()), Dict())
    ).tag(sync=True)
    _preamble = Unicode('').tag(sync=True)
    _problem = Unicode('').tag(sync=True)
    _total_score = Unicode('').tag(sync=True)

    clear_debug_btn = Instance(Button, read_only=True).tag(
        sync=True, **widget_serialization
    )
    debug = Bool(False).tag(sync=True)
    debug_output = Instance(DebugOutput, read_only=True).tag(
        sync=True, **widget_serialization
    )
    hint_btn = Instance(HintButton, read_only=True).tag(
        sync=True, **widget_serialization
    )
    hints = List(default_value=[], trait=Unicode()).tag(sync=False)
    max_total_score = Float(None, allow_none=True).tag(sync=False)
    ofields = Dict({}, key_trait=Unicode()).tag(sync=False)
    submit_btn = Instance(SubmitButton, read_only=True).tag(
        sync=True, **widget_serialization
    )
    total_score = Float(None, allow_none=True).tag(sync=False)
    warning = Unicode('').tag(sync=True)
    widgets = Dict(default_value={}, key_trait=Unicode()).tag(
        sync=True, **widget_serialization
    )

    @default('clear_debug_btn')
    def default_clear_debug_btn(self):
        btn = Button(description='Clear Debug')
        btn.on_click(lambda _: self.debug_output.clear_output())
        return btn

    @default('debug_output')
    def default_debug_output(self):
        return DebugOutput()

    @default('hint_btn')
    def default_hint_btn(self):
        btn = HintButton()

        def display_hint(btn):
            hint = HTMLTemplateFormatter.format(
                btn.get_next_hint(), **self.ofields
            )
            self._displayed_hints = self._displayed_hints + [hint]
        btn.on_click(display_hint)
        return btn

    @observe('hints')
    def observe_hints(self, change):
        self._displayed_hints = []
        self.hint_btn.hints = change['new']

    @observe('ofields')
    def observe_ofields(self, change):
        mime_bundles = {}
        for name, value in change['new'].items():
            mime_bundles[name] = self.create_mime_bundle(value)
        self._ofield_mime_bundles = mime_bundles

    @default('submit_btn')
    def default_submit_button(self):
        def submit(button):
            invalid_widgets = any([
                widget.valid is False for widget in self.widgets.values()
            ])
            empty_widgets = any([
                widget.is_empty for widget in self.widgets.values()
            ])
            if invalid_widgets or empty_widgets:
                button.state = 'unfinished'
                if invalid_widgets and empty_widgets:
                    self.warning = 'There are empty and invalid input fields.'
                elif invalid_widgets:
                    self.warning = 'There are invalid input fields.'
                else:
                    self.warning = 'There are empty input fields.'
            else:
                self.submit()
        btn = SubmitButton(submit, lambda _: self.submit())
        return btn

    @observe('widgets')
    def observe_widgets(self, change):
        def handler(_):
            self.submit_btn.state = 'initial'
            self.warning = ''
        for widget in change['new'].values():
            widget.observe(handler, 'value')

    @validate('widgets')
    def validate_widgets(self, proposal):
        widgets = proposal['value']
        for widget in widgets.values():
            if not isinstance(widget, InputWidget):
                raise TraitError(
                    'All widgets have to be an instance of InputWidget.'
                )
        return widgets

    def disable(self):
        self.clear_debug_btn.disabled = True
        self.hint_btn.disabled = True
        self.submit_btn.disabled = True
        for widget in self.widgets.values():
            widget.disabled = True

    def display_total_score(self):
        score, max_score = self.total_score, self.max_total_score
        score = str(score) if score is not None else '?'
        max_score = str(max_score) if max_score is not None else '?'
        if not score == max_score == '?':
            self._total_score = f'Total Score: {score}/{max_score}'

    def render_preamble(self, template):
        preamble = HTMLTemplateFormatter.format(template, **self.ofields)
        self._preamble = preamble

    def render_problem(self, template):
        problem = HTMLTemplateFormatter.format(
            template, **(self.ofields | self.widgets)
        )
        self._problem = problem

    def render_feedback(self, template):
        feedback = HTMLTemplateFormatter.format(template, **self.ofields)
        self._feedback = feedback

    def submit(self):
        self.notify(Submit(self.__class__))
        self.disable()
        for widget in self.widgets.values():
            widget.display_score()
        self.display_total_score()


class InputWidget(PyRopeWidget):

    _model_name = Unicode('InputWidgetModel').tag(sync=True)
    _view_name = Unicode('InputWidgetView').tag(sync=True)

    _score = Unicode('').tag(sync=True)
    _solution_mime_bundle = Tuple(()).tag(sync=True)

    correct = Bool(None, allow_none=True).tag(sync=True)
    description = Unicode('').tag(sync=False)
    disabled = Bool(False).tag(sync=True)
    displayed_max_score = Float(None, allow_none=True).tag(sync=False)
    displayed_score = Float(None, allow_none=True).tag(sync=False)
    info = Unicode('').tag(sync=False)
    show_max_score = Bool(False).tag(sync=False)
    show_score = Bool(False).tag(sync=False)
    solution = Any(None).tag(sync=False)
    title = Unicode('').tag(sync=True)
    valid = Bool(None, allow_none=True).tag(sync=True)
    value = Any(None).tag(sync=True)

    def __init__(self, id, notification_callback, **kwargs):
        self.id = id
        super().__init__(notification_callback, **kwargs)

    @property
    def is_empty(self):
        return self.value == self.__class__.value.default_value

    @observe('description')
    def observe_description(self, change):
        self.change_hover_text(change['new'])

    @observe('info')
    def observe_info(self, change):
        if self.description == '':
            self.change_hover_text(change['new'])

    @observe('solution')
    def observe_solution(self, change):
        solution = change['new']
        if solution is None:
            self._solution_mime_bundle = ()
        else:
            self._solution_mime_bundle = self.create_mime_bundle(solution)

    @observe('valid')
    def observe_valid(self, change):
        if change['new'] is not False:
            if self.description != '':
                self.change_hover_text(self.description)
            else:
                self.change_hover_text(self.info)

    @observe('value')
    def observe_value(self, change):
        self.notify(ChangeWidgetAttribute(
            self.__class__, self.id, 'value', change['new']
        ))

    def change_hover_text(self, value):
        self.title = value

    def display_score(self):
        score, max_score = self.displayed_score, self.displayed_max_score
        score = str(score) if score is not None else '?'
        max_score = str(max_score) if max_score is not None else '?'
        if not score == max_score == '?':
            self._score = f'Score: {score}/{max_score}'


class Checkbox(InputWidget):

    _model_name = Unicode('CheckboxModel').tag(sync=True)
    _view_name = Unicode('CheckboxView').tag(sync=True)

    value = Bool(False).tag(sync=True)

    @property
    def is_empty(self):
        return False


class Dropdown(InputWidget):

    _model_name = Unicode('DropdownModel').tag(sync=True)
    _view_name = Unicode('DropdownView').tag(sync=True)

    _index = Int(None, allow_none=True).tag(sync=True)

    labels = Tuple(()).tag(sync=True)
    options = Tuple(()).tag(sync=False)
    value = Any(None).tag(sync=False)

    @observe('_index')
    def observe_index(self, change):
        i = change['new']
        if i is None:
            self.value = None
        else:
            self.value = self.options[i]

    @observe('value')
    def observe_value(self, change):
        value = change['new']
        if value is None:
            self._index = None
        else:
            self._index = self.options.index(value)
        super().observe_value(change)


class RadioButtons(Dropdown):

    _model_name = Unicode('RadioButtonsModel').tag(sync=True)
    _view_name = Unicode('RadioButtonsView').tag(sync=True)

    vertical = Bool(True).tag(sync=True)


class Slider(InputWidget):

    _model_name = Unicode('SliderModel').tag(sync=True)
    _view_name = Unicode('SliderView').tag(sync=True)

    maximum = Float(100.0).tag(sync=True)
    minimum = Float(0.0).tag(sync=True)
    step = Float(1.0).tag(sync=True)
    value = Float(0.0).tag(sync=True)
    width = Int(25).tag(sync=True)

    @property
    def is_empty(self):
        return False

    @observe('minimum')
    def observe_minimum(self, change):
        self.value = change['new']


class Text(InputWidget):

    _model_name = Unicode('TextModel').tag(sync=True)
    _view_name = Unicode('TextView').tag(sync=True)

    placeholder = Unicode('').tag(sync=True)
    value = Unicode('').tag(sync=True)
    width = Int(20).tag(sync=True)


class TextArea(Text):

    _model_name = Unicode('TextAreaModel').tag(sync=True)
    _view_name = Unicode('TextAreaView').tag(sync=True)

    height = Int(4).tag(sync=True)
    width = Int(50).tag(sync=True)
