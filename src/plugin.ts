
import { IJupyterWidgetRegistry } from '@jupyter-widgets/base';
import { IRenderMimeRegistry } from '@jupyterlab/rendermime';
import { Application, IPlugin } from '@lumino/application';
import { Widget } from '@lumino/widgets';

import { PyRopeSanitizer } from './utils';
import { MODULE_NAME, MODULE_VERSION } from './version';
import * as widgetExports from './widgets';


const EXTENSION_ID = 'pyrope-ipywidgets:plugin';


const examplePlugin: IPlugin<Application<Widget>, void> = {
    id: EXTENSION_ID,
    requires: [IJupyterWidgetRegistry, IRenderMimeRegistry],
    activate: activateWidgetExtension,
    autoStart: true,
} as unknown as IPlugin<Application<Widget>, void>;
// the "as unknown as ..." typecast above is solely to support JupyterLab 1
// and 2 in the same codebase and should be removed when we migrate to Lumino.


export default examplePlugin;


function activateWidgetExtension(
    app: Application<Widget>,
    registry: IJupyterWidgetRegistry,
    renderMimeRegistry: IRenderMimeRegistry,
): void {
    registry.registerWidget({
        name: MODULE_NAME,
        version: MODULE_VERSION,
        exports: widgetExports,
    });
    const pyrope_rendermime = renderMimeRegistry.clone({
        sanitizer: new PyRopeSanitizer(),
    });
    widgetExports.PyRopeWidgetView.renderMimeRegistry = pyrope_rendermime;
}
