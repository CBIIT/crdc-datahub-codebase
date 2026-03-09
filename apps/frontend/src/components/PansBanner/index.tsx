import { useQuery } from "@apollo/client";
import { Box, Skeleton, Stack, styled, Typography } from "@mui/material";
import React, { memo, useMemo } from "react";

import Repeater from "@/components/Repeater";
import { RETRIEVE_OMB_DETAILS, RetrieveOMBDetailsResp } from "@/graphql";
import { FormatDate, Logger } from "@/utils";

const StyledBox = styled(Box)({
  padding: "20px",
  borderBottom: "0.5px solid #6B7294",
  marginBottom: "38px",
});

const StyledHeaderStack = styled(Stack)({
  flexDirection: "row",
  columnGap: "15px",
  alignItems: "center",
  marginBottom: "16px",
});

const StyledApprovalNumber = styled(Typography)({
  fontWeight: 600,
  fontSize: "17px",
  color: "#5A7C81",
});

const StyledExpirationDate = styled(Typography)({
  fontWeight: 400,
  fontSize: "14px",
  color: "#2A836D",
  fontFamily: "'Inter', 'Nunito', sans-serif",
});

const StyledContent = styled(Typography)({
  fontSize: "13px",
  color: "#2A836D",
});

/**
 * Loading placeholder component for the PANS banner
 */
const PansBannerLoading: React.FC = () => (
  <StyledBox data-testid="pans-banner-skeleton">
    <StyledHeaderStack>
      <Skeleton
        variant="text"
        width={160}
        height={19}
        data-testid="pans-approval-number-skeleton"
      />
      <Skeleton variant="text" width={180} height={19} data-testid="pans-expiration-skeleton" />
    </StyledHeaderStack>
    <div data-testid="pans-content-skeleton">
      <Repeater count={3}>
        <Skeleton variant="text" width="100%" height={18} />
      </Repeater>
      <Skeleton variant="text" width="90%" height={18} />
      <Skeleton variant="text" width={0} height={18} />
      <Repeater count={4}>
        <Skeleton variant="text" width="100%" height={18} />
      </Repeater>
      <Skeleton variant="text" width="80%" height={18} />
    </div>
  </StyledBox>
);

/**
 * Handles the rendering of the Privacy Act Notification Statement (PANS) banner.
 *
 * @returns The PANS banner component containing the OMB approval number, expiration date, and content.
 */
const PansBanner: React.FC = (): React.ReactNode => {
  const { data, loading, error } = useQuery<RetrieveOMBDetailsResp>(RETRIEVE_OMB_DETAILS, {
    fetchPolicy: "cache-first",
    context: { clientName: "backend" },
    onError: (e) => {
      Logger.error("Error fetching OMB details for PANS banner", e);
    },
  });

  const formattedDate = useMemo<string>(() => {
    if (!data?.getOMB?.expirationDate) {
      return "N/A";
    }

    return FormatDate(data.getOMB.expirationDate, "MM/DD/YYYY", "N/A", false);
  }, [data?.getOMB?.expirationDate]);

  const paragraphs = useMemo<React.ReactNode | null>(() => {
    if (!data?.getOMB?.OMBInfo?.length) {
      return null;
    }

    const { OMBInfo } = data.getOMB;
    return OMBInfo.map((paragraph, index) => (
      <React.Fragment key={paragraph}>
        {paragraph}
        {index < OMBInfo.length - 1 && (
          <Repeater count={2}>
            <br />
          </Repeater>
        )}
      </React.Fragment>
    ));
  }, [data?.getOMB?.OMBInfo]);

  if (loading) {
    return <PansBannerLoading />;
  }

  if (
    error ||
    !data?.getOMB?.OMBNumber ||
    !data?.getOMB?.expirationDate ||
    !data?.getOMB?.OMBInfo?.length
  ) {
    return null;
  }

  return (
    <StyledBox data-testid="pans-banner">
      <StyledHeaderStack>
        <StyledApprovalNumber variant="h1" data-testid="pans-approval-number">
          OMB No.: {data?.getOMB.OMBNumber}
        </StyledApprovalNumber>
        <StyledExpirationDate variant="h2" data-testid="pans-expiration">
          Expiration Date: {formattedDate}
        </StyledExpirationDate>
      </StyledHeaderStack>
      <StyledContent data-testid="pans-content">{paragraphs}</StyledContent>
    </StyledBox>
  );
};

export default memo(PansBanner);
