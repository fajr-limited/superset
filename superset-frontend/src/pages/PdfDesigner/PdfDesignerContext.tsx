import React, { createContext, useContext, useRef, useState, useEffect } from "react";
import { Designer } from "@pdfme/ui";
import { useLocation } from 'react-router-dom';
import PdfmeDesignerComponent from './PdfmeDesignerComponent'; 

type PdfDesignerContextType = {
  designerRef: React.MutableRefObject<Designer | null>;
  template: any;
  setTemplate: React.Dispatch<React.SetStateAction<any>>;
};

const PdfDesignerContext = createContext<PdfDesignerContextType | null>(null);

export const PdfDesignerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const designerRef = useRef<Designer | null>(null);
  const [template, setTemplate] = useState<any>(null);

  return (
    <PdfDesignerContext.Provider value={{ designerRef, template, setTemplate }}>
      {children}
    </PdfDesignerContext.Provider>
  );
};

export const usePdfDesigner = () => {
  const context = useContext(PdfDesignerContext);
  if (!context) {
    throw new Error("usePdfDesigner must be used within a PdfDesignerProvider");
  }
  return context;
};

export const PdfDesignerPage = () => {
  const location = useLocation();
  const { setTemplate } = usePdfDesigner();

  useEffect(() => {
    if (location.state?.sessionKey) {
      const sessionKey = location.state.sessionKey;
      const templateData = sessionStorage.getItem(sessionKey);
      if (templateData) {
        const parsedTemplate = JSON.parse(templateData);
        setTemplate(parsedTemplate);
        sessionStorage.removeItem(sessionKey);
      }
    }
  }, [location.state, setTemplate]);

  return <PdfmeDesignerComponent />;
};