// import { Suspense } from "react";

import PdfmeDesignerComponent from './PdfmeDesignerComponent';
import { PdfDesignerProvider } from "./PdfDesignerContext";

// Set the worker source for PDF.js
export default function App() {

  return (
    <PdfDesignerProvider>
      <PdfmeDesignerComponent />
    </PdfDesignerProvider>
  );
}
