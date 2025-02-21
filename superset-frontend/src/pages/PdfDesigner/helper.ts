import { Template, checkTemplate, BLANK_PDF } from "@pdfme/common";
import {
  multiVariableText,
  text,
  barcodes,
  image,
  svg,
  line,
  table,
  rectangle,
  ellipse,
  dateTime,
  date,
  time,
  select,
  checkbox,
  radioGroup,
} from '@pdfme/schemas';
export const readFile = (
  file: File | null,
  type: "text" | "dataURL" | "arrayBuffer"
) => {
  return new Promise<string | ArrayBuffer>((r) => {
    const fileReader = new FileReader();
    fileReader.addEventListener("load", (e) => {
      if (e && e.target && e.target.result && file !== null) {
        r(e.target.result);
      }
    });
    if (file !== null) {
      if (type === "text") {
        fileReader.readAsText(file);
      } else if (type === "dataURL") {
        fileReader.readAsDataURL(file);
      } else if (type === "arrayBuffer") {
        fileReader.readAsArrayBuffer(file);
      }
    }
  });
};

export const cloneDeep = (obj: any) => JSON.parse(JSON.stringify(obj));

export const getTemplateFromJsonFile = (file: File) => {
  return readFile(file, "text").then((jsonStr) => {
    const template: Template = JSON.parse(jsonStr as string);
    try {
      checkTemplate(template);
      return template;
    } catch (e) {
      throw e;
    }
  });
};

export const downloadJsonFile = (json: any, title: string) => {
  if (typeof window !== "undefined") {
    const blob = new Blob([JSON.stringify(json)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
};

export const isJsonString = (str: string) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
};

export function getTemplate(): Template {
  const headObject = ["id", "name", "age", "city"];
  const contentObject = [
    ["1", "John Doe", "28", "New York"],
    ["2", "Jane Smith", "34", "San Francisco"]
  ];

  const template: Template = {
    basePdf: BLANK_PDF,
    schemas: [
      [
        {
          "name": "name",
          "type": "text",
          "content": "Pet Name",
          "position": {
            "x": 24.8,
            "y": 26.61
          },
          "width": 77.77,
          "height": 18.7,
          "fontSize": 36,
          "fontColor": "#14b351"
        },
        // {
      //   name: 'example_image',
      //   type: 'image',
      //   position: { x: 200, y: 200 },
      //   width: 60,
      //   height: 40,
      // },
        {
          "name": "age",
          "type": "text",
          "content": "4 years",
          "position": {
            "x": 36,
            "y": 179.46
          },
          "width": 43.38,
          "height": 6.12,
          "fontSize": 12
        },
        {
          "name": "sex",
          "type": "text",
          "content": "Male",
          "position": {
            "x": 36,
            "y": 186.23
          },
          "width": 43.38,
          "height": 6.12,
          "fontSize": 12
        },
        {
          "name": "weight",
          "type": "text",
          "content": "33 pounds",
          "position": {
            "x": 40,
            "y": 192.99
          },
          "width": 43.38,
          "height": 6.12,
          "fontSize": 12
        },
        {
          "name": "breed",
          "type": "text",
          "content": "Mutt",
          "position": {
            "x": 40,
            "y": 199.09
          },
          "width": 43.38,
          "height": 6.12,
          "fontSize": 12
        },
        {
          "name": "table_1",
          "type": "table",
          "position": {
            "x": 28.92,
            "y": 51.36
          },
          "width": 150,
          "height": 57.5184,
          "content": JSON.stringify(contentObject.map(row => row.map(String))),
          "showHead": true,
          "head": headObject,
          "headWidthPercentages": [25, 25, 25, 25],
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
        }
      ]
    ]
  };
  console.log("Generated Template Schema:", JSON.stringify(template, null, 2));
  return template;
}

export function getTemplatePlugins() {
  return {
    Text: text,
    'Multi-Variable Text': multiVariableText,
    Table: table,
    Line: line,
    // Rectangle: rectangle,
    // Ellipse: ellipse,
    Image: image,
    // SVG: svg,
    // Signature: plugins.signature,
    QR: barcodes.qrcode,
    DateTime: dateTime,
    Date: date,
    Time: time,
    // Select: select,
    // Checkbox: checkbox,
    // RadioGroup: radioGroup,
    // JAPANPOST: barcodes.japanpost,
    // EAN13: barcodes.ean13,
    // EAN8: barcodes.ean8,
    // Code39: barcodes.code39,
    // Code128: barcodes.code128,
    // NW7: barcodes.nw7,
    // ITF14: barcodes.itf14,
    // UPCA: barcodes.upca,
    // UPCE: barcodes.upce,
    // GS1DataMatrix: barcodes.gs1datamatrix,
  };
};
