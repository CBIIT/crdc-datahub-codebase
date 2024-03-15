import React, { ElementType, FC } from 'react';
import { Typography, styled } from '@mui/material';
import Tooltip from '../Tooltip';
import { formatFullStudyName } from '../../utils';

type Props = {
  _id: Organization["_id"];
  studies: Organization["studies"];
};

const StyledStudyCount = styled(Typography)<{ component: ElementType }>(({ theme }) => ({
  textDecoration: "underline",
  cursor: "pointer",
  color: theme.palette.primary.main,
}));

const TooltipBody: FC<Props> = ({ _id, studies }) => (
  <Typography variant="body1">
    {studies?.map(({ studyName, studyAbbreviation }) => (
      <React.Fragment key={`${_id}_study_${studyName}`}>
        {formatFullStudyName(studyName, studyAbbreviation)}
        <br />
      </React.Fragment>
    ))}
  </Typography>
);

/**
 * Organization list view tooltip for studies
 *
 * @param Props
 * @returns {React.FC}
 */
const StudyTooltip: FC<Props> = ({ _id, studies }) => (
  <Tooltip
    title={<TooltipBody _id={_id} studies={studies} />}
    placement="top"
    open={undefined}
    onBlur={undefined}
    disableHoverListener={false}
    arrow
  >
    <StyledStudyCount variant="body2" component="span">
      other
      {" "}
      {studies.length - 1}
    </StyledStudyCount>
  </Tooltip>
);

export default StudyTooltip;
