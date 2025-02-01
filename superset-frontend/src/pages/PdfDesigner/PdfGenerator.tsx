import React from "react";
import { generate } from "@pdfme/generator";
import { getTemplate } from "./helper";

const PdfGenerator = () => {
  const handleGeneratePdf = async () => {
    const template = getTemplate()

    const pdfBytes = await generate({ template, inputs: [{}] });
    
    // Create a Blob and trigger download
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "generated.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h3>PDF Generator</h3>
      <button onClick={handleGeneratePdf}>Generate PDF</button>
    </div>
  );
};

export default PdfGenerator;
