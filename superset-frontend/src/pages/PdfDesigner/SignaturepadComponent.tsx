import React, { useEffect, useRef } from 'react';
import SignaturePad from 'signature_pad';
import { UIRenderProps } from "@pdfme/common";

const SignaturepadComponent: React.FC<UIRenderProps<any>> = ({ schema, onChange }, data) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      signaturePadRef.current = new SignaturePad(canvasRef.current, schema.options);

      const resizeCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d')?.scale(ratio, ratio);
        signaturePadRef.current?.clear();
        return;
      };

      window.addEventListener('resize', resizeCanvas);
      resizeCanvas();

      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, [schema]);

  useEffect(() => {
    if (signaturePadRef.current && data) {
      signaturePadRef.current.fromDataURL(data);
    }
  }, [data]);

  useEffect(() => {
    if (signaturePadRef.current) {
      signaturePadRef.current.addEventListener('end', () => { 
        if (onChange) {
          onChange({ key: schema.name, value: signaturePadRef.current?.toDataURL() });
        }
      });
    }
      return () => {
          if(signaturePadRef.current){
              signaturePadRef.current.removeEventListener('end', () => {
                if (onChange) {
                  onChange({ key: schema.name, value: signaturePadRef.current?.toDataURL() });
                }
              })
          }
      }
  }, [onChange, schema.name]);

  const clearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      if (onChange) {
        onChange({ key: schema.name, value: '' });
      }
    }
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ border: '1px solid #000', cursor: 'crosshair', width: '100%', height: '200px' }}
      ></canvas>
      <button onClick={clearSignature}>Clear Signature</button>
    </div>
  );
};

export default SignaturepadComponent;