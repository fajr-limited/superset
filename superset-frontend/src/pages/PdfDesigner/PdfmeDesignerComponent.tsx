import React, { useEffect, useRef } from 'react';
import { Designer } from '@pdfme/ui';
import { getInputFromTemplate, Schema, type Template } from '@pdfme/common';
import { getTemplate, getTemplatePlugins } from './helper';
import { generate } from "@pdfme/generator";

const PdfMeDesignerComponent = () => {
  // Create a reference to store the Designer instance
  const domContainerRef = useRef<HTMLDivElement | null>(null);
  const designerRef = useRef<Designer | null>(null);  // Reference for Designer instance

  const template: Template = getTemplate(); 
  
  const schemastr = JSON.parse(sessionStorage.getItem('pdf_designer_template') || "{}");
  
  if (!schemastr.key) {
    console.log("No table data found in session storage.");
  } else {
    const basePdf = template.basePdf as { width: number; height: number; padding: [number, number, number, number] };
    
    const baseSchemas = template.schemas[0];
    const lastElement = baseSchemas[baseSchemas.length - 1];
    const startingY = lastElement.position.y + lastElement.height + 10; 
    const pageWidth = basePdf.width - basePdf.padding[1] - basePdf.padding[3];

    const columnCount = schemastr.columns.length;
    const rowData = JSON.parse(schemastr.data);
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
        "y": startingY 
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

    const pageHeight = basePdf.height - basePdf.padding[0] - basePdf.padding[2];
    if (startingY + tableHeight > pageHeight) {
      console.warn("Table exceeds page height");
      schema.height = pageHeight - startingY - 5; 
    }

    template.schemas[0].push(schema);
  }

  console.log(template.schemas);

  useEffect(() => {
    let isMounted = true; // Track if the component is mounted
    // console.log('Template:', template); // Log the template to debug

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