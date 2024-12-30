
from pyrope_ipywidgets.formatters_pyrope import TemplateFormatter


class HTMLTemplateFormatter(TemplateFormatter):

    @classmethod
    def format(cls, template, **kwargs):
        template = super().format(template, **kwargs)
        translation = {
            r'\<': '&lt;',
            r'\>': '&gt;',
            '<<': '&lt;&lt;',
            '>>': '&gt;&gt;',
        }
        for to_replace, replaced_by in translation.items():
            template = template.replace(to_replace, replaced_by)
        return template

    @staticmethod
    def get_field(field_name, format_spec, kwargs):
        if format_spec is None:
            field_template = f'<<{field_name}>>'
        else:
            field_template = f'<<{field_name}:{format_spec}>>'
        if field_name in kwargs:
            format_spec_attr = ''
            if format_spec is not None:
                format_spec_attr = f' data-pyrope-format-spec="{format_spec}"'
            obj = (
                f'<span data-pyrope-field-name="{field_name}"'
                f'{format_spec_attr}></span>'
            )
        else:
            obj = field_template
        return obj

    @staticmethod
    def format_field(obj, format_spec):
        if format_spec not in (None, 'latex'):
            raise ValueError(f'Unknown format specifier "{format_spec}".')
        return obj
