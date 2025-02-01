import React, { useEffect, useRef } from 'react';
import { Designer } from '@pdfme/ui';
import { getInputFromTemplate, type Template } from '@pdfme/common';
import { getTemplate, getTemplatePlugins } from './helper';
import { generate } from "@pdfme/generator";
import { text, image, barcodes } from "@pdfme/schemas";

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

    // Insert user input data into the PDF fields
    // const inputs = [formData];
    console.log(updatedTemplate);

    const plugins = getTemplatePlugins();
    const inputs = getInputFromTemplate(updatedTemplate);
    // Generate PDF
    const pdfBuffer = await generate({ template: updatedTemplate, inputs, plugins });

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

  return (
    <div id='container'>
      <button onClick={downloadPDF} className="bg-blue-500 text-white px-4 py-2 mt-4">Download PDF</button>
      <div id="container" ref={domContainerRef} style={{ width: '100%', height: '100vh', backgroundColor: 'lightgray' }}>
        {/* You can add other content or components as needed */}
      </div>
    </div>
  );
};

export default PdfMeDesignerComponent;
