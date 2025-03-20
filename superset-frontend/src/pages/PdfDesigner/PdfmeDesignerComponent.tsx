import React, { useEffect, useRef, useState, useCallback, Dispatch, SetStateAction, useMemo } from 'react';
import { Designer } from '@pdfme/ui';
import { getInputFromTemplate, type Template } from '@pdfme/common';
import {
  getTemplate,
  getTemplatePlugins,
  readFile,
  cloneDeep,
  getTemplateFromJsonFile,
  getBlankTemplate,
  downloadJsonFile,
} from './helper';
import { generate } from '@pdfme/generator';
import { text, image, barcodes } from '@pdfme/schemas';
import Button from '../../components/Button';
import ReactDOM from 'react-dom';
import { makeApi, getClientErrorObject, JsonObject } from '@superset-ui/core'; 
import './index.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  name: string;
  setName: Dispatch<SetStateAction<string>>;
  description: string;
  setDescription: Dispatch<SetStateAction<string>>;
}

const Modal = React.memo(({ isOpen, onClose, onSave, name, setName, description, setDescription }: ModalProps) => {
  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Save Template</h2>
        <div className="modal-field">
          <label>Name:</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="modal-input"
            placeholder="Enter template name"
          />
        </div>
        <div className="modal-field">
          <label>Description:</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="modal-input"
            placeholder="Enter template description"
          />
        </div>
        <div>
          <Button buttonStyle="secondary" onClick={onSave}>
            Save
          </Button>
          <Button
            buttonStyle="secondary"
            onClick={onClose}
            className="modal-cancel-button"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
});

const PdfMeDesignerComponent = () => {
  // Create a reference to store the Designer instance
  const domContainerRef = useRef<HTMLDivElement | null>(null);
  const designerRef = useRef<Designer | null>(null); 
  const basePdfInputRef = useRef<HTMLInputElement | null>(null);
  const templateInputRef = useRef<HTMLInputElement | null>(null);

  const template: Template = useMemo(() => getTemplate(), []); 

  console.log('Initial Template:', template);
  
  useEffect(() => {
    let isMounted = true; // Track if the component is mounted
    console.log('Template in useEffect:', template); 

    if (domContainerRef.current) {
      // Create and store the Designer instance in the ref
      designerRef.current = new Designer({
        domContainer: domContainerRef.current,
        template,
        plugins: getTemplatePlugins(),
      });

      // Optionally, you can call methods on the designer here, for example:
      // designerRef.current.someMethod();

    } else {
      console.error('Container not found!');
    }

    // Cleanup function if necessary
    return () => {
      console.log("Cleaning up Designer instance.");
      if (designerRef.current) {
        // Cleanup designer instance (e.g., destroy or reset)
        designerRef.current.destroy?.(); // Call a destroy method if available
        designerRef.current = null;
      }
      isMounted = false;
    };
  }, [template]); // Update Designer if template changes

  const downloadPDF = async () => {
    if (!designerRef || !designerRef.current) return;

    // Get the updated template from the Designer UI
    const updatedTemplate = designerRef.current.getTemplate();
    console.log('Updated Template:', updatedTemplate);

    // Insert user input data into the PDF fields
    // const inputs = [formData];
    console.log(updatedTemplate);

    const plugins = getTemplatePlugins();
    const inputs = getInputFromTemplate(updatedTemplate);
    // Generate PDF
    const pdfBuffer = await generate({
      template: updatedTemplate,
      inputs,
      plugins,
    });

    // Create a download link
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    window.open(URL.createObjectURL(blob));
  };

  const onChangeBasePDF = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      readFile(e.target.files[0], 'dataURL').then(async basePdf => {
        if (designerRef.current) {
          const newTemplate = cloneDeep(designerRef.current.getTemplate());
          newTemplate.basePdf = basePdf;
          designerRef.current.updateTemplate(newTemplate);
        }
      });
    }
  };

  const handleLoadTemplate = (
    e: React.ChangeEvent<HTMLInputElement>,
    currentRef: Designer | null,
  ) => {
    if (e.target && e.target.files && e.target.files[0]) {
      getTemplateFromJsonFile(e.target.files[0])
        .then(t => {
          if (!currentRef) return;
          currentRef.updateTemplate(t);
        })
        .catch(e => {
          alert(`Invalid template file. -${e}`);
        });
    }
  };

  const onResetTemplate = () => {
    localStorage.removeItem('template');
    if (designerRef.current) {
      designerRef.current.updateTemplate(getBlankTemplate());
    }
  };

  const onDownloadTemplate = () => {
    if (designerRef.current) {
      downloadJsonFile(designerRef.current.getTemplate(), 'template');
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = useCallback(async () => {
    if (!designerRef.current) {
      alert('Designer instance not available!');
      return;
    }

    const updatedTemplate = designerRef.current.getTemplate();
    console.log('Saving Template:', updatedTemplate);
    console.log('Schemas before saving:', updatedTemplate.schemas);

    const payload = {
      name: name || 'Custom Template',
      description: description || 'Template from Pdf Designer',
      data: updatedTemplate,
    };

    try {
      const rv = await makeApi<JsonObject, JsonObject>({
        method: 'POST',
        endpoint: 'api/v1/pdf_template/',
      })(payload);

      if (rv?.id) {
        alert('Template saved successfully! ID: ' + rv.id);
        console.log('Save Response:', rv);
        setIsModalOpen(false); 
      } else {
        throw new Error('Unexpected response format: No ID returned');
      }
    } catch (error) {
      const clientError = await getClientErrorObject(error);
      alert(
        'Failed to save template: ' +
          (clientError.message || clientError.error || 'Unknown error'),
      );
      console.error('Save Error:', clientError);
    }
  }, [name, description, designerRef]);

  const onSaveTemplate = () => {
    setIsModalOpen(true);
  };

  return (
    <div id="container" className="container">
      <div
        className={`button-container ${
          isModalOpen ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
      >
        <Button buttonStyle="secondary" onClick={downloadPDF}>
          Download PDF
        </Button>
        <Button buttonStyle="secondary" onClick={onDownloadTemplate}>
          Download Template
        </Button>
        <input
          type="file"
          accept="application/json"
          className="hidden"
          ref={templateInputRef}
          onChange={e => handleLoadTemplate(e, designerRef.current)}
        />
        <Button
          buttonStyle="secondary"
          onClick={() => templateInputRef.current?.click()}
        >
          Load Template
        </Button>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          ref={basePdfInputRef}
          onChange={onChangeBasePDF}
        />
        <Button
          buttonStyle="secondary"
          onClick={() => basePdfInputRef.current?.click()}
        >
          Change Base PDF
        </Button>
        <Button buttonStyle="secondary" onClick={onSaveTemplate}>
          Save
        </Button>
        <Button buttonStyle="secondary" onClick={onResetTemplate}>
          Reset
        </Button>
      </div>
      <div
        id="container"
        ref={domContainerRef}
        className={`designer-container ${
          isModalOpen ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
      >
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
      />
    </div>
  );
};

export default PdfMeDesignerComponent;
