from __future__ import annotations

from typing import Annotated

from fastapi import Depends

from app.core.deps import DbConn
from app.events.publisher import publisher
from app.services.campaigns import CampaignService
from app.services.contributions import ContributionService


def get_campaign_service(conn: DbConn) -> CampaignService:
    return CampaignService(conn, publisher)


def get_contribution_service(conn: DbConn) -> ContributionService:
    return ContributionService(conn, publisher)


CampaignServiceDep = Annotated[CampaignService, Depends(get_campaign_service)]
ContributionServiceDep = Annotated[ContributionService, Depends(get_contribution_service)]
