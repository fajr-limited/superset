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

/* eslint-disable react/jsx-sort-default-props */
import { PureComponent } from 'react';
import { t } from '@superset-ui/core';
import { createSelector } from 'reselect';
import getPdfTemplateComponentRegistry from '../registries/PdfTemplateComponentRegistrySingleton';
import getPdfTemplateTransformPropsRegistry from '../registries/PdfTemplateTransformPropsRegistrySingleton';
import PdfTemplateProps from '../models/PdfTemplateProps';
import createLoadableRenderer from './createLoadableRenderer';
import { PdfTemplateType } from '../models/PdfTemplatePlugin';
import {
  PreTransformProps,
  TransformProps,
  PostTransformProps,
} from '../types/TransformFunction';
import { HandlerFunction } from '../types/Base';

function IDENTITY<T>(x: T) {
  return x;
}

const EMPTY = () => null;

const defaultProps = {
  id: '',
  className: '',
  preTransformProps: IDENTITY,
  overrideTransformProps: undefined,
  postTransformProps: IDENTITY,
  onRenderSuccess() {},
  onRenderFailure() {},
};

interface LoadingProps {
  error: { toString(): string };
}

interface LoadedModules {
  PdfTemplate: PdfTemplateType;
  transformProps: TransformProps;
}

interface RenderProps {
  pdf_templateProps: PdfTemplateProps;
  preTransformProps?: PreTransformProps;
  postTransformProps?: PostTransformProps;
}

const BLANK_CHART_PROPS = new PdfTemplateProps();

export type Props = {
  id?: string;
  className?: string;
  pdf_templateProps?: PdfTemplateProps | null;
  pdf_templateType: string;
  preTransformProps?: PreTransformProps;
  overrideTransformProps?: TransformProps;
  postTransformProps?: PostTransformProps;
  onRenderSuccess?: HandlerFunction;
  onRenderFailure?: HandlerFunction;
};

export default class SuperPdfTemplateCore extends PureComponent<Props, {}> {
  /**
   * The HTML element that wraps all pdf_template content
   */
  container?: HTMLElement | null;

  /**
   * memoized function so it will not recompute
   * and return previous value
   * unless one of
   * - preTransformProps
   * - transformProps
   * - postTransformProps
   * - pdf_templateProps
   * is changed.
   */
  processPdfTemplateProps = createSelector(
    [
      (input: {
        pdf_templateProps: PdfTemplateProps;
        preTransformProps?: PreTransformProps;
        transformProps?: TransformProps;
        postTransformProps?: PostTransformProps;
      }) => input.pdf_templateProps,
      input => input.preTransformProps,
      input => input.transformProps,
      input => input.postTransformProps,
    ],
    (pdf_templateProps, pre = IDENTITY, transform = IDENTITY, post = IDENTITY) =>
      post(transform(pre(pdf_templateProps))),
  );

  /**
   * memoized function so it will not recompute
   * and return previous value
   * unless one of
   * - pdf_templateType
   * - overrideTransformProps
   * is changed.
   */
  private createLoadableRenderer = createSelector(
    [
      (input: { pdf_templateType: string; overrideTransformProps?: TransformProps }) =>
        input.pdf_templateType,
      input => input.overrideTransformProps,
    ],
    (pdf_templateType, overrideTransformProps) => {
      if (pdf_templateType) {
        const Renderer = createLoadableRenderer({
          loader: {
            PdfTemplate: () => getPdfTemplateComponentRegistry().getAsPromise(pdf_templateType),
            transformProps: overrideTransformProps
              ? () => Promise.resolve(overrideTransformProps)
              : () => getPdfTemplateTransformPropsRegistry().getAsPromise(pdf_templateType),
          },
          loading: (loadingProps: LoadingProps) =>
            this.renderLoading(loadingProps, pdf_templateType),
          render: this.renderPdfTemplate,
        });

        // Trigger preloading.
        Renderer.preload();

        return Renderer;
      }

      return EMPTY;
    },
  );

  static defaultProps = defaultProps;

  private renderPdfTemplate = (loaded: LoadedModules, props: RenderProps) => {
    const { PdfTemplate, transformProps } = loaded;
    const { pdf_templateProps, preTransformProps, postTransformProps } = props;

    return (
      <PdfTemplate
        {...this.processPdfTemplateProps({
          pdf_templateProps,
          preTransformProps,
          transformProps,
          postTransformProps,
        })}
      />
    );
  };

  private renderLoading = (loadingProps: LoadingProps, pdf_templateType: string) => {
    const { error } = loadingProps;

    if (error) {
      return (
        <div className="alert alert-warning" role="alert">
          <strong>{t('ERROR')}</strong>&nbsp;
          <code>pdf_templateType=&quot;{pdf_templateType}&quot;</code> &mdash;
          {error.toString()}
        </div>
      );
    }

    return null;
  };

  private setRef = (container: HTMLElement | null) => {
    this.container = container;
  };

  render() {
    const {
      id,
      className,
      preTransformProps,
      postTransformProps,
      pdf_templateProps = BLANK_CHART_PROPS,
      onRenderSuccess,
      onRenderFailure,
    } = this.props;

    // Create LoadableRenderer and start preloading
    // the lazy-loaded PdfTemplate components
    const Renderer = this.createLoadableRenderer(this.props);

    // Do not render if pdf_templateProps is set to null.
    // but the pre-loading has been started in this.createLoadableRenderer
    // to prepare for rendering once pdf_templateProps becomes available.
    if (pdf_templateProps === null) {
      return null;
    }

    const containerProps: {
      id?: string;
      className?: string;
    } = {};
    if (id) {
      containerProps.id = id;
    }
    if (className) {
      containerProps.className = className;
    }

    return (
      <div {...containerProps} ref={this.setRef}>
        <Renderer
          preTransformProps={preTransformProps}
          postTransformProps={postTransformProps}
          pdf_templateProps={pdf_templateProps}
          onRenderSuccess={onRenderSuccess}
          onRenderFailure={onRenderFailure}
        />
      </div>
    );
  }
}
