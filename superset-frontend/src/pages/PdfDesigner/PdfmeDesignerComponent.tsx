import React, { useEffect, useRef, useState, useCallback, Dispatch, SetStateAction, useMemo } from 'react';
import { Designer } from '@pdfme/ui';
import { getInputFromTemplate, type Template, Schema } from '@pdfme/common';
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
import { text, image, barcodes, table } from '@pdfme/schemas';
import Button from '../../components/Button';
import ReactDOM from 'react-dom';
import { makeApi, getClientErrorObject, JsonObject } from '@superset-ui/core';
import { useParams, useLocation } from 'react-router-dom';
import { PdfTemplateClient } from 'packages/superset-ui-core/src/pdf_template';
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
  const { id } = useParams<{ id: string }>();
  const domContainerRef = useRef<HTMLDivElement | null>(null);
  const designerRef = useRef<Designer | null>(null);
  const basePdfInputRef = useRef<HTMLInputElement | null>(null);
  const templateInputRef = useRef<HTMLInputElement | null>(null);

  const location = useLocation();
  const [template, setTemplate] = useState<Template>(getTemplate());
  const [chartSchema, setChartSchema] = useState<Schema | null>(null);
  console.log('Initial Template:', template);

  // Fetch schema data from sessionStorage
  useEffect(() => {
    console.log('useEffect for fetching chart schema triggered.');
    if (location.state?.sessionKey) {
      const sessionKey = location.state.sessionKey;
      const templateData = sessionStorage.getItem(sessionKey);
      if (templateData) {
        const schemastr = JSON.parse(templateData);
        if (!schemastr.key) {
          console.log("No table data found in session storage.");
        } else {
          console.log('Fetched Chart Schema from sessionStorage:', schemastr);
          const basePdf = getTemplate().basePdf as { width: number; height: number; padding: [number, number, number, number] };
          const pageWidth = basePdf.width - basePdf.padding[1] - basePdf.padding[3];

          const columnCount = schemastr.columns.length;
          let rowData;
          try {
            rowData = JSON.parse(schemastr.data);
            if (!Array.isArray(rowData) || rowData.length === 0 || !rowData.every(row => Array.isArray(row))) {
              console.error("Invalid table data format:", rowData);
              return;
            }
          } catch (error) {
            console.error("Error parsing table data:", error);
            return;
          }
          const rowCount = rowData.length;
          const tableWidth = pageWidth * 0.9;
          const rowHeight = 10;
          const headHeight = 15;
          const tableHeight = headHeight + (rowCount * rowHeight);

          const schema: Schema = {
            "name": schemastr.key,
            "type": schemastr.type,
            "content": schemastr.data,
            "showHead": true,
            "head": schemastr.columns,
            "headWidthPercentages": Array.from({ length: columnCount }, () => 100 / columnCount),
            "position": {
              "x": basePdf.padding[3] + 5,
              "y": 10 
            },
            "width": tableWidth,
            "height": tableHeight,
            "tableStyles": {
              "borderWidth": 0.3,
              "borderColor": "#000000"
            },
            "headStyles": {
              "fontName": "NotoSerifJP-Regular",
              "fontSize": 13,
              "characterSpacing": 0,
              "alignment": "left",
              "verticalAlignment": "middle",
              "lineHeight": 1,
              "fontColor": "#ffffff",
              "borderColor": "",
              "backgroundColor": "#2980ba",
              "borderWidth": {
                "top": 0,
                "right": 0,
                "bottom": 0,
                "left": 0
              },
              "padding": {
                "top": 5,
                "right": 5,
                "bottom": 5,
                "left": 5
              }
            },
            "bodyStyles": {
              "fontName": "NotoSerifJP-Regular",
              "fontSize": 13,
              "characterSpacing": 0,
              "alignment": "left",
              "verticalAlignment": "middle",
              "lineHeight": 1,
              "fontColor": "#000000",
              "borderColor": "#888888",
              "backgroundColor": "",
              "alternateBackgroundColor": "#f5f5f5",
              "borderWidth": {
                "top": 0.1,
                "right": 0.1,
                "bottom": 0.1,
                "left": 0.1
              },
              "padding": {
                "top": 5,
                "right": 5,
                "bottom": 5,
                "left": 5
              }
            },
            "columnStyles": {},
            "required": false,
            "readOnly": false
          };

          setChartSchema(schema);
        }
        sessionStorage.removeItem(sessionKey);
      }
    }
  }, [location.state]);

  useEffect(() => {
    console.log('useEffect for fetching template triggered. ID:', id);
    console.log('Current URL:', window.location.pathname);
    if (id) {
      console.log('Fetching template with ID:', id);
      const client = new PdfTemplateClient();
      const fetchData = async () => {
        try {
          const result = await client.fetchPdfTemplateData(id);
          console.log('Raw response from fetchPdfTemplateData:', result);

          // Handle multiple possible response formats
          const basePdf = result.result?.data?.basePdf ?? result.result?.basePdf ?? result.data?.basePdf ?? result.basePdf;
          const schemas = result.result?.data?.schemas ?? result.result?.schemas ?? result.data?.schemas ?? result.schemas;

          if (!basePdf || !schemas) {
            console.error('Invalid template data:', JSON.stringify(result, null, 2));
            throw new Error('Template data is missing basePdf or schemas');
          }

          const fetchedTemplate: Template = {
            basePdf,
            schemas,
          };
          console.log('Fetched Template:', fetchedTemplate);
          console.log('Fetched Schemas:', fetchedTemplate.schemas);
          console.log('Fetched Schemas[0]:', fetchedTemplate.schemas[0]);

          // Embed the chart schema if it exists
          if (chartSchema) {
            console.log('Embedding Chart Schema into Template:', chartSchema);
            const newTemplate = { ...fetchedTemplate };
            if (!newTemplate.schemas || !Array.isArray(newTemplate.schemas)) {
              newTemplate.schemas = [[]];
            }
            const baseSchemas = newTemplate.schemas[0] || [];
            const lastElement = baseSchemas.length > 0 ? baseSchemas[baseSchemas.length - 1] : null;
            const startingY = lastElement ? lastElement.position.y + lastElement.height + 10 : 10;

            chartSchema.position.y = startingY;

            const pageHeight = (newTemplate.basePdf as { height: number; padding: [number, number, number, number] }).height -
              (newTemplate.basePdf as { padding: [number, number, number, number] }).padding[0] -
              (newTemplate.basePdf as { padding: [number, number, number, number] }).padding[2];
            if (startingY + chartSchema.height > pageHeight) {
              console.warn("Table exceeds page height");
              chartSchema.height = pageHeight - startingY - 5;
            }

            newTemplate.schemas[0] = [...baseSchemas, chartSchema];
            console.log('Updated Template with Chart Data:', newTemplate);
            setTemplate(newTemplate);
          } else {
            setTemplate(fetchedTemplate);
          }
        } catch (err: any) {
          console.error('Error fetching template:', err.message);
          setTemplate(getTemplate());
        }
      };
      fetchData();
    } else {
      console.log('No template ID provided, skipping fetch.');
      if (chartSchema) {
        const newTemplate = getTemplate();
        newTemplate.schemas = [[chartSchema]];
        setTemplate(newTemplate);
      }
    }
  }, [id, chartSchema]);

  useEffect(() => {
    let isMounted = true;
    console.log('Template in useEffect:', template);

    if (domContainerRef.current) {
      designerRef.current = new Designer({
        domContainer: domContainerRef.current,
        template,
        plugins: getTemplatePlugins(),
      });
    } else {
      console.error('Container not found!');
    }

    return () => {
      console.log("Cleaning up Designer instance.");
      if (designerRef.current) {
        designerRef.current.destroy?.();
        designerRef.current = null;
      }
      isMounted = false;
    };
  }, [template]);

  const downloadPDF = async () => {
    if (!designerRef || !designerRef.current) return;
    // Get the updated template from the Designer UI
    const updatedTemplate = designerRef.current.getTemplate();
    console.log('Updated Template:', updatedTemplate);

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

    console.log('Payload being sent to backend:', JSON.stringify(payload, null, 2));

    try {
      const rv = await makeApi<JsonObject, JsonObject>({
        method: 'POST',
        endpoint: 'api/v1/pdf_template/',
      })(payload);

      console.log('Save Response:', JSON.stringify(rv, null, 2));

      if (rv?.id) {
        alert('Template saved successfully! ID: ' + rv.id);
        const client = new PdfTemplateClient();
        const savedTemplate = await client.fetchPdfTemplateData(rv.id.toString());
        console.log('Fetched saved template:', JSON.stringify(savedTemplate, null, 2));
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
