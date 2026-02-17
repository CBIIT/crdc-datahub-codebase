import { Alert, Container, styled } from "@mui/material";
import { memo } from "react";
import Markdown from "react-markdown";

const StyledFrameContainer = styled(Container)({
  marginTop: "30px",
  marginBottom: "30px",
});

const StyledMarkdownBox = styled("div")({
  borderRadius: "6px",
  border: "1px solid #E0E0E0",
  background: "#fff",
  boxShadow: "0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19)",
  position: "relative",
  padding: "6px 72px",
  "& h1:first-of-type": {
    textAlign: "center",
  },
});

const StyledError = styled(Alert)({
  marginTop: "20px",
  marginBottom: "20px",
});

type NotesViewProps = {
  /**
   * A valid markdown string to render as the Release Notes or `null` if the markdown is not available.
   */
  md: string | null;
};

/**
 * The view for the ReleaseNotes component.
 *
 * @param {NotesViewProps} props The props for the component.
 * @returns {JSX.Element} The ReleaseNotes component.
 */
const NotesView = ({ md }: NotesViewProps): JSX.Element => (
  <StyledFrameContainer maxWidth="xl">
    <StyledMarkdownBox>
      {md ? (
        <Markdown data-testid="release-notes-markdown">{md}</Markdown>
      ) : (
        <StyledError severity="error" data-testid="release-notes-error">
          An error occurred while loading the Release Notes
        </StyledError>
      )}
    </StyledMarkdownBox>
  </StyledFrameContainer>
);

export default memo<NotesViewProps>(NotesView);
