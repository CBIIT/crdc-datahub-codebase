import { styled } from "@mui/material";
import { FC, useState } from "react";
import Carousel, { CarouselProps } from "react-multi-carousel";

import "react-multi-carousel/lib/styles.css";
import CustomLeftArrow from "./CustomLeftArrow";
import CustomRightArrow from "./CustomRightArrow";

type Props = {
  children: React.ReactNode;
  /**
   * If true, will disable any user interaction with the carousel.
   */
  locked?: boolean;
} & Partial<CarouselProps>;

const sizing = {
  desktop: {
    breakpoint: { max: 5000, min: 0 },
    items: 3,
  },
};

const StyledWrapper = styled("div", {
  shouldForwardProp: (p) => p !== "showLeftFade" && p !== "showRightFade",
})<{ showLeftFade: boolean; showRightFade: boolean }>(({ showLeftFade, showRightFade }) => ({
  maxWidth: "700px",
  minWidth: "464px", // NOTE: Without a min-width, the carousel collapses to 0px wide
  width: "100%",
  margin: "0 auto",
  "& .react-multi-carousel-list": {
    height: "206px",
  },
  "& .react-multi-carousel-track": {
    margin: "0 auto", // NOTE: This centers the carousel when there are fewer than 2 items
  },
  "& .custom-carousel-item": {
    maxWidth: "200px",
    minWidth: "200px",
  },
  "& .react-multi-carousel-list::after": {
    content: "''",
    position: "absolute",
    left: "calc(100% - 162px)",
    top: "0",
    bottom: "0",
    width: showRightFade ? "162px" : "0px",
    background: "linear-gradient(to right, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 50%)",
    zIndex: 9,
  },
  "& .react-multi-carousel-list::before": {
    content: "''",
    position: "absolute",
    right: "calc(100% - 162px)",
    top: "0",
    bottom: "0",
    width: showLeftFade ? "162px" : "0px",
    background: "linear-gradient(to left, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 50%)",
    zIndex: 9,
  },
}));

/**
 * Provides a general carousel component for displaying multiple items
 * at the same time.
 *
 * @param Props
 * @returns {JSX.Element}
 */
const ContentCarousel: FC<Props> = ({ children, locked, ...props }: Props) => {
  const [activeSlide, setActiveSlide] = useState<number>(0);

  const handleBeforeChange = (nextSlide: number) => setActiveSlide(nextSlide);

  return (
    <StyledWrapper showLeftFade={activeSlide !== 0 && !locked} showRightFade={!locked}>
      <Carousel
        responsive={sizing}
        swipeable={!locked}
        draggable={!locked}
        arrows={!locked}
        beforeChange={handleBeforeChange}
        itemClass="custom-carousel-item"
        customLeftArrow={<CustomLeftArrow />}
        customRightArrow={<CustomRightArrow />}
        {...props}
      >
        {children}
      </Carousel>
    </StyledWrapper>
  );
};

export default ContentCarousel;
