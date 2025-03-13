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

import {
  ReactNode,
  RefObject,
  ComponentType,
  PureComponent,
  Fragment,
} from 'react';

import ErrorBoundary, {
  ErrorBoundaryProps,
  FallbackProps,
} from 'react-error-boundary';
import { ParentSize } from '@vx/responsive';
import { createSelector } from 'reselect';
import { withTheme } from '@emotion/react';
import { parseLength, Dimension } from '../../dimension';
import getPdfTemplateMetadataRegistry from '../registries/PdfTemplateMetadataRegistrySingleton';
import SuperPdfTemplateCore, { Props as SuperPdfTemplateCoreProps } from './SuperPdfTemplateCore';
import DefaultFallbackComponent from './FallbackComponent';
import PdfTemplateProps, { PdfTemplatePropsConfig } from '../models/PdfTemplateProps';
import NoResultsComponent from './NoResultsComponent';

const defaultProps = {
  FallbackComponent: DefaultFallbackComponent,
  height: 400 as string | number,
  width: '100%' as string | number,
  enableNoResults: true,
};

export type FallbackPropsWithDimension = FallbackProps & Partial<Dimension>;

export type WrapperProps = Dimension & {
  children: ReactNode;
};

export type Props = Omit<SuperPdfTemplateCoreProps, 'pdf_templateProps'> &
  Omit<PdfTemplatePropsConfig, 'width' | 'height'> & {
    /**
     * Set this to true to disable error boundary built-in in SuperPdfTemplate
     * and let the error propagate to upper level
     * and handle by yourself
     */
    disableErrorBoundary?: boolean;
    /** debounceTime to check for container resize */
    debounceTime?: number;
    /** enable "No Results" message if empty result set */
    enableNoResults?: boolean;
    /** Component to render when there are unexpected errors */
    FallbackComponent?: ComponentType<FallbackPropsWithDimension>;
    /** Event listener for unexpected errors from pdf_template */
    onErrorBoundary?: ErrorBoundaryProps['onError'];
    /** Prop for form plugins using superpdf_template */
    showOverflow?: boolean;
    /** Prop for popovercontainer ref */
    parentRef?: RefObject<any>;
    /** Prop for pdf_template ref */
    inputRef?: RefObject<any>;
    /** PdfTemplate width */
    height?: number | string;
    /** PdfTemplate height */
    width?: number | string;
    /**
     * Component to wrap the actual pdf_template
     * after the dynamic width and height are determined.
     * This can be useful for handling tooltip z-index, etc.
     * e.g. <div style={{ position: 'fixed' }} />
     * You cannot just wrap this same component outside of SuperPdfTemplate
     * when using dynamic width or height
     * because it will clash with auto-sizing.
     */
    Wrapper?: ComponentType<WrapperProps>;
    /**
     * Component to display when query returns no results.
     * If not defined, NoResultsComponent is used
     */
    noResults?: ReactNode;
    /**
     * Determines is the context menu related to the pdf_template is open
     */
    inContextMenu?: boolean;
  };

type PropsWithDefault = Props & Readonly<typeof defaultProps>;

class SuperPdfTemplate extends PureComponent<Props, {}> {
  /**
   * SuperPdfTemplate's core
   */
  core?: SuperPdfTemplateCore | null;

  private createPdfTemplateProps = PdfTemplateProps.createSelector();

  private parseDimension = createSelector(
    [
      ({ width }: { width: string | number; height: string | number }) => width,
      ({ height }) => height,
    ],
    (width, height) => {
      // Parse them in case they are % or 'auto'
      const widthInfo = parseLength(width);
      const heightInfo = parseLength(height);
      const boxHeight = heightInfo.isDynamic
        ? `${heightInfo.multiplier * 100}%`
        : heightInfo.value;
      const boxWidth = widthInfo.isDynamic
        ? `${widthInfo.multiplier * 100}%`
        : widthInfo.value;
      const style = {
        height: boxHeight,
        width: boxWidth,
      };

      // bounding box will ensure that when one dimension is not dynamic
      // e.g. height = 300
      // the auto size will be bound to that value instead of being 100% by default
      // e.g. height: 300 instead of height: '100%'
      const BoundingBox =
        widthInfo.isDynamic &&
        heightInfo.isDynamic &&
        widthInfo.multiplier === 1 &&
        heightInfo.multiplier === 1
          ? Fragment
          : ({ children }: { children: ReactNode }) => (
              <div style={style}>{children}</div>
            );

      return { BoundingBox, heightInfo, widthInfo };
    },
  );

  static defaultProps = defaultProps;

  private setRef = (core: SuperPdfTemplateCore | null) => {
    this.core = core;
  };

  private getQueryCount = () =>
    getPdfTemplateMetadataRegistry().get(this.props.pdf_templateType)?.queryObjectCount ?? 1;

  renderPdfTemplate(width: number, height: number) {
    const {
      id,
      className,
      pdf_templateType,
      preTransformProps,
      overrideTransformProps,
      postTransformProps,
      onRenderSuccess,
      onRenderFailure,
      disableErrorBoundary,
      FallbackComponent,
      onErrorBoundary,
      Wrapper,
      queriesData,
      enableNoResults,
      noResults,
      theme,
      ...rest
    } = this.props as PropsWithDefault;

    const pdf_templateProps = this.createPdfTemplateProps({
      ...rest,
      queriesData,
      height,
      width,
      theme,
    });

    let pdf_template;
    // Render the no results component if the query data is null or empty
    const noResultQueries =
      enableNoResults &&
      (!queriesData ||
        queriesData
          .slice(0, this.getQueryCount())
          .every(
            ({ data }) => !data || (Array.isArray(data) && data.length === 0),
          ));
    if (noResultQueries) {
      pdf_template = noResults || (
        <NoResultsComponent
          id={id}
          className={className}
          height={height}
          width={width}
        />
      );
    } else {
      const pdf_templateWithoutWrapper = (
        <SuperPdfTemplateCore
          ref={this.setRef}
          id={id}
          className={className}
          pdf_templateType={pdf_templateType}
          pdf_templateProps={pdf_templateProps}
          preTransformProps={preTransformProps}
          overrideTransformProps={overrideTransformProps}
          postTransformProps={postTransformProps}
          onRenderSuccess={onRenderSuccess}
          onRenderFailure={onRenderFailure}
        />
      );
      pdf_template = Wrapper ? (
        <Wrapper width={width} height={height}>
          {pdf_templateWithoutWrapper}
        </Wrapper>
      ) : (
        pdf_templateWithoutWrapper
      );
    }
    // Include the error boundary by default unless it is specifically disabled.
    return disableErrorBoundary === true ? (
      pdf_template
    ) : (
      <ErrorBoundary
        FallbackComponent={(props: FallbackProps) => (
          <FallbackComponent width={width} height={height} {...props} />
        )}
        onError={onErrorBoundary}
      >
        {pdf_template}
      </ErrorBoundary>
    );
  }

  render() {
    const { heightInfo, widthInfo, BoundingBox } = this.parseDimension(
      this.props as PropsWithDefault,
    );

    // If any of the dimension is dynamic, get parent's dimension
    if (widthInfo.isDynamic || heightInfo.isDynamic) {
      const { debounceTime } = this.props;

      return (
        <BoundingBox>
          <ParentSize debounceTime={debounceTime}>
            {({ width, height }) =>
              this.renderPdfTemplate(
                widthInfo.isDynamic ? Math.floor(width) : widthInfo.value,
                heightInfo.isDynamic ? Math.floor(height) : heightInfo.value,
              )
            }
          </ParentSize>
        </BoundingBox>
      );
    }

    return this.renderPdfTemplate(widthInfo.value, heightInfo.value);
  }
}

export default withTheme(SuperPdfTemplate);
