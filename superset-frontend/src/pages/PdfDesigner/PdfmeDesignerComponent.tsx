import React, { useEffect, useRef } from 'react';
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

const PdfMeDesignerComponent = () => {
  // Create a reference to store the Designer instance
  const domContainerRef = useRef<HTMLDivElement | null>(null);
  const designerRef = useRef<Designer | null>(null);  // Reference for Designer instance

  const template: Template = getTemplate(); // Get template outside of useEffect

  console.log(template);
  
  useEffect(() => {
    let isMounted = true; // Track if the component is mounted
    console.log('Template:', template); // Log the template to debug

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
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    window.open(URL.createObjectURL(blob));
    // const link = document.createElement("a");
    // link.href = URL.createObjectURL(blob);

    // link.download = "customized.pdf";
    // document.body.appendChild(link);
    // link.click();
    // document.body.removeChild(link);
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

  return (
    <div id="container">
      <div
        className="flex items-center justify-start w-full mb-4"
        style={{ margin: 0, padding: 0 }}
      >
        <button
          onClick={downloadPDF}
          className="px-4 py-2 rounded flex-none mr-12"
          style={{
            backgroundColor: '#E5F0FF',
            color: '#0052CC',
            border: '1px solid #E5F0FF',
            borderRadius: '4px', 
            transition: 'all 0.3s', 
            boxShadow: 'none', 
            marginRight: '114px',
          }}
        >
          Download PDF
        </button>
        <button
          className="px-2 py-1 rounded flex-none mr-4"
          style={{
            backgroundColor: '#E5F0FF',
            color: '#0052CC',
            border: '1px solid #E5F0FF',
            borderRadius: '4px', 
            transition: 'all 0.3s', 
            boxShadow: 'none', 
            marginRight: '114px',
          }}
          onClick={onResetTemplate}
        >
          Reset
        </button>
        <button
          className="px-2 py-1 rounded flex-none mr-4"
          style={{
            backgroundColor: '#E5F0FF',
            color: '#0052CC',
            border: '1px solid #E5F0FF',
            borderRadius: '4px', 
            transition: 'all 0.3s', 
            boxShadow: 'none', 
            marginRight: '114px',
          }}
          onClick={onDownloadTemplate}
        >
          DL Template
        </button>
        <button
          className="px-2 py-1 rounded flex-none mr-4"
          style={{
            backgroundColor: '#E5F0FF',
            color: '#0052CC',
            border: '1px solid #E5F0FF',
            borderRadius: '4px', 
            transition: 'all 0.3s', 
            boxShadow: 'none', 
            marginRight: '114px',
          }}
          onClick={() => {}}
        >
          Save
        </button>
        <label
          className="text-sm font-medium flex-none mr-4"
          style={{ color: '#0052CC', marginRight: '16px' }}
        >
          Change BasePDF
          <input
            type="file"
            accept="application/pdf"
            className="text-sm border rounded ml-2"
            style={{
              backgroundColor: '#E5F0FF',
              color: '#0052CC',
              border: '1px solid #E5F0FF',
              borderRadius: '4px', 
              padding: '2px 8px',
              outline: 'none',
              fontSize: '14px',
            }}
            onChange={onChangeBasePDF}
          />
        </label>
        <label
          className="text-sm font-medium flex-none"
          style={{ color: '#0052CC' }}
        >
          Load Template
          <input
            type="file"
            accept="application/json"
            className="text-sm border rounded ml-2"
            style={{
              backgroundColor: '#E5F0FF',
              color: '#0052CC',
              border: '1px solid #E5F0FF',
              borderRadius: '4px', 
              padding: '2px 8px',
              outline: 'none',
              fontSize: '14px',
            }}
            onChange={e => handleLoadTemplate(e, designerRef.current)}
          />
        </label>
      </div>
      <div
        id="container"
        ref={domContainerRef}
        style={{
          width: '100%',
          height: 'calc(100vh - 60px)',
          backgroundColor: 'lightgray',
        }}
      >
        {/* You can add other content or components as needed */}
      </div>
    </div>
  );
};

export default PdfMeDesignerComponent;