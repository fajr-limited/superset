import { type Template } from '@pdfme/common'
import Owner from './Owner';
import Tag from './TagType';

export interface PdfTemplate {
    id: number;
    name: string;
    description: string;
    data: Template;
    owners?: Owner[];
    tags?: Tag[];
    last_saved_at?: string;
    last_saved_by?: {
        id: number;
        first_name: string;
        last_name: string;
    };
    changed_on: string;
    changed_on_delta_humanized?: string;
    changed_on_utc?: string;
    thumbnail_url?: string;
    url: string;

}

export default PdfTemplate;