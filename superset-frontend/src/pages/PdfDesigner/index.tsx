// import { Suspense } from "react";

import PdfmeDesignerComponent from './PdfmeDesignerComponent';

// Set the worker source for PDF.js
export default function App() {

  return <PdfmeDesignerComponent/>;
  // <div>
  //   <h1>Main React App</h1>
  //   <Suspense fallback={<div>Loading Microfrontend...</div>}>
  //     <PdfmeDesignerComponent />
  //   </Suspense>
  // </div>);
}
