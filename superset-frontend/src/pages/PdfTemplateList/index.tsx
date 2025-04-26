/**
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
    isFeatureEnabled,
    FeatureFlag,
    JsonResponse,
    styled,
    SupersetClient,
    t,
  } from '@superset-ui/core';
import { useState, useMemo, useCallback } from 'react';
import rison from 'rison';
import { uniqBy } from 'lodash';
import { useSelector } from 'react-redux';
import {
  createErrorHandler,
  createFetchRelated,
  handlePdfTemplateDelete,
} from 'src/views/CRUD/utils';
import {
  // usePdfTemplateEditModal,
  useFavoriteStatus,
  useListViewResource,
} from 'src/views/CRUD/hooks';
import handleResourceExport from 'src/utils/export';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import { TagsList } from 'src/components/Tags';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import FaveStar from 'src/components/FaveStar';
import { Link, useHistory } from 'react-router-dom';
import ListView, {
  Filter,
  FilterOperator,
  Filters,
  ListViewProps,
  SelectOption,
} from 'src/components/ListView';
import Loading from 'src/components/Loading';
import { dangerouslyGetItemDoNotUse } from 'src/utils/localStorageHelpers';
import withToasts from 'src/components/MessageToasts/withToasts';
import PropertiesModal from 'src/explore/components/PropertiesModal';
import PdfTemplate from 'src/types/PdfTemplate';
import Tag from 'src/types/TagType';
import { Tooltip } from 'src/components/Tooltip';
import Icons from 'src/components/Icons';
import { nativeFilterGate } from 'src/dashboard/components/nativeFilters/utils';
import InfoTooltip from 'src/components/InfoTooltip';
import { GenericLink } from 'src/components/GenericLink/GenericLink';
import { loadTags } from 'src/components/Tags/utils';
import FacePile from 'src/components/FacePile';
//   import PdfTemplateCard from 'src/features/pdf_templates/PdfTemplateCard';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import { findPermission } from 'src/utils/findPermission';
import { DashboardCrossLinks } from 'src/components/ListView/DashboardCrossLinks';
import { ModifiedInfo } from 'src/components/AuditInfo';
import { QueryObjectColumns } from 'src/views/CRUD/types';
import PdfTemplateCard from 'src/features/pdf_templates/PdfTemplateCard';
import JSZip from 'jszip';
  
  const FlexRowContainer = styled.div`
    align-items: center;
    display: flex;
  
    a {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      line-height: 1.2;
    }
  
    svg {
      margin-right: ${({ theme }) => theme.gridUnit}px;
    }
  `;
  
  const PAGE_SIZE = 25;
  
  interface PdfTemplateListProps {
    addDangerToast: (msg: string) => void;
    addSuccessToast: (msg: string) => void;
    user: {
      userId: string | number;
      firstName: string;
      lastName: string;
    };
  }
  
  const StyledActions = styled.div`
    color: ${({ theme }) => theme.colors.grayscale.base};
  `;
  
  function PdfTemplateList(props: PdfTemplateListProps) {
    const {
      addDangerToast,
      addSuccessToast,
      user: { userId },
    } = props;
  
    const history = useHistory();
  
    const {
      state: {
        loading,
        resourceCount: pdf_templateCount,
        resourceCollection: pdf_templates,
        bulkSelectEnabled,
      },
      setResourceCollection: setPdfTemplates,
      hasPerm,
      fetchData,
      toggleBulkSelect,
      refreshData,
    } = useListViewResource<PdfTemplate>('pdf_template', t('pdf_template'), addDangerToast);
  
    const pdf_templateIds = useMemo(() => pdf_templates.map(c => c.id), [pdf_templates]);
    const { roles } = useSelector<any, UserWithPermissionsAndRoles>(
      state => state.user,
    );
    const canReadTag = findPermission('can_read', 'Tag', roles);
  
    const [saveFavoriteStatus, favoriteStatus] = useFavoriteStatus(
      'pdf_template',
      pdf_templateIds,
      addDangerToast,
    );
    // const {
    //   sliceCurrentlyEditing,
    //   handlePdfTemplateUpdated,
    //   openPdfTemplateEditModal,
    //   closePdfTemplateEditModal,
    // } = usePdfTemplateEditModal(setPdfTemplates, pdf_templates);
  
    // TODO: Fix usage of localStorage keying on the user id
    const userSettings = dangerouslyGetItemDoNotUse(userId?.toString(), null) as {
      thumbnails: boolean;
    };
  
    const canCreate = hasPerm('can_write');
    const canEdit = hasPerm('can_write');
    const canDelete = hasPerm('can_write');
    const canExport = hasPerm('can_export');
    const initialSort = [{ id: 'changed_on_delta_humanized', desc: true }];
    const handleBulkPdfTemplateExport = (pdf_templatesToExport: PdfTemplate[]) => {
      // If only one template, download it directly as JSON
      if (pdf_templatesToExport.length === 1) {
        const template = pdf_templatesToExport[0];
        const blob = new Blob([JSON.stringify(template.data)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${template.name}.json`;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }

      // For multiple templates, download each one separately
      pdf_templatesToExport.forEach(template => {
        const blob = new Blob([JSON.stringify(template.data)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${template.name}.json`;
        link.click();
        URL.revokeObjectURL(url);
      });
    };
  
    function handleBulkPdfTemplateDelete(pdf_templatesToDelete: PdfTemplate[]) {
      SupersetClient.delete({
        endpoint: `/api/v1/pdf_template/?q=${rison.encode(
          pdf_templatesToDelete.map(({ id }) => id),
        )}`,
      }).then(
        ({ json = {} }) => {
          refreshData();
          addSuccessToast(json.message);
        },
        createErrorHandler(errMsg =>
          addDangerToast(
            t('There was an issue deleting the selected pdf_templates: %s', errMsg),
          ),
        ),
      );
    }
  
    const columns = useMemo(
      () => [
        {
          Cell: ({
            row: {
              original: { id },
            },
          }: any) =>
            userId && (
              <FaveStar
                itemId={id}
                saveFaveStar={saveFavoriteStatus}
                isStarred={favoriteStatus[id]}
              />
            ),
          Header: '',
          id: 'id',
          disableSortBy: true,
          size: 'xs',
          hidden: !userId,
        },
        {
          Cell: ({
            row: {
              original: {
                id,
                name,
                description,
              },
            },
          }: any) => (
            <FlexRowContainer>
              <Link to={`/pdf_template/${id}`} data-test={`${name}-list-pdf_template-title`}>
                
                {name}
              </Link>
              {description && <InfoTooltip tooltip={description} />}
            </FlexRowContainer>
          ),
          Header: t('Name'),
          accessor: 'name',
        },
        {
          Cell: ({
            row: {
              original: { tags = [] },
            },
          }: any) => (
            // Only show custom type tags
            <TagsList
              tags={tags.filter((tag: Tag) =>
                tag.type
                  ? tag.type === 1 || tag.type === 'TagTypes.custom'
                  : true,
              )}
              maxTags={3}
            />
          ),
          Header: t('Tags'),
          accessor: 'tags',
          disableSortBy: true,
          hidden: !isFeatureEnabled(FeatureFlag.TaggingSystem),
        },
        {
          Cell: ({
            row: {
              original: { owners = [] },
            },
          }: any) => <FacePile users={owners} />,
          Header: t('Owners'),
          accessor: 'owners',
          disableSortBy: true,
          size: 'xl',
        },
        {
          Cell: ({
            row: {
              original: {
                changed_on_delta_humanized: changedOn,
                changed_by: changedBy,
              },
            },
          }: any) => <ModifiedInfo date={changedOn} user={changedBy} />,
          Header: t('Created Date'),
          accessor: 'created_on',
          size: 'xl',
        },
        {
          Cell: ({ row: { original } }: any) => {
            const handleDelete = () =>
              handlePdfTemplateDelete(
                original,
                addSuccessToast,
                addDangerToast,
                refreshData,
              );
            // const openEditModal = () => openPdfTemplateEditModal(original);
            const handleExport = () => handleBulkPdfTemplateExport([original]);
            if (!canEdit && !canDelete && !canExport) {
              return null;
            }
  
            return (
              <StyledActions className="actions">
                {canDelete && (
                  <ConfirmStatusChange
                    title={t('Please confirm')}
                    description={
                      <>
                        {t('Are you sure you want to delete')}{' '}
                        <b>{original.name}</b>?
                      </>
                    }
                    onConfirm={handleDelete}
                  >
                    {confirmDelete => (
                      <Tooltip
                        id="delete-action-tooltip"
                        title={t('Delete')}
                        placement="bottom"
                      >
                        <span
                          data-test="trash"
                          role="button"
                          tabIndex={0}
                          className="action-button"
                          onClick={confirmDelete}
                        >
                          <Icons.Trash />
                        </span>
                      </Tooltip>
                    )}
                  </ConfirmStatusChange>
                )}
                {canExport && (
                  <Tooltip
                    id="export-action-tooltip"
                    title={t('Export')}
                    placement="bottom"
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      className="action-button"
                      onClick={handleExport}
                    >
                      <Icons.Share />
                    </span>
                  </Tooltip>
                )}
                {canEdit && (
                  <Tooltip
                    id="edit-action-tooltip"
                    title={t('Edit')}
                    placement="bottom"
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      className="action-button"
                      onClick={() => history.push(`/pdf_template/${original.id}`)}
                    >
                      <Icons.EditAlt data-test="edit-alt" />
                    </span>
                  </Tooltip>
                )}
              </StyledActions>
            );
          },
          Header: t('Actions'),
          id: 'actions',
          disableSortBy: true,
          hidden: !canEdit && !canDelete,
        },
        {
          accessor: QueryObjectColumns.ChangedBy,
          hidden: true,
        },
      ],
      [
        userId,
        canEdit,
        canDelete,
        canExport,
        saveFavoriteStatus,
        favoriteStatus,
        refreshData,
        addSuccessToast,
        addDangerToast,
        history,
      ],
    );
  
    const favoritesFilter: Filter = useMemo(
      () => ({
        Header: t('Favorite'),
        key: 'favorite',
        id: 'id',
        urlDisplay: 'favorite',
        input: 'select',
        operator: FilterOperator.PdfTemplateIsFav,
        unfilteredLabel: t('Any'),
        selects: [
          { label: t('Yes'), value: true },
          { label: t('No'), value: false },
        ],
      }),
      [],
    );
  
    const filters: Filters = useMemo(() => {
      const filters_list = [
        {
          Header: t('Name'),
          key: 'search',
          id: 'name',
          input: 'search',
          operator: FilterOperator.PdfTemplateAllText,
        },
  
        ...(isFeatureEnabled(FeatureFlag.TaggingSystem) && canReadTag
          ? [
              {
                Header: t('Tag'),
                key: 'tags',
                id: 'tags',
                input: 'select',
                operator: FilterOperator.PdfTemplateTagById,
                unfilteredLabel: t('All'),
                fetchSelects: loadTags,
              },
            ]
          : []),
        {
          Header: t('Owner'),
          key: 'owner',
          id: 'owners',
          input: 'select',
          operator: FilterOperator.RelationManyMany,
          unfilteredLabel: t('All'),
          fetchSelects: createFetchRelated(
            'pdf_template',
            'owners',
            createErrorHandler(errMsg =>
              addDangerToast(
                t(
                  'An error occurred while fetching pdf_template owners values: %s',
                  errMsg,
                ),
              ),
            ),
            props.user,
          ),
          paginate: true,
        },
        ...(userId ? [favoritesFilter] : []),
        {
          Header: t('Modified by'),
          key: 'changed_by',
          id: 'changed_by',
          input: 'select',
          operator: FilterOperator.RelationOneMany,
          unfilteredLabel: t('All'),
          fetchSelects: createFetchRelated(
            'pdf_template',
            'changed_by',
            createErrorHandler(errMsg =>
              t(
                'An error occurred while fetching dataset datasource values: %s',
                errMsg,
              ),
            ),
            props.user,
          ),
          paginate: true,
        },
      ] as Filters;
      return filters_list;
    }, [addDangerToast, favoritesFilter, props.user]);
  
    const sortTypes = [
      {
        desc: false,
        id: 'name',
        label: t('Alphabetical'),
        value: 'alphabetical',
      },
      {
        desc: true,
        id: 'changed_on_delta_humanized',
        label: t('Recently modified'),
        value: 'recently_modified',
      },
      {
        desc: false,
        id: 'changed_on_delta_humanized',
        label: t('Least recently modified'),
        value: 'least_recently_modified',
      },
    ];
  
    const renderCard = useCallback(
      (pdf_template: PdfTemplate) => (
        <PdfTemplateCard
          PdfTemplate={pdf_template}
          showThumbnails={
            userSettings
              ? userSettings.thumbnails
              : isFeatureEnabled(FeatureFlag.Thumbnails)
          }
          hasPerm={hasPerm}
        //   openPdfTemplateEditModal={openPdfTemplateEditModal}
          bulkSelectEnabled={bulkSelectEnabled}
          addDangerToast={addDangerToast}
          addSuccessToast={addSuccessToast}
          refreshData={refreshData}
          userId={userId}
          loading={loading}
          favoriteStatus={favoriteStatus[pdf_template.id]}
          saveFavoriteStatus={saveFavoriteStatus}
          handleBulkPdfTemplateExport={handleBulkPdfTemplateExport}
        />
      ),
      [
        addDangerToast,
        addSuccessToast,
        bulkSelectEnabled,
        favoriteStatus,
        hasPerm,
        loading,
      ],
    );
  
    const subMenuButtons: SubMenuProps['buttons'] = [];
    if (canDelete || canExport) {
      subMenuButtons.push({
        name: t('Bulk select'),
        buttonStyle: 'secondary',
        'data-test': 'bulk-select',
        onClick: toggleBulkSelect,
      });
    }
    if (canCreate) {
      subMenuButtons.push({
        name: (
          <>
            <i className="fa fa-plus" /> {t('PDF Template')}
          </>
        ),
        buttonStyle: 'primary',
        onClick: () => {
          history.push('/pdf_template/add');
        },
      });
    }
  
    return (
      <>
        <SubMenu name={t('PDF Templates')} buttons={subMenuButtons} />
        {/* {sliceCurrentlyEditing && (
          <PropertiesModal
            onHide={closePdfTemplateEditModal}
            onSave={handlePdfTemplateUpdated}
            show
            slice={sliceCurrentlyEditing}
          />
        )} */}
        <ConfirmStatusChange
          title={t('Please confirm')}
          description={t('Are you sure you want to delete the selected pdf_templates?')}
          onConfirm={handleBulkPdfTemplateDelete}
        >
          {(confirmDelete: (event: MouseEvent) => void) => {
            const handleBulkDelete = (templatesToDelete: PdfTemplate[]) =>
              SupersetClient.delete({
                endpoint: `/api/v1/pdf_template/?q=${rison.encode(
                  templatesToDelete.map(({ id }) => id),
                )}`,
              }).then(
                ({ json = {} }) => {
                  refreshData();
                  addSuccessToast(json.message);
                },
                createErrorHandler(errMsg =>
                  addDangerToast(
                    t('There was an issue deleting the selected pdf_templates: %s', errMsg),
                  ),
                ),
              );

            return (
              <ListView<PdfTemplate>
                className="pdf_template-list-view"
                columns={columns}
                count={pdf_templateCount}
                data={pdf_templates}
                fetchData={fetchData}
                filters={filters}
                initialSort={initialSort}
                loading={loading}
                pageSize={PAGE_SIZE}
                renderCard={renderCard}
                defaultViewMode={
                  isFeatureEnabled(FeatureFlag.ListviewsDefaultCardView)
                    ? 'card'
                    : 'table'
                }
                bulkActions={
                  canDelete || canExport
                    ? {
                        onBulkDelete: handleBulkDelete,
                        onBulkExport: handleBulkPdfTemplateExport,
                      }
                    : undefined
                }
                bulkSelectEnabled={bulkSelectEnabled}
                disableBulkSelect={toggleBulkSelect}
              />
            );
          }}
        </ConfirmStatusChange>
      </>
    );
  }
  
  export default withToasts(PdfTemplateList);
  