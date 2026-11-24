"""Create project records with UUID identifiers and UTC timestamps."""
from alembic import op
import sqlalchemy as sa
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("projects", sa.Column("id", sa.Uuid(), primary_key=True), sa.Column("name", sa.String(80), nullable=False), sa.Column("description", sa.Text(), nullable=False), sa.Column("environment", sa.String(32), nullable=False), sa.Column("status", sa.String(20), nullable=False), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_projects_name", "projects", ["name"])


def downgrade():
    op.drop_index("ix_projects_name", table_name="projects")
    op.drop_table("projects")
