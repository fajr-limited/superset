import { Plugin, Schema, PDFRenderProps } from "@pdfme/common";

interface BoldText extends Schema {
    fontSize?: number;
    fontWeight?: string;
    text?: string;
}

export const boldText: Plugin<BoldText> = {
    ui: async ({ schema, value, onChange, rootElement, mode }) => {
        const input = document.createElement("input");
        input.type = "text";
        input.value = value || schema.text || "";
        input.style.fontSize = `${schema.fontSize || 16}px`;
        input.style.fontWeight = schema.fontWeight || "bold";
        input.style.width = "100%";
        input.style.height = "100%";
        input.style.border = "none";
        input.style.background = "transparent";
        input.style.outline = "none";
        input.style.textAlign = "center";

        if (mode === "viewer") {
            input.setAttribute("readonly", "true");
        } else {
            input.addEventListener("input", () => {
                if (onChange) {
                    onChange({ key: "text", value: input.value });
                }
            });
        }

        rootElement.appendChild(input);
    },
    pdf: async ({ pdfDoc, schema, value }: PDFRenderProps<BoldText>) => {
        const fontSize = schema.fontSize || 16;
        const text = value || schema.text || "";

        
        pdfDoc.addText(text, {
            x: schema.x,
            y: schema.y,
            fontSize,
            fontName: "Helvetica-Bold",
        });
    },
    propPanel: {
        schema: {
            fontSize: { type: "number", default: 16 },
            fontWeight: { type: "string", default: "bold" },
            text: { type: "string", default: "Bold Text" }
        },
        defaultValue: { text: "Bold Text" }
    }
};
