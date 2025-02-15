import React from 'react';
import ReactDOM from 'react-dom';
import { PreviewProps } from '@pdfme/common';
import { PreviewUI } from '@pdfme/ui/src/class';
import { DESTROYED_ERR_MSG } from '@pdfme/ui/src/constants';
import Preview from '@pdfme/ui/src/components/Preview';
import AppContextProvider from '@pdfme/ui/src/components/AppContextProvider';

class Viewer extends PreviewUI {
  constructor(props: PreviewProps) {
    super(props);
  }

  protected render() {
    if (!this.domContainer) throw Error(DESTROYED_ERR_MSG);
    ReactDOM.render(
      <AppContextProvider
        lang={this.getLang()}
        font={this.getFont()}
        plugins={this.getPluginsRegistry()}
        options={this.getOptions()}
      >
        <Preview template={this.template} size={this.size} inputs={this.inputs} />
      </AppContextProvider>,
      this.domContainer
    );
  }
}

export default Viewer;
