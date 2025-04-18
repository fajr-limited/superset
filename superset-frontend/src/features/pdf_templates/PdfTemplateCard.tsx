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
import { isFeatureEnabled, FeatureFlag, t, useTheme } from '@superset-ui/core';
import { Link, useHistory } from 'react-router-dom';
import ConfirmStatusChange from 'src/components/ConfirmStatusChange';
import Icons from 'src/components/Icons';
import PdfTemplate from 'src/types/PdfTemplate';

import ListViewCard from 'src/components/ListViewCard';
import Label from 'src/components/Label';
import { AntdDropdown } from 'src/components';
import { Menu } from 'src/components/Menu';
import FaveStar from 'src/components/FaveStar';
import FacePile from 'src/components/FacePile';
import { handlePdfTemplateDelete, CardStyles } from 'src/views/CRUD/utils';

interface PdfTemplateCardProps {
  PdfTemplate: PdfTemplate;
  hasPerm: (perm: string) => boolean;
  // openPdfTemplateEditModal: (PdfTemplate: PdfTemplate) => void;
  bulkSelectEnabled: boolean;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  refreshData: () => void;
  loading?: boolean;
  saveFavoriteStatus: (id: number, isStarred: boolean) => void;
  favoriteStatus: boolean;
  PdfTemplateFilter?: string;
  userId?: string | number;
  showThumbnails?: boolean;
  handleBulkPdfTemplateExport: (PdfTemplatesToExport: PdfTemplate[]) => void;
}

export default function PdfTemplateCard({
  PdfTemplate,
  hasPerm,
  // openPdfTemplateEditModal,
  bulkSelectEnabled,
  addDangerToast,
  addSuccessToast,
  refreshData,
  loading,
  showThumbnails,
  saveFavoriteStatus,
  favoriteStatus,
  PdfTemplateFilter,
  userId,
  handleBulkPdfTemplateExport,
}: PdfTemplateCardProps) {
  const history = useHistory();
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canExport = hasPerm('can_export');
  const theme = useTheme();

  const menu = (
    <Menu>
      {canDelete && (
        <Menu.Item>
          <ConfirmStatusChange
            title={t('Please confirm')}
            description={
              <>
                {t('Are you sure you want to delete')} <b>{PdfTemplate.name}</b>
                ?
              </>
            }
            onConfirm={() =>
              handlePdfTemplateDelete(
                PdfTemplate,
                addSuccessToast,
                addDangerToast,
                refreshData,
                PdfTemplateFilter,
                userId,
              )
            }
          >
            {confirmDelete => (
              <div
                data-test="PdfTemplate-list-delete-option"
                role="button"
                tabIndex={0}
                className="action-button"
                onClick={confirmDelete}
              >
                <Icons.Trash iconSize="l" /> {t('Delete')}
              </div>
            )}
          </ConfirmStatusChange>
        </Menu.Item>
      )}
      {canExport && (
        <Menu.Item>
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleBulkPdfTemplateExport([PdfTemplate])}
          >
            <Icons.Share iconSize="l" /> {t('Export')}
          </div>
        </Menu.Item>
      )}
      {canEdit && (
        <Menu.Item>
          <div
            data-test="PdfTemplate-list-edit-option"
            role="button"
            tabIndex={0}
            onClick={() => history.push(`/pdf_template/${PdfTemplate.id}`)}
          >
            <Icons.EditAlt iconSize="l" /> {t('Edit')}
          </div>
        </Menu.Item>
      )}
    </Menu>
  );
  return (
    <CardStyles
      onClick={() => {
        if (!bulkSelectEnabled && PdfTemplate.url) {
          history.push(PdfTemplate.url);
        }
      }}
    >
      <ListViewCard
        loading={loading}
        title={PdfTemplate.name}
        cover={
          !isFeatureEnabled(FeatureFlag.Thumbnails) || !showThumbnails ? (
            <></>
          ) : null
        }
        // url={bulkSelectEnabled ? undefined : PdfTemplate.url}
        imgURL={PdfTemplate.thumbnail_url || ''}
        imgFallbackURL="/static/assets/images/PdfTemplate-card-fallback.svg"
        description={t('Modified %s', PdfTemplate.changed_on_delta_humanized)}
        coverLeft={<FacePile users={PdfTemplate.owners || []} />}
        linkComponent={Link}
        actions={
          <ListViewCard.Actions
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            {userId && (
              <FaveStar
                itemId={PdfTemplate.id}
                saveFaveStar={saveFavoriteStatus}
                isStarred={favoriteStatus}
              />
            )}
            <AntdDropdown overlay={menu}>
              <Icons.MoreVert iconColor={theme.colors.grayscale.base} />
            </AntdDropdown>
          </ListViewCard.Actions>
        }
      />
    </CardStyles>
  );
}
