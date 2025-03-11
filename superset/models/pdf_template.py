import logging

from flask_appbuilder import Model
from superset.models.helpers import AuditMixinNullable
from superset import db, security_manager
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
)


metadata = Model.metadata  # pylint: disable=no-member
pdf_template_user = Table(
    "pdf_template_user",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, ForeignKey("ab_user.id", ondelete="CASCADE")),
    Column("pdf_template_id", Integer, ForeignKey("pdf_templates.id", ondelete="CASCADE")),
)
logger = logging.getLogger(__name__)

class PdfTemplate(db.Model, AuditMixinNullable):
    __tablename__ = "pdf_templates"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    data = Column(JSON, nullable=True)
    description = Column(Text)
    # last_saved_at = Column(DateTime, nullable=True)
    # last_saved_by_fk = Column(Integer, ForeignKey("ab_user.id"), nullable=True)
    
    # last_saved_by = relationship(
    #     security_manager.user_model, foreign_keys=[last_saved_by_fk]
    # )
    
    owners = relationship(
        security_manager.user_model,
        secondary=pdf_template_user,
        passive_deletes=True,
    )
    
    tags = relationship(
        "Tag",
        secondary="tagged_object",
        overlaps="objects,tag,tags",
        primaryjoin="and_(PdfTemplate.id == TaggedObject.object_id, "
        "TaggedObject.object_type == 'pdf_template')",
        secondaryjoin="TaggedObject.tag_id == Tag.id",
        viewonly=True,  # cascading deletion already handled by superset.tags.models.ObjectUpdater.after_delete  # noqa: E501
    )
    
    def __repr__(self):
        return f"<PdfTemplate {self.name}>"
    
    @property
    def thumbnail_url(self) -> str | None:
        """
        Returns a thumbnail URL with a HEX digest. We want to avoid browser cache
        if the dashboard has changed
        """
        if digest := self.digest:
            return f"/api/v1/pdf_template/{self.id}/thumbnail/{digest}/"

        return None