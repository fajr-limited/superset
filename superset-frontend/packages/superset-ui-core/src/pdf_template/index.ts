/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import PdfTemplateProps, { PdfTemplatePropsConfig } from './models/PdfTemplateProps';

export { default as PdfTemplateClient } from './clients/PdfTemplateClient';
export { default as PdfTemplateMetadata } from './models/PdfTemplateMetadata';
export { default as PdfTemplatePlugin } from './models/PdfTemplatePlugin';
export { PdfTemplateProps };
export type { PdfTemplatePropsConfig };

export { default as createLoadableRenderer } from './components/createLoadableRenderer';
export { default as reactify } from './components/reactify';
export { default as SuperPdfTemplate } from './components/SuperPdfTemplate';

export { default as getPdfTemplateBuildQueryRegistry } from './registries/PdfTemplateBuildQueryRegistrySingleton';
export { default as getPdfTemplateComponentRegistry } from './registries/PdfTemplateComponentRegistrySingleton';
export { default as getPdfTemplateControlPanelRegistry } from './registries/PdfTemplateControlPanelRegistrySingleton';
export { default as getPdfTemplateMetadataRegistry } from './registries/PdfTemplateMetadataRegistrySingleton';
export { default as getPdfTemplateTransformPropsRegistry } from './registries/PdfTemplateTransformPropsRegistrySingleton';
export type { BuildQuery } from './registries/PdfTemplateBuildQueryRegistrySingleton';

export { default as PdfTemplateDataProvider } from './components/PdfTemplateDataProvider';

export * from './types/Base';
export * from './types/TransformFunction';
export * from './types/QueryResponse';

export { default as __hack_reexport_pdf_template_Base } from './types/Base';
export { default as __hack_reexport_pdf_template_TransformFunction } from './types/TransformFunction';
export { default as __hack_reexport_pdf_template_QueryResponse } from './types/QueryResponse';
