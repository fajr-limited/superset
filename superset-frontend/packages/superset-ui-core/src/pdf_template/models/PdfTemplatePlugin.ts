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

import { ComponentType } from 'react';
import { isRequired, Plugin, QueryFormData } from '../..';
import PdfTemplateMetadata from './PdfTemplateMetadata';
import getPdfTemplateMetadataRegistry from '../registries/PdfTemplateMetadataRegistrySingleton';
import getPdfTemplateBuildQueryRegistry from '../registries/PdfTemplateBuildQueryRegistrySingleton';
import getPdfTemplateComponentRegistry from '../registries/PdfTemplateComponentRegistrySingleton';
import getPdfTemplateControlPanelRegistry from '../registries/PdfTemplateControlPanelRegistrySingleton';
import getPdfTemplateTransformPropsRegistry from '../registries/PdfTemplateTransformPropsRegistrySingleton';
import { BuildQueryFunction, TransformProps } from '../types/TransformFunction';
import { PdfTemplateControlPanel } from './PdfTemplateControlPanel';
import { PdfTemplateProps } from '..';

function IDENTITY<T>(x: T) {
  return x;
}

const EMPTY = {};

export type PromiseOrValue<T> = Promise<T> | T;
export type PromiseOrValueLoader<T> = () => PromiseOrValue<T>;
export type PdfTemplateType = ComponentType<any>;
type ValueOrModuleWithValue<T> = T | { default: T };

interface PdfTemplatePluginConfig<
  FormData extends QueryFormData = QueryFormData,
  Props extends PdfTemplateProps = PdfTemplateProps,
> {
  metadata: PdfTemplateMetadata;
  /** Use buildQuery for immediate value. For lazy-loading, use loadBuildQuery. */
  buildQuery?: BuildQueryFunction<FormData>;
  /** Use loadBuildQuery for dynamic import (lazy-loading) */
  loadBuildQuery?: PromiseOrValueLoader<
    ValueOrModuleWithValue<BuildQueryFunction<FormData>>
  >;
  /** Use transformProps for immediate value. For lazy-loading, use loadTransformProps.  */
  transformProps?: TransformProps<Props>;
  /** Use loadTransformProps for dynamic import (lazy-loading) */
  loadTransformProps?: PromiseOrValueLoader<
    ValueOrModuleWithValue<TransformProps<Props>>
  >;
  /** Use PdfTemplate for immediate value. For lazy-loading, use loadPdfTemplate. */
  PdfTemplate?: PdfTemplateType;
  /** Use loadPdfTemplate for dynamic import (lazy-loading) */
  loadPdfTemplate?: PromiseOrValueLoader<ValueOrModuleWithValue<PdfTemplateType>>;
  /** Control panel configuration object */
  controlPanel?: PdfTemplateControlPanel;
}

/**
 * Loaders of the form `() => import('foo')` may return esmodules
 * which require the value to be extracted as `module.default`
 * */
function sanitizeLoader<T extends object>(
  loader: PromiseOrValueLoader<ValueOrModuleWithValue<T>>,
): PromiseOrValueLoader<T> {
  return () => {
    const loaded = loader();

    return loaded instanceof Promise
      ? (loaded.then(
          module => ('default' in module && module.default) || module,
        ) as Promise<T>)
      : (loaded as T);
  };
}

export default class PdfTemplatePlugin<
  FormData extends QueryFormData = QueryFormData,
  Props extends PdfTemplateProps = PdfTemplateProps,
> extends Plugin {
  controlPanel: PdfTemplateControlPanel;

  metadata: PdfTemplateMetadata;

  loadBuildQuery?: PromiseOrValueLoader<BuildQueryFunction<FormData>>;

  loadTransformProps: PromiseOrValueLoader<TransformProps<Props>>;

  loadPdfTemplate: PromiseOrValueLoader<PdfTemplateType>;

  constructor(config: PdfTemplatePluginConfig<FormData, Props>) {
    super();
    const {
      metadata,
      buildQuery,
      loadBuildQuery,
      transformProps = IDENTITY,
      loadTransformProps,
      PdfTemplate,
      loadPdfTemplate,
      controlPanel = EMPTY,
    } = config;
    this.controlPanel = controlPanel;
    this.metadata = metadata;
    this.loadBuildQuery =
      (loadBuildQuery && sanitizeLoader(loadBuildQuery)) ||
      (buildQuery && sanitizeLoader(() => buildQuery)) ||
      undefined;
    this.loadTransformProps = sanitizeLoader(
      loadTransformProps ?? (() => transformProps),
    );

    if (loadPdfTemplate) {
      this.loadPdfTemplate = sanitizeLoader<PdfTemplateType>(loadPdfTemplate);
    } else if (PdfTemplate) {
      this.loadPdfTemplate = () => PdfTemplate;
    } else {
      throw new Error('PdfTemplate or loadPdfTemplate is required');
    }
  }

  register() {
    const key: string = this.config.key || isRequired('config.key');
    getPdfTemplateMetadataRegistry().registerValue(key, this.metadata);
    getPdfTemplateComponentRegistry().registerLoader(key, this.loadPdfTemplate);
    getPdfTemplateControlPanelRegistry().registerValue(key, this.controlPanel);
    getPdfTemplateTransformPropsRegistry().registerLoader(
      key,
      this.loadTransformProps,
    );
    if (this.loadBuildQuery) {
      getPdfTemplateBuildQueryRegistry().registerLoader(key, this.loadBuildQuery);
    }
    return this;
  }

  unregister() {
    const key: string = this.config.key || isRequired('config.key');
    getPdfTemplateMetadataRegistry().remove(key);
    getPdfTemplateComponentRegistry().remove(key);
    getPdfTemplateControlPanelRegistry().remove(key);
    getPdfTemplateTransformPropsRegistry().remove(key);
    getPdfTemplateBuildQueryRegistry().remove(key);
    return this;
  }

  configure(config: { [key: string]: unknown }, replace?: boolean) {
    super.configure(config, replace);

    return this;
  }
}
