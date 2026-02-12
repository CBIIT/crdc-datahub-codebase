import { styled } from "@mui/material";
import { useState, useEffect, useRef, memo } from "react";

import ArrowUp from "../../assets/icons/arrow_up.svg?url";

const StyledScrollButton = styled("button")(({ theme }) => ({
  background: "#007bbd",
  borderTopLeftRadius: "100%",
  color: "#fff",
  position: "fixed",
  right: "0",
  bottom: "0",
  height: "80px",
  width: "80px",
  fontFamily: "Open Sans",
  fontWeight: 700,
  fontSize: "12px",
  lineHeight: "1.2",
  textAlign: "center",
  padding: "36px 4px 0 18px",
  textDecoration: "none",
  transition: "all 0.25s ease-out",
  zIndex: 999,
  cursor: "pointer",
  "&:active": {
    outline: "solid 4px #2491ff",
    transition: "none",
  },
  "&:after": {
    content: "''",
    display: "none",
  },
  [theme.breakpoints.down("md")]: {
    "&:after": {
      background: "none",
      backgroundColor: "#fff",
      mask: `url("${ArrowUp}") no-repeat center/contain`,
      display: "inline-block",
      height: "4ex",
      marginLeft: "1px",
      verticalAlign: "middle",
      width: "4ex",
      color: "white",
    },
  },
}));

const StyledText = styled("span")(({ theme }) => ({
  [theme.breakpoints.down("md")]: {
    display: "none",
  },
}));

const ScrollButton = () => {
  const [scroll, setScroll] = useState<number>(0);
  const clickToTopRef = useRef<HTMLButtonElement>(null);

  const updateScroll = () => {
    setScroll(window.scrollY);
  };

  const onClickScrollToTop = () => {
    window.scrollTo(0, 0);
    setScroll(0);
  };

  useEffect(() => {
    window.addEventListener("scroll", updateScroll);
    clickToTopRef.current?.addEventListener("click", onClickScrollToTop);

    return () => {
      window.removeEventListener("scroll", updateScroll);
      clickToTopRef.current?.removeEventListener("click", onClickScrollToTop);
    };
  }, []);

  return (
    <StyledScrollButton
      data-testid="scroll-top-button"
      type="button"
      ref={clickToTopRef}
      style={
        scroll < 200
          ? {
              opacity: 0,
              visibility: "hidden",
            }
          : {
              visibility: "visible",
              opacity: 1,
            }
      }
    >
      <StyledText>BACK TO TOP</StyledText>
    </StyledScrollButton>
  );
};

export default memo(ScrollButton);
